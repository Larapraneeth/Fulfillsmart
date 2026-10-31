r"""
Focused Test Suite: Fulfillment Node Allocation Rules
Verifies single-node allocation, inventory constraints, capacity limits, priority tie-breaking,
and Sunday operating shifts.
"""
import pytest
from datetime import datetime
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.engine.allocation import (
    FulfillmentAllocationEngine,
    TransactionalAllocationState,
    OrderRequest,
    OrderLineRequest
)


@pytest.fixture
def clean_engine():
    """Create a fresh allocation engine with an isolated transactional state."""
    state = TransactionalAllocationState(simulation_mode=True)
    return FulfillmentAllocationEngine(state=state)


def test_single_node_greedy_allocation_success(clean_engine):
    """Verify an order is fulfilled by the nearest feasible single node with sufficient stock and capacity."""
    # Order for Hyderabad Urban Zone (DZ-001); nearest node is Hyderabad (FUL-2026-000001)
    req = OrderRequest(
        order_id="TEST-ORD-001",
        customer_id="CUST-TEST",
        order_time="2026-05-20T10:00:00+05:30",  # Wednesday
        destination_zone_id="DZ-001",
        requested_service="STANDARD",
        order_priority="NORMAL",
        lines=[
            OrderLineRequest(order_line_id="TOL-001", sku_id="SKU-000001", quantity=2)
        ]
    )
    
    outcome = clean_engine.allocate_order(req)
    assert outcome.status == "ALLOCATED"
    assert outcome.allocation_type == "SINGLE_NODE"
    assert outcome.allocated_node_count == 1
    assert len(outcome.decisions) == 1
    assert outcome.decisions[0].node_id == "FUL-2026-000001"
    assert outcome.decisions[0].allocated_qty == 2
    assert "Hyderabad" in outcome.explanation


def test_sunday_processing_shift_to_monday(clean_engine):
    """Verify orders placed on Sunday have their allocation date shifted to Monday."""
    # 2026-05-17 is a Sunday
    req = OrderRequest(
        order_id="TEST-ORD-SUNDAY",
        customer_id="CUST-TEST",
        order_time="2026-05-17T14:30:00+05:30",  # Sunday
        destination_zone_id="DZ-001",
        requested_service="STANDARD",
        order_priority="NORMAL",
        lines=[
            OrderLineRequest(order_line_id="TOL-002", sku_id="SKU-000001", quantity=1)
        ]
    )
    
    outcome = clean_engine.allocate_order(req)
    assert outcome.status == "ALLOCATED"
    # Allocation date must be Monday: 2026-05-18
    assert outcome.decisions[0].allocation_date == "2026-05-18"
    assert "Shifted from Sunday to Monday" in outcome.explanation


def test_network_stock_shortage_exception_and_zero_reservation(clean_engine):
    """Verify orders exceeding total network stock return UNALLOCATED with zero partial reservations."""
    initial_stock = clean_engine.state.get_available_stock("FUL-2026-000001", "SKU-000001")
    
    req = OrderRequest(
        order_id="TEST-ORD-SHORTAGE",
        customer_id="CUST-TEST",
        order_time="2026-05-20T10:00:00+05:30",
        destination_zone_id="DZ-001",
        requested_service="STANDARD",
        order_priority="NORMAL",
        lines=[
            # Requesting an impossibly large quantity
            OrderLineRequest(order_line_id="TOL-003", sku_id="SKU-000001", quantity=9999999)
        ]
    )
    
    outcome = clean_engine.allocate_order(req)
    assert outcome.status == "UNALLOCATED"
    assert outcome.allocation_type == "NONE"
    assert len(outcome.decisions) == 0
    assert len(outcome.exceptions) == 1
    assert outcome.exceptions[0]["exception_code"] == "OUT_OF_STOCK"
    
    # Assert zero stock was reserved (stock remains identical)
    post_stock = clean_engine.state.get_available_stock("FUL-2026-000001", "SKU-000001")
    assert post_stock == initial_stock


def test_warehouse_capacity_limit_reroutes_to_next_nearest(clean_engine):
    """Verify that when nearest node has 0 remaining order capacity, order reroutes to next nearest feasible node."""
    nearest_node = "FUL-2026-000001"
    alloc_date = "2026-05-20"
    
    # Artificially exhaust order capacity at Hyderabad
    cap = clean_engine.state._capacity.get((nearest_node, alloc_date))
    if cap:
        cap["orders_rem"] = 0
        
    req = OrderRequest(
        order_id="TEST-ORD-CAPACITY-REROUTE",
        customer_id="CUST-TEST",
        order_time="2026-05-20T10:00:00+05:30",
        destination_zone_id="DZ-001",  # Hyderabad
        requested_service="STANDARD",
        order_priority="NORMAL",
        lines=[
            OrderLineRequest(order_line_id="TOL-004", sku_id="SKU-000001", quantity=1)
        ]
    )
    
    outcome = clean_engine.allocate_order(req)
    assert outcome.status == "ALLOCATED"
    # Should be allocated to next nearest warehouse with stock and capacity (not Hyderabad)
    allocated_node = outcome.decisions[0].node_id
    assert allocated_node != nearest_node
    assert outcome.allocation_type == "SINGLE_NODE"


def test_priority_tie_breaking_for_identical_timestamps(clean_engine):
    """Verify that when order timestamps are identical, CRITICAL priority gets inventory before NORMAL priority."""
    target_node = "FUL-2026-000001"
    target_sku = "SKU-000001"
    
    # Artificially constrain stock to exactly 5 units across the network
    for key in list(clean_engine.state._inventory.keys()):
        if key[1] == target_sku:
            clean_engine.state._inventory[key] = 0
    clean_engine.state._inventory[(target_node, target_sku)] = 5
    
    # Two orders arriving at the EXACT same timestamp, competing for the 5 units:
    # Order A needs 5 units, NORMAL priority
    # Order B needs 5 units, CRITICAL priority
    order_normal = OrderRequest(
        order_id="ORD-NORMAL",
        customer_id="CUST-NORMAL",
        order_time="2026-05-20T11:00:00+05:30",
        destination_zone_id="DZ-001",
        requested_service="STANDARD",
        order_priority="NORMAL",
        lines=[OrderLineRequest(order_line_id="LINE-NORM", sku_id=target_sku, quantity=5)]
    )
    
    order_critical = OrderRequest(
        order_id="ORD-CRITICAL",
        customer_id="CUST-CRIT",
        order_time="2026-05-20T11:00:00+05:30",  # Exact same timestamp!
        destination_zone_id="DZ-001",
        requested_service="STANDARD",
        order_priority="CRITICAL",
        lines=[OrderLineRequest(order_line_id="LINE-CRIT", sku_id=target_sku, quantity=5)]
    )
    
    # Pass them in reverse order (normal first) into allocate_batch
    batch_outcomes = clean_engine.allocate_batch([order_normal, order_critical])
    
    outcomes_by_id = {o.order_id: o for o in batch_outcomes}
    
    # CRITICAL must succeed
    assert outcomes_by_id["ORD-CRITICAL"].status == "ALLOCATED"
    # NORMAL must be unallocated because CRITICAL reserved the remaining 5 units
    assert outcomes_by_id["ORD-NORMAL"].status == "UNALLOCATED"
    assert outcomes_by_id["ORD-NORMAL"].exceptions[0]["exception_code"] == "OUT_OF_STOCK"
