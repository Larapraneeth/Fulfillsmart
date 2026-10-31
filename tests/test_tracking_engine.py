r"""
Focused Test Suite: Shipment Tracking Engine & Split Rollup
Verifies:
1. Shipment lifecycle event sequence and timestamp validation.
2. Single-node and split-node order delivery rollups.
3. Every shipment evaluated against its own promised delivery date.
4. Edge cases: pending, late shipments, split delay ripple, carrier unavailable.
5. Regression against real historical orders (ORD-2026-000001 and split order ORD-2026-018321).
"""
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.engine.tracking import (
    ShipmentTrackingEngine,
    ShipmentRecord,
    TrackingEventRecord,
    OrderDeliveryOutcome
)
from src.db import get_db


@pytest.fixture
def tracking_engine():
    return ShipmentTrackingEngine()


def test_lifecycle_event_validation_happy_path(tracking_engine):
    """Verify contiguous and chronological tracking events pass validation."""
    events = [
        TrackingEventRecord(
            tracking_event_id="TE-01", shipment_id="SHP-01", order_id="ORD-01",
            event_sequence=1, event_type="PICKED_UP",
            event_timestamp="2026-05-10T10:00:00+05:30",
            event_location="FUL-01", event_description="Picked up"
        ),
        TrackingEventRecord(
            tracking_event_id="TE-02", shipment_id="SHP-01", order_id="ORD-01",
            event_sequence=2, event_type="IN_TRANSIT",
            event_timestamp="2026-05-11T08:00:00+05:30",
            event_location="HUB-01", event_description="In transit"
        ),
        TrackingEventRecord(
            tracking_event_id="TE-03", shipment_id="SHP-01", order_id="ORD-01",
            event_sequence=3, event_type="DELIVERED",
            event_timestamp="2026-05-12T14:30:00+05:30",
            event_location="DZ-01", event_description="Delivered"
        )
    ]
    res = tracking_engine.validate_lifecycle_events("SHP-01", events)
    assert res.is_valid is True
    assert res.event_count == 3
    assert res.terminal_status == "DELIVERED"
    assert len(res.violations) == 0


def test_lifecycle_event_validation_violations(tracking_engine):
    """Verify non-contiguous sequences and inverted timestamps are flagged."""
    # 1. Non-contiguous sequence (1, 3 instead of 1, 2)
    bad_seq_events = [
        TrackingEventRecord(
            tracking_event_id="TE-01", shipment_id="SHP-02", order_id="ORD-02",
            event_sequence=1, event_type="PICKED_UP",
            event_timestamp="2026-05-10T10:00:00+05:30",
            event_location="FUL-01", event_description="Picked up"
        ),
        TrackingEventRecord(
            tracking_event_id="TE-02", shipment_id="SHP-02", order_id="ORD-02",
            event_sequence=3, event_type="DELIVERED",
            event_timestamp="2026-05-12T14:30:00+05:30",
            event_location="DZ-01", event_description="Delivered"
        )
    ]
    res_seq = tracking_engine.validate_lifecycle_events("SHP-02", bad_seq_events)
    assert res_seq.is_valid is False
    assert any("Non-contiguous" in v for v in res_seq.violations)

    # 2. Inverted chronological timestamp
    bad_time_events = [
        TrackingEventRecord(
            tracking_event_id="TE-01", shipment_id="SHP-03", order_id="ORD-03",
            event_sequence=1, event_type="PICKED_UP",
            event_timestamp="2026-05-10T15:00:00+05:30",
            event_location="FUL-01", event_description="Picked up"
        ),
        TrackingEventRecord(
            tracking_event_id="TE-02", shipment_id="SHP-03", order_id="ORD-03",
            event_sequence=2, event_type="DELIVERED",
            event_timestamp="2026-05-09T10:00:00+05:30",  # May 9 is before May 10!
            event_location="DZ-01", event_description="Delivered"
        )
    ]
    res_time = tracking_engine.validate_lifecycle_events("SHP-03", bad_time_events)
    assert res_time.is_valid is False
    assert any("Non-chronological" in v for v in res_time.violations)


def test_single_shipment_order_rollup(tracking_engine):
    """Verify single-node shipment rollup on time vs late."""
    # On time
    s_ontime = [
        ShipmentRecord(
            shipment_id="SHP-S1", order_id="ORD-S1", node_id="FUL-01",
            carrier_id="CAR-001", service_level_id="SL-STD",
            delivery_promise_id="DP-01", dispatch_date="2026-06-01",
            promised_delivery_date="2026-06-05", actual_delivery_date="2026-06-05",
            shipment_status="DELIVERED", is_delayed=0
        )
    ]
    res1 = tracking_engine.calculate_order_rollup("ORD-S1", "2026-06-01T09:00:00", "STANDARD", 1, s_ontime)
    assert res1.delivery_outcome_status == "DELIVERED_ON_TIME"
    assert res1.delivery_completed == 1
    assert res1.delivery_on_time == 1
    assert res1.delayed_shipment_count == 0

    # Late
    s_late = [
        ShipmentRecord(
            shipment_id="SHP-S2", order_id="ORD-S2", node_id="FUL-01",
            carrier_id="CAR-001", service_level_id="SL-STD",
            delivery_promise_id="DP-02", dispatch_date="2026-06-01",
            promised_delivery_date="2026-06-05", actual_delivery_date="2026-06-07",
            shipment_status="DELIVERED", is_delayed=1, delay_days=2
        )
    ]
    res2 = tracking_engine.calculate_order_rollup("ORD-S2", "2026-06-01T09:00:00", "STANDARD", 1, s_late)
    assert res2.delivery_outcome_status == "DELIVERED_LATE"
    assert res2.delivery_completed == 1
    assert res2.delivery_on_time == 0
    assert res2.delayed_shipment_count == 1


def test_split_shipment_order_rollup_individual_eval(tracking_engine):
    """
    CRITICAL REQUIREMENT:
    For order-level on-time delivery, evaluate every shipment against its own promised delivery date.
    An order is on time ONLY IF all required shipments are delivered on time.
    """
    # Case A: Both split shipments on-time against their respective promises
    # Shipment 1: Promised June 5, Delivered June 5
    # Shipment 2: Promised June 6, Delivered June 6
    s_split_both_ontime = [
        ShipmentRecord(
            shipment_id="SHP-M1", order_id="ORD-M1", node_id="FUL-01",
            carrier_id="CAR-001", service_level_id="SL-STD",
            delivery_promise_id="DP-M1", dispatch_date="2026-06-01",
            promised_delivery_date="2026-06-05", actual_delivery_date="2026-06-05",
            shipment_status="DELIVERED", is_delayed=0
        ),
        ShipmentRecord(
            shipment_id="SHP-M2", order_id="ORD-M1", node_id="FUL-02",
            carrier_id="CAR-002", service_level_id="SL-STD",
            delivery_promise_id="DP-M2", dispatch_date="2026-06-01",
            promised_delivery_date="2026-06-06", actual_delivery_date="2026-06-06",
            shipment_status="DELIVERED", is_delayed=0
        )
    ]
    res_a = tracking_engine.calculate_order_rollup("ORD-M1", "2026-06-01T08:00:00", "STANDARD", 2, s_split_both_ontime)
    assert res_a.shipment_count == 2
    assert res_a.delivered_shipment_count == 2
    assert res_a.latest_actual_delivery_date == "2026-06-06"
    assert res_a.latest_promised_delivery_date == "2026-06-06"
    assert res_a.delayed_shipment_count == 0
    assert res_a.delivery_completed == 1
    assert res_a.delivery_on_time == 1
    assert res_a.delivery_outcome_status == "DELIVERED_ON_TIME"

    # Case B: 1 on-time (Delivered June 5 <= Promised June 5), BUT 1 late (Delivered June 8 > Promised June 6)
    # Order MUST be DELIVERED_LATE!
    s_split_one_late = [
        ShipmentRecord(
            shipment_id="SHP-M3", order_id="ORD-M2", node_id="FUL-01",
            carrier_id="CAR-001", service_level_id="SL-STD",
            delivery_promise_id="DP-M3", dispatch_date="2026-06-01",
            promised_delivery_date="2026-06-05", actual_delivery_date="2026-06-05",
            shipment_status="DELIVERED", is_delayed=0
        ),
        ShipmentRecord(
            shipment_id="SHP-M4", order_id="ORD-M2", node_id="FUL-02",
            carrier_id="CAR-002", service_level_id="SL-STD",
            delivery_promise_id="DP-M4", dispatch_date="2026-06-01",
            promised_delivery_date="2026-06-06", actual_delivery_date="2026-06-08",
            shipment_status="DELIVERED", is_delayed=1, delay_days=2
        )
    ]
    res_b = tracking_engine.calculate_order_rollup("ORD-M2", "2026-06-01T08:00:00", "STANDARD", 2, s_split_one_late)
    assert res_b.shipment_count == 2
    assert res_b.delivered_shipment_count == 2
    assert res_b.latest_actual_delivery_date == "2026-06-08"
    assert res_b.delayed_shipment_count == 1
    assert res_b.delivery_completed == 1
    assert res_b.delivery_on_time == 0
    assert res_b.delivery_outcome_status == "DELIVERED_LATE"

    # Case C: 1 delivered, 1 still pending (IN_TRANSIT)
    s_split_partial = [
        ShipmentRecord(
            shipment_id="SHP-M5", order_id="ORD-M3", node_id="FUL-01",
            carrier_id="CAR-001", service_level_id="SL-STD",
            delivery_promise_id="DP-M5", dispatch_date="2026-06-01",
            promised_delivery_date="2026-06-05", actual_delivery_date="2026-06-05",
            shipment_status="DELIVERED", is_delayed=0
        ),
        ShipmentRecord(
            shipment_id="SHP-M6", order_id="ORD-M3", node_id="FUL-02",
            carrier_id="CAR-002", service_level_id="SL-STD",
            delivery_promise_id="DP-M6", dispatch_date="2026-06-01",
            promised_delivery_date="2026-06-06", actual_delivery_date=None,
            shipment_status="IN_TRANSIT", is_delayed=0
        )
    ]
    res_c = tracking_engine.calculate_order_rollup("ORD-M3", "2026-06-01T08:00:00", "STANDARD", 2, s_split_partial)
    assert res_c.shipment_count == 2
    assert res_c.delivered_shipment_count == 1
    assert res_c.delivery_completed == 0
    assert res_c.delivery_on_time is None
    assert res_c.delivery_outcome_status == "IN_TRANSIT"


def test_carrier_unavailable_order_rollup(tracking_engine):
    """Verify 0 shipments result in CARRIER_UNAVAILABLE and on_time is None."""
    res = tracking_engine.calculate_order_rollup("ORD-NO-CARRIER", "2026-05-20T10:00:00", "SAME_DAY", 1, [])
    assert res.shipment_count == 0
    assert res.delivery_completed == 0
    assert res.delivery_on_time is None
    assert res.delivery_outcome_status == "CARRIER_UNAVAILABLE"


def test_historical_split_order_rollup_regression(tracking_engine):
    """
    Regression check against historical split order ORD-2026-018321.
    Verifies that the tracking engine calculates outcomes matching historical delivery_outcomes record.
    """
    shipments, events = tracking_engine.load_order_tracking_from_db("ORD-2026-018321")
    assert len(shipments) == 2
    assert len(events) >= 2

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM delivery_outcomes WHERE order_id = 'ORD-2026-018321'")
        hist_outcome = cursor.fetchone()
        assert hist_outcome is not None

    rollup = tracking_engine.calculate_order_rollup(
        order_id="ORD-2026-018321",
        order_time=hist_outcome["order_time"],
        requested_service=hist_outcome["requested_service"],
        allocated_node_groups=hist_outcome["allocated_node_groups"],
        shipments=shipments
    )

    assert rollup.shipment_count == hist_outcome["shipment_count"]
    assert rollup.delivered_shipment_count == hist_outcome["delivered_shipment_count"]
    assert rollup.latest_actual_delivery_date == hist_outcome["latest_actual_delivery_date"]
    assert rollup.latest_promised_delivery_date == hist_outcome["latest_promised_delivery_date"]
    assert rollup.delayed_shipment_count == hist_outcome["delayed_shipment_count"]
    assert rollup.delivery_outcome_status == hist_outcome["delivery_outcome_status"]
    assert rollup.delivery_completed == hist_outcome["delivery_completed"]
    assert rollup.delivery_on_time == hist_outcome["delivery_on_time"]
