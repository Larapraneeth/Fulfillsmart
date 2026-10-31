r"""
Focused Test Suite: Transactional Split-Shipment Allocation
Verifies minimal multi-node split allocation, line-item splitting, transactional rollbacks,
and regression behavior against historical multi-node order ORD-2026-019142.
"""
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.engine.allocation import (
    FulfillmentAllocationEngine,
    TransactionalAllocationState,
    OrderRequest,
    OrderLineRequest
)
from src.db import get_db


@pytest.fixture
def clean_engine():
    """Create a fresh allocation engine with an isolated transactional state."""
    state = TransactionalAllocationState(simulation_mode=True)
    return FulfillmentAllocationEngine(state=state)


def test_split_allocation_across_two_nodes(clean_engine):
    """Verify an order is split across two nodes when lines are distributed across warehouses."""
    node_a = "FUL-2026-000001"  # Hyderabad
    node_b = "FUL-2026-000002"  # Bengaluru
    sku_a = "SKU-SPLIT-A"
    sku_b = "SKU-SPLIT-B"
    
    # Configure inventory: SKU A is ONLY at Node A; SKU B is ONLY at Node B
    clean_engine.state._inventory[(node_a, sku_a)] = 10
    clean_engine.state._inventory[(node_b, sku_a)] = 0
    clean_engine.state._inventory[(node_a, sku_b)] = 0
    clean_engine.state._inventory[(node_b, sku_b)] = 10
    
    order = OrderRequest(
        order_id="TEST-SPLIT-2NODES",
        customer_id="CUST-SPLIT",
        order_time="2026-05-20T10:00:00+05:30",
        destination_zone_id="DZ-001",
        requested_service="STANDARD",
        order_priority="NORMAL",
        lines=[
            OrderLineRequest(order_line_id="SPLIT-LINE-1", sku_id=sku_a, quantity=5),
            OrderLineRequest(order_line_id="SPLIT-LINE-2", sku_id=sku_b, quantity=5)
        ]
    )
    
    outcome = clean_engine.allocate_order(order)
    assert outcome.status == "ALLOCATED"
    assert outcome.allocation_type == "SPLIT_NODE"
    assert outcome.allocated_node_count == 2
    assert len(outcome.decisions) == 2
    
    assigned_nodes = {d.node_id for d in outcome.decisions}
    assert assigned_nodes == {node_a, node_b}
    assert outcome.total_units == 10


def test_split_allocation_transactional_rollback(clean_engine):
    """Verify that if one line in a multi-line order fails, all staged deductions are rolled back."""
    node_a = "FUL-2026-000001"
    sku_avail = "SKU-AVAILABLE"
    sku_missing = "SKU-COMPLETELY-OUT"
    
    clean_engine.state._inventory[(node_a, sku_avail)] = 10
    # sku_missing has 0 inventory across entire network
    
    initial_avail_stock = clean_engine.state.get_available_stock(node_a, sku_avail)
    
    order = OrderRequest(
        order_id="TEST-SPLIT-ROLLBACK",
        customer_id="CUST-SPLIT",
        order_time="2026-05-20T10:00:00+05:30",
        destination_zone_id="DZ-001",
        requested_service="STANDARD",
        order_priority="NORMAL",
        lines=[
            OrderLineRequest(order_line_id="LINE-AVAIL", sku_id=sku_avail, quantity=5),
            OrderLineRequest(order_line_id="LINE-OUT", sku_id=sku_missing, quantity=2)
        ]
    )
    
    outcome = clean_engine.allocate_order(order)
    assert outcome.status == "UNALLOCATED"
    assert outcome.allocation_type == "NONE"
    assert len(outcome.decisions) == 0
    assert outcome.exceptions[0]["exception_code"] == "OUT_OF_STOCK"
    
    # CRITICAL: Verify transactional rollback prevented partial reservation of SKU-AVAILABLE
    post_avail_stock = clean_engine.state.get_available_stock(node_a, sku_avail)
    assert post_avail_stock == initial_avail_stock, "Transactional rollback failed! Partial stock was reserved."


def test_line_item_quantity_split_across_warehouses(clean_engine):
    """Verify a single line item quantity is split across multiple warehouses when no single node has enough."""
    node_a = "FUL-2026-000001"
    node_b = "FUL-2026-000014"  # Nagpur (close to Hyderabad)
    sku_id = "SKU-BULK-SPLIT"
    
    # Configure inventory: Node A has 3 units, Node B has 7 units (total 10)
    for key in list(clean_engine.state._inventory.keys()):
        if key[1] == sku_id:
            clean_engine.state._inventory[key] = 0
    clean_engine.state._inventory[(node_a, sku_id)] = 3
    clean_engine.state._inventory[(node_b, sku_id)] = 7
    
    order = OrderRequest(
        order_id="TEST-LINE-SPLIT",
        customer_id="CUST-LINE",
        order_time="2026-05-20T10:00:00+05:30",
        destination_zone_id="DZ-001",
        requested_service="STANDARD",
        order_priority="NORMAL",
        lines=[
            OrderLineRequest(order_line_id="BULK-LINE-1", sku_id=sku_id, quantity=10)
        ]
    )
    
    outcome = clean_engine.allocate_order(order)
    assert outcome.status == "ALLOCATED"
    assert outcome.allocation_type == "SPLIT_NODE"
    assert outcome.allocated_node_count == 2
    assert len(outcome.decisions) == 2
    
    # Line BULK-LINE-1 must be divided across both nodes
    decisions_qty = {d.node_id: d.allocated_qty for d in outcome.decisions}
    assert decisions_qty[node_a] == 3
    assert decisions_qty[node_b] == 7
    assert sum(decisions_qty.values()) == 10


def test_historical_split_order_regression_reference(clean_engine):
    """
    Regression check against historical split order ORD-2026-019142.
    Verifies that the engine dynamically identifies a split-node requirement without hardcoding.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT customer_id, order_time, destination_zone_id, requested_service, order_priority FROM orders WHERE order_id = 'ORD-2026-019142'")
        o_row = cursor.fetchone()
        assert o_row is not None
        
        cursor.execute("SELECT order_line_id, sku_id, quantity FROM order_lines WHERE order_id = 'ORD-2026-019142'")
        lines = [OrderLineRequest(order_line_id=r["order_line_id"], sku_id=r["sku_id"], quantity=int(r["quantity"])) for r in cursor.fetchall()]
        
    # Constrain SKU-000561 network-wide to at most 2 units per warehouse
    # (Since Line OL-00035641 needs 4 units, no single warehouse can fulfill it alone, forcing multi-node split)
    for key in list(clean_engine.state._inventory.keys()):
        if key[1] == "SKU-000561" and clean_engine.state._inventory[key] > 2:
            clean_engine.state._inventory[key] = 2
    
    req = OrderRequest(
        order_id="ORD-2026-019142",
        customer_id=o_row["customer_id"],
        order_time=o_row["order_time"],
        destination_zone_id=o_row["destination_zone_id"],
        requested_service=o_row["requested_service"],
        order_priority=o_row["order_priority"],
        lines=lines
    )
    
    outcome = clean_engine.allocate_order(req)
    assert outcome.status == "ALLOCATED"
    assert outcome.total_units == 12
    # Confirms dynamic multi-node allocation
    assert outcome.allocated_node_count >= 2
    assert outcome.allocation_type == "SPLIT_NODE"
    assert sum(d.allocated_qty for d in outcome.decisions) == 12
