r"""
Focused Stage 2 Integration Validation Suite
Validates AllocationEngine and CarrierSelectionEngine against representative historical orders,
split-node cases, historical carrier exceptions, transactional zero-leakage, and data immutability.
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
from src.engine.carrier_selection import (
    CarrierSelectionEngine,
    CarrierPromiseRequest
)
from src.db import get_db
from src.data_loader import calculate_sha256, CSV_MAPPINGS
from src.config import ROOT_DIR


@pytest.fixture
def clean_state():
    return TransactionalAllocationState(simulation_mode=True)


@pytest.fixture
def engines(clean_state):
    alloc_engine = FulfillmentAllocationEngine(state=clean_state)
    carrier_engine = CarrierSelectionEngine()
    return alloc_engine, carrier_engine


def test_validation_case_1_historical_single_node_orders_and_carrier_promises(engines):
    """
    Validate representative single-node historical orders from different regions and service levels:
    - ORD-2026-000001 (Delhi DZ-010, Express, placed 2026-06-16T01:54:27)
    - ORD-2026-000002 (Kolkata DZ-017, Standard, placed 2026-04-06T13:34:16)
    - ORD-2026-000006 (Warangal DZ-037, Same Day, placed 2026-10-15T21:05:27)
    - ORD-2026-000018 (Mumbai DZ-001, Standard, placed Sunday 2026-10-11T12:00:00 -> Monday shift)
    """
    alloc_engine, carrier_engine = engines
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 1. ORD-2026-000001 (Delhi, Express)
        cursor.execute("SELECT * FROM orders WHERE order_id = 'ORD-2026-000001'")
        o1 = cursor.fetchone()
        cursor.execute("SELECT * FROM order_lines WHERE order_id = 'ORD-2026-000001'")
        lines1 = [OrderLineRequest(order_line_id=r["order_line_id"], sku_id=r["sku_id"], quantity=int(r["quantity"])) for r in cursor.fetchall()]
        
        req1 = OrderRequest(
            order_id=o1["order_id"],
            customer_id=o1["customer_id"],
            order_time=o1["order_time"],
            destination_zone_id=o1["destination_zone_id"],
            requested_service=o1["requested_service"],
            order_priority=o1["order_priority"],
            lines=lines1
        )
        out1 = alloc_engine.allocate_order(req1)
        assert out1.status == "ALLOCATED"
        assert out1.allocation_type == "SINGLE_NODE"
        assert out1.decisions[0].node_id == "FUL-2026-000004"  # Chennai node matches historical allocation decision
        
        c_req1 = CarrierPromiseRequest(
            order_id=o1["order_id"],
            node_id=out1.decisions[0].node_id,
            delivery_zone_id=o1["destination_zone_id"],
            requested_service=o1["requested_service"],
            allocation_date=out1.decisions[0].allocation_date,
            order_time=o1["order_time"],
            allocated_line_count=len(lines1),
            allocated_unit_count=sum(l.quantity for l in lines1)
        )
        c_out1 = carrier_engine.select_carrier_and_promise(c_req1)
        assert c_out1.is_success is True
        assert c_out1.carrier_id == "CAR-001"
        assert c_out1.dispatch_date == "2026-06-16"
        assert c_out1.promised_delivery_date == "2026-06-18"
        
        # 2. ORD-2026-000006 (Warangal, Same Day, placed at night 21:05)
        cursor.execute("SELECT * FROM orders WHERE order_id = 'ORD-2026-000006'")
        o6 = cursor.fetchone()
        cursor.execute("SELECT * FROM order_lines WHERE order_id = 'ORD-2026-000006'")
        lines6 = [OrderLineRequest(order_line_id=r["order_line_id"], sku_id=r["sku_id"], quantity=int(r["quantity"])) for r in cursor.fetchall()]
        
        req6 = OrderRequest(
            order_id=o6["order_id"],
            customer_id=o6["customer_id"],
            order_time=o6["order_time"],
            destination_zone_id=o6["destination_zone_id"],
            requested_service=o6["requested_service"],
            order_priority=o6["order_priority"],
            lines=lines6
        )
        out6 = alloc_engine.allocate_order(req6)
        assert out6.status == "ALLOCATED"
        assert out6.allocation_type == "SINGLE_NODE"
        assert out6.decisions[0].node_id == "FUL-2026-000001"  # Hyderabad matches historical
        
        c_req6 = CarrierPromiseRequest(
            order_id=o6["order_id"],
            node_id=out6.decisions[0].node_id,
            delivery_zone_id=o6["destination_zone_id"],
            requested_service=o6["requested_service"],
            allocation_date=out6.decisions[0].allocation_date,
            order_time=o6["order_time"],
            allocated_line_count=len(lines6),
            allocated_unit_count=sum(l.quantity for l in lines6)
        )
        c_out6 = carrier_engine.select_carrier_and_promise(c_req6)
        assert c_out6.is_success is True
        assert c_out6.carrier_id == "CAR-005"
        assert c_out6.dispatch_date == "2026-10-16"
        assert c_out6.promised_delivery_date == "2026-10-16"
        
        # 3. ORD-2026-000002 (Kolkata, Standard, placed 13:34:16 after BlueDart 12:00 cutoff)
        cursor.execute("SELECT * FROM orders WHERE order_id = 'ORD-2026-000002'")
        o2 = cursor.fetchone()
        cursor.execute("SELECT * FROM order_lines WHERE order_id = 'ORD-2026-000002'")
        lines2 = [OrderLineRequest(order_line_id=r["order_line_id"], sku_id=r["sku_id"], quantity=int(r["quantity"])) for r in cursor.fetchall()]
        
        req2 = OrderRequest(
            order_id=o2["order_id"],
            customer_id=o2["customer_id"],
            order_time=o2["order_time"],
            destination_zone_id=o2["destination_zone_id"],
            requested_service=o2["requested_service"],
            order_priority=o2["order_priority"],
            lines=lines2
        )
        out2 = alloc_engine.allocate_order(req2)
        assert out2.status == "ALLOCATED"
        assert out2.allocation_type == "SINGLE_NODE"
        assert out2.decisions[0].node_id == "FUL-2026-000007"  # Kolkata matches historical
        
        # 3a. Autonomous optimization: chooses DTDC (cutoff 14:00) achieving same-day dispatch and earlier delivery
        c_req2_opt = CarrierPromiseRequest(
            order_id=o2["order_id"],
            node_id=out2.decisions[0].node_id,
            delivery_zone_id=o2["destination_zone_id"],
            requested_service=o2["requested_service"],
            allocation_date=out2.decisions[0].allocation_date,
            order_time=o2["order_time"],
            allocated_line_count=len(lines2),
            allocated_unit_count=sum(l.quantity for l in lines2)
        )
        c_out2_opt = carrier_engine.select_carrier_and_promise(c_req2_opt)
        assert c_out2_opt.is_success is True
        assert c_out2_opt.carrier_id == "CAR-003"  # DTDC cutoff is 14:00
        assert c_out2_opt.dispatch_date == "2026-04-06"
        assert c_out2_opt.promised_delivery_date == "2026-04-10"
        
        # 3b. Regression verification of historical assigned carrier CAR-001 (BlueDart)
        c_req2_hist = CarrierPromiseRequest(
            order_id=o2["order_id"],
            node_id=out2.decisions[0].node_id,
            delivery_zone_id=o2["destination_zone_id"],
            requested_service=o2["requested_service"],
            allocation_date=out2.decisions[0].allocation_date,
            order_time=o2["order_time"],
            allocated_line_count=len(lines2),
            allocated_unit_count=sum(l.quantity for l in lines2),
            preferred_carrier_id="CAR-001"
        )
        c_out2_hist = carrier_engine.select_carrier_and_promise(c_req2_hist)
        assert c_out2_hist.is_success is True
        assert c_out2_hist.carrier_id == "CAR-001"
        # Confirms BlueDart missed 12:00 cutoff and dispatched next day, matching historical record exactly!
        assert c_out2_hist.dispatch_date == "2026-04-07"
        assert c_out2_hist.promised_delivery_date == "2026-04-11"
        assert c_out2_hist.transit_business_days == 4
        
        # 4. ORD-2026-000018 (Placed Sunday 2026-10-11 -> Processed Monday 2026-10-12)
        cursor.execute("SELECT * FROM orders WHERE order_id = 'ORD-2026-000018'")
        o18 = cursor.fetchone()
        cursor.execute("SELECT * FROM order_lines WHERE order_id = 'ORD-2026-000018'")
        lines18 = [OrderLineRequest(order_line_id=r["order_line_id"], sku_id=r["sku_id"], quantity=int(r["quantity"])) for r in cursor.fetchall()]
        
        req18 = OrderRequest(
            order_id=o18["order_id"],
            customer_id=o18["customer_id"],
            order_time=o18["order_time"],
            destination_zone_id=o18["destination_zone_id"],
            requested_service=o18["requested_service"],
            order_priority=o18["order_priority"],
            lines=lines18
        )
        out18 = alloc_engine.allocate_order(req18)
        assert out18.status == "ALLOCATED"
        assert out18.decisions[0].allocation_date == "2026-10-12"  # Shifted from Sunday 11th to Monday 12th


def test_validation_case_2_historical_split_node_orders(engines):
    """
    Validate representative split-node historical cases:
    - ORD-2026-019142 (4 lines, 12 units, historically split across 3 nodes)
    - ORD-2026-003784 (4 lines, 10 units, historically split across 2 nodes)
    Verifies dynamic multi-node fallback under realistic inventory constraints without hardcoding.
    """
    alloc_engine, _ = engines
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 1. ORD-2026-019142
        cursor.execute("SELECT customer_id, order_time, destination_zone_id, requested_service, order_priority FROM orders WHERE order_id = 'ORD-2026-019142'")
        o_row = cursor.fetchone()
        cursor.execute("SELECT order_line_id, sku_id, quantity FROM order_lines WHERE order_id = 'ORD-2026-019142'")
        lines_19142 = [OrderLineRequest(order_line_id=r["order_line_id"], sku_id=r["sku_id"], quantity=int(r["quantity"])) for r in cursor.fetchall()]
        
        # Constrain SKU-000561 network-wide to replicate historical depleted state
        for key in list(alloc_engine.state._inventory.keys()):
            if key[1] == "SKU-000561" and alloc_engine.state._inventory[key] > 2:
                alloc_engine.state._inventory[key] = 2
                
        req1 = OrderRequest(
            order_id="ORD-2026-019142",
            customer_id=o_row["customer_id"],
            order_time=o_row["order_time"],
            destination_zone_id=o_row["destination_zone_id"],
            requested_service=o_row["requested_service"],
            order_priority=o_row["order_priority"],
            lines=lines_19142
        )
        outcome1 = alloc_engine.allocate_order(req1)
        assert outcome1.status == "ALLOCATED"
        assert outcome1.allocation_type == "SPLIT_NODE"
        assert outcome1.allocated_node_count >= 2
        assert outcome1.total_units == 12
        assert sum(d.allocated_qty for d in outcome1.decisions) == 12
        
        # 2. ORD-2026-003784
        cursor.execute("SELECT customer_id, order_time, destination_zone_id, requested_service, order_priority FROM orders WHERE order_id = 'ORD-2026-003784'")
        o_row2 = cursor.fetchone()
        cursor.execute("SELECT order_line_id, sku_id, quantity FROM order_lines WHERE order_id = 'ORD-2026-003784'")
        lines_3784 = [OrderLineRequest(order_line_id=r["order_line_id"], sku_id=r["sku_id"], quantity=int(r["quantity"])) for r in cursor.fetchall()]
        
        # Replicate historical inventory depletion where SKU-000779 is unavailable at FUL-04 and only available at FUL-19
        for (n, s) in list(alloc_engine.state._inventory.keys()):
            if s == "SKU-000779" and n != "FUL-2026-000019":
                alloc_engine.state._inventory[(n, s)] = 0
            elif s in ("SKU-000312", "SKU-000745", "SKU-000888") and n == "FUL-2026-000019":
                alloc_engine.state._inventory[(n, s)] = 0
        
        req2 = OrderRequest(
            order_id="ORD-2026-003784",
            customer_id=o_row2["customer_id"],
            order_time=o_row2["order_time"],
            destination_zone_id=o_row2["destination_zone_id"],
            requested_service=o_row2["requested_service"],
            order_priority=o_row2["order_priority"],
            lines=lines_3784
        )
        outcome2 = alloc_engine.allocate_order(req2)
        assert outcome2.status == "ALLOCATED"
        assert outcome2.allocation_type == "SPLIT_NODE"
        assert outcome2.total_units == 10
        assert sum(d.allocated_qty for d in outcome2.decisions) == 10


def test_validation_case_3_historical_carrier_exceptions(engines):
    """
    Validate representative carrier exception orders from outputs/promises/promise_exceptions.csv:
    - ORD-2026-000065 (Node FUL-2026-000009, Zone DZ-009, SAME_DAY)
    - ORD-2026-000129 (Node FUL-2026-000004, Zone DZ-015, SAME_DAY)
    - ORD-2026-000231 (Node FUL-2026-000004, Zone DZ-042, SAME_DAY)
    Verifies that the engine correctly flags NO_ELIGIBLE_CARRIER_OR_CUTOFF_MISSED.
    """
    _, carrier_engine = engines
    exception_order_ids = ["ORD-2026-000065", "ORD-2026-000129", "ORD-2026-000231"]
    
    with get_db() as conn:
        cursor = conn.cursor()
        for order_id in exception_order_ids:
            cursor.execute("SELECT * FROM promise_exceptions WHERE order_id = ?", (order_id,))
            hist_exc = cursor.fetchone()
            assert hist_exc is not None
            
            cursor.execute("SELECT order_time FROM orders WHERE order_id = ?", (order_id,))
            order_time = cursor.fetchone()["order_time"]
            
            c_req = CarrierPromiseRequest(
                order_id=order_id,
                node_id=hist_exc["node_id"],
                delivery_zone_id=hist_exc["delivery_zone_id"],
                requested_service=hist_exc["requested_service"],
                allocation_date="2026-05-20",
                order_time=order_time,
                allocated_line_count=1,
                allocated_unit_count=1
            )
            
            outcome = carrier_engine.select_carrier_and_promise(c_req)
            assert outcome.is_success is False
            assert outcome.exception_code == hist_exc["exception_code"]
            assert outcome.exception_code == "NO_ELIGIBLE_CARRIER_OR_CUTOFF_MISSED"


def test_validation_case_4_failed_allocation_leaves_zero_reservations(engines):
    """
    Verify that failed allocations (single node failure & multi-node split rollback) leave zero reservations.
    """
    alloc_engine, _ = engines
    node_id = "FUL-2026-000001"
    sku_avail = "SKU-000001"
    alloc_date = "2026-05-20"
    
    pre_stock = alloc_engine.state.get_available_stock(node_id, sku_avail)
    pre_cap_orders, pre_cap_units = alloc_engine.state.get_remaining_capacity(node_id, alloc_date)
    
    # 1. Single-node impossible quantity
    failed_req1 = OrderRequest(
        order_id="FAILED-ORDER-ZERO-LEAK-1",
        customer_id="CUST-FAIL-1",
        order_time="2026-05-20T10:00:00+05:30",
        destination_zone_id="DZ-001",
        requested_service="STANDARD",
        order_priority="NORMAL",
        lines=[
            OrderLineRequest(order_line_id="FAIL-LINE-1", sku_id=sku_avail, quantity=pre_stock + 999999)
        ]
    )
    outcome1 = alloc_engine.allocate_order(failed_req1)
    assert outcome1.status == "UNALLOCATED"
    assert alloc_engine.state.get_available_stock(node_id, sku_avail) == pre_stock
    post_cap_orders, post_cap_units = alloc_engine.state.get_remaining_capacity(node_id, alloc_date)
    assert (post_cap_orders, post_cap_units) == (pre_cap_orders, pre_cap_units)
    
    # 2. Multi-node split failure rollback
    failed_req2 = OrderRequest(
        order_id="FAILED-ORDER-ZERO-LEAK-2",
        customer_id="CUST-FAIL-2",
        order_time="2026-05-20T10:00:00+05:30",
        destination_zone_id="DZ-001",
        requested_service="STANDARD",
        order_priority="NORMAL",
        lines=[
            OrderLineRequest(order_line_id="FAIL-LINE-AVAIL", sku_id=sku_avail, quantity=5),
            OrderLineRequest(order_line_id="FAIL-LINE-UNAVAIL", sku_id="SKU-IMPOSSIBLE-99999", quantity=1)
        ]
    )
    outcome2 = alloc_engine.allocate_order(failed_req2)
    assert outcome2.status == "UNALLOCATED"
    # Ensure line 1 was rolled back and never leaked stock or capacity
    assert alloc_engine.state.get_available_stock(node_id, sku_avail) == pre_stock
    post_cap_orders2, post_cap_units2 = alloc_engine.state.get_remaining_capacity(node_id, alloc_date)
    assert (post_cap_orders2, post_cap_units2) == (pre_cap_orders, pre_cap_units)


def test_validation_case_5_database_tables_and_all_29_csvs_unchanged():
    """
    Verify that running the Stage 2 engines has kept historical database tables read-only
    and preserved the exact SHA-256 integrity of all 29 original CSV files.
    """
    # 1. Database table row counts check
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM orders")
        assert cursor.fetchone()[0] == 50000
        cursor.execute("SELECT COUNT(*) FROM order_lines")
        assert cursor.fetchone()[0] == 93552
        cursor.execute("SELECT COUNT(*) FROM inventory")
        assert cursor.fetchone()[0] == 20000
        cursor.execute("SELECT COUNT(*) FROM warehouse_capacity")
        assert cursor.fetchone()[0] == 7300
        cursor.execute("SELECT COUNT(*) FROM shipments")
        assert cursor.fetchone()[0] == 49436
        cursor.execute("SELECT COUNT(*) FROM delivery_outcomes")
        assert cursor.fetchone()[0] == 50000
        cursor.execute("SELECT COUNT(*) FROM carrier_selection")
        assert cursor.fetchone()[0] == 49436
        cursor.execute("SELECT COUNT(*) FROM delivery_promises")
        assert cursor.fetchone()[0] == 49436
        cursor.execute("SELECT COUNT(*) FROM promise_exceptions")
        assert cursor.fetchone()[0] == 580
        
        # 2. SHA-256 check on all 29 original CSV files
        cursor.execute("SELECT relative_path, sha256_hash FROM ingestion_metadata")
        stored_hashes = {r["relative_path"]: r["sha256_hash"] for r in cursor.fetchall()}
        
    assert len(stored_hashes) == 29
    assert len(CSV_MAPPINGS) == 29
    
    for m in CSV_MAPPINGS:
        rel_path = m["path"]
        expected_hash = stored_hashes.get(rel_path)
        actual_hash = calculate_sha256(ROOT_DIR / rel_path)
        assert actual_hash == expected_hash, f"Drift detected in original file {rel_path}!"
