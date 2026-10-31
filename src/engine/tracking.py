r"""
FulfillSmart Shipment Tracking & Order Rollup Engine
Implements:
1. Reusable shipment tracking event processor over existing historical event streams.
2. Shipment lifecycle event validation (CREATED -> PICKED_UP -> IN_TRANSIT -> OUT_FOR_DELIVERY -> DELIVERED).
3. Order-level rollup for single and split shipments:
   - Evaluates each shipment against its own promised delivery date.
   - An order is delivered on-time IF AND ONLY IF all required shipments are completed on or before their respective promise dates.
   - Accurately classifies DELIVERED_ON_TIME, DELIVERED_LATE, IN_TRANSIT, and CARRIER_UNAVAILABLE.
"""
from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Dict, List, Optional, Tuple, Any
import sqlite3

from src.db import get_db


@dataclass
class TrackingEventRecord:
    tracking_event_id: str
    shipment_id: str
    order_id: str
    event_sequence: int
    event_type: str  # PICKED_UP, IN_TRANSIT, DELIVERED, EXCEPTION
    event_timestamp: str  # ISO-8601 string
    event_location: str
    event_description: str


@dataclass
class ShipmentRecord:
    shipment_id: str
    order_id: str
    node_id: str
    carrier_id: str
    service_level_id: str
    delivery_promise_id: str
    dispatch_date: str          # YYYY-MM-DD
    promised_delivery_date: str # YYYY-MM-DD
    actual_delivery_date: Optional[str] = None  # YYYY-MM-DD
    shipment_status: str = "CREATED"  # CREATED, PICKED_UP, IN_TRANSIT, DELIVERED, EXCEPTION
    is_delayed: int = 0
    delay_days: int = 0
    package_line_count: int = 1
    package_unit_count: int = 1


@dataclass
class OrderDeliveryOutcome:
    order_id: str
    order_time: str
    requested_service: str
    allocated_node_groups: int
    shipment_count: int
    delivered_shipment_count: int
    latest_actual_delivery_date: Optional[str]
    latest_promised_delivery_date: Optional[str]
    delayed_shipment_count: int
    delivery_outcome_status: str  # DELIVERED_ON_TIME, DELIVERED_LATE, CARRIER_UNAVAILABLE, IN_TRANSIT, EXCEPTION
    delivery_completed: int       # 1 or 0
    delivery_on_time: Optional[int]  # 1, 0, or None if CARRIER_UNAVAILABLE / IN_TRANSIT


@dataclass
class LifecycleValidationResult:
    shipment_id: str
    is_valid: bool
    event_count: int
    terminal_status: str
    violations: List[str] = field(default_factory=list)


class ShipmentTrackingEngine:
    """
    Deterministic tracking engine for validating shipment event sequences
    and rolling up multi-shipment orders into unified delivery outcomes.
    """
    VALID_STATUS_FLOW = ["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"]

    def validate_lifecycle_events(
        self,
        shipment_id: str,
        events: List[TrackingEventRecord]
    ) -> LifecycleValidationResult:
        """
        Validates the contiguous sequencing and chronological ordering of tracking events for a shipment.
        """
        if not events:
            return LifecycleValidationResult(
                shipment_id=shipment_id,
                is_valid=False,
                event_count=0,
                terminal_status="NO_EVENTS",
                violations=["Shipment has no tracking events."]
            )

        # Sort by sequence
        sorted_events = sorted(events, key=lambda e: e.event_sequence)
        violations = []

        # 1. Contiguity check
        for idx, ev in enumerate(sorted_events):
            expected_seq = idx + 1
            if ev.event_sequence != expected_seq:
                violations.append(f"Non-contiguous sequence: expected {expected_seq}, found {ev.event_sequence}")

        # 2. Chronological check
        prev_dt = None
        for ev in sorted_events:
            try:
                curr_dt = datetime.fromisoformat(ev.event_timestamp)
                if prev_dt and curr_dt < prev_dt:
                    violations.append(
                        f"Non-chronological timestamp at sequence {ev.event_sequence}: {ev.event_timestamp} < previous {prev_dt.isoformat()}"
                    )
                prev_dt = curr_dt
            except Exception as ex:
                violations.append(f"Invalid timestamp format '{ev.event_timestamp}': {str(ex)}")

        # 3. Terminal state check
        last_event = sorted_events[-1]
        terminal_status = last_event.event_type

        return LifecycleValidationResult(
            shipment_id=shipment_id,
            is_valid=len(violations) == 0,
            event_count=len(sorted_events),
            terminal_status=terminal_status,
            violations=violations
        )

    def calculate_order_rollup(
        self,
        order_id: str,
        order_time: str,
        requested_service: str,
        allocated_node_groups: int,
        shipments: List[ShipmentRecord]
    ) -> OrderDeliveryOutcome:
        """
        Calculates the order-level delivery outcome across single or split shipments.
        Strictly enforces:
        - Every shipment is evaluated against its own promised delivery date.
        - An order is on time IF AND ONLY IF all required shipments are completed and on time.
        - If any required shipment is delivered late, the entire order is DELIVERED_LATE.
        - If no shipments exist (e.g. carrier exception), status is CARRIER_UNAVAILABLE and on_time is None.
        - If any shipment is incomplete, status is IN_TRANSIT and on_time is None.
        """
        shipment_count = len(shipments)

        # Case 1: No shipments created (Carrier unavailable or exception)
        if shipment_count == 0:
            return OrderDeliveryOutcome(
                order_id=order_id,
                order_time=order_time,
                requested_service=requested_service,
                allocated_node_groups=allocated_node_groups,
                shipment_count=0,
                delivered_shipment_count=0,
                latest_actual_delivery_date=None,
                latest_promised_delivery_date=None,
                delayed_shipment_count=0,
                delivery_outcome_status="CARRIER_UNAVAILABLE",
                delivery_completed=0,
                delivery_on_time=None
            )

        delivered_shipments = [s for s in shipments if s.shipment_status == "DELIVERED" and s.actual_delivery_date is not None]
        delivered_count = len(delivered_shipments)
        is_completed = 1 if delivered_count == shipment_count else 0

        # Latest promise date across all assigned shipments
        latest_promised = max(s.promised_delivery_date for s in shipments)
        latest_actual = max(s.actual_delivery_date for s in delivered_shipments) if delivered_shipments else None

        # Evaluate delay for each shipment against its OWN promised delivery date
        delayed_count = 0
        all_shipments_on_time = True

        for s in shipments:
            if s.shipment_status == "DELIVERED" and s.actual_delivery_date:
                # Direct date comparison: actual vs its own promised date
                if s.actual_delivery_date > s.promised_delivery_date or s.is_delayed == 1:
                    delayed_count += 1
                    all_shipments_on_time = False
            else:
                # If not delivered, cannot confirm on time
                all_shipments_on_time = False

        if not is_completed:
            # Check if any shipment had an unrecoverable exception
            if any(s.shipment_status == "EXCEPTION" for s in shipments):
                status = "EXCEPTION"
            else:
                status = "IN_TRANSIT"
            on_time_val = None
        else:
            # All shipments delivered
            if all_shipments_on_time:
                status = "DELIVERED_ON_TIME"
                on_time_val = 1
            else:
                status = "DELIVERED_LATE"
                on_time_val = 0

        return OrderDeliveryOutcome(
            order_id=order_id,
            order_time=order_time,
            requested_service=requested_service,
            allocated_node_groups=allocated_node_groups,
            shipment_count=shipment_count,
            delivered_shipment_count=delivered_count,
            latest_actual_delivery_date=latest_actual,
            latest_promised_delivery_date=latest_promised,
            delayed_shipment_count=delayed_count,
            delivery_outcome_status=status,
            delivery_completed=is_completed,
            delivery_on_time=on_time_val
        )

    def load_order_tracking_from_db(self, order_id: str) -> Tuple[List[ShipmentRecord], List[TrackingEventRecord]]:
        """
        Loads existing shipments and tracking events for an order from SQLite.
        Guarantees zero modification to historical records.
        """
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Query shipments
            cursor.execute("SELECT * FROM shipments WHERE order_id = ?", (order_id,))
            shipments = [
                ShipmentRecord(
                    shipment_id=r["shipment_id"],
                    order_id=r["order_id"],
                    node_id=r["node_id"],
                    carrier_id=r["carrier_id"],
                    service_level_id=r["service_level_id"],
                    delivery_promise_id=r["delivery_promise_id"],
                    dispatch_date=r["dispatch_date"],
                    promised_delivery_date=r["promised_delivery_date"],
                    actual_delivery_date=r["actual_delivery_date"],
                    shipment_status=r["shipment_status"],
                    is_delayed=int(r["is_delayed"]),
                    delay_days=int(r["delay_days"]),
                    package_line_count=int(r["package_line_count"]),
                    package_unit_count=int(r["package_unit_count"])
                )
                for r in cursor.fetchall()
            ]

            # Query tracking events
            cursor.execute("SELECT * FROM tracking_events WHERE order_id = ? ORDER BY event_sequence", (order_id,))
            events = [
                TrackingEventRecord(
                    tracking_event_id=r["tracking_event_id"],
                    shipment_id=r["shipment_id"],
                    order_id=r["order_id"],
                    event_sequence=int(r["event_sequence"]),
                    event_type=r["event_type"],
                    event_timestamp=r["event_timestamp"],
                    event_location=r["event_location"],
                    event_description=r["event_description"]
                )
                for r in cursor.fetchall()
            ]

        return shipments, events
