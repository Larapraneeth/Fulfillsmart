r"""
FulfillSmart Deterministic Business-Rule Anomaly Detector
Inspects operational and test scenario fields independently against the six agreed business invariants:
1. ALLOCATION_EXCEEDS_AVAILABLE_STOCK (CRITICAL)
2. CARRIER_UNSUPPORTED_ZONE (HIGH)
3. DELIVERED_BEFORE_DISPATCH (CRITICAL)
4. INCORRECT_SPLIT_SHIPMENT_STATUS_ROLLUP (HIGH)
5. PROMISE_BEFORE_ORDER (HIGH)
6. WAREHOUSE_CAPACITY_EXCEEDED (CRITICAL)

CRITICAL: The detector evaluates field data directly and never relies on ground-truth labels.
"""
from dataclasses import dataclass
from datetime import datetime, date, timezone
from typing import Dict, List, Optional, Tuple, Any
import sqlite3

from src.db import get_db


@dataclass
class AnomalyFinding:
    case_id: Optional[str]
    entity_id: str
    entity_type: str
    anomaly_type: str
    severity: str  # CRITICAL, HIGH, MEDIUM, LOW
    explanation: str
    detected_at_utc: str = ""

    def __post_init__(self):
        if not self.detected_at_utc:
            self.detected_at_utc = datetime.now(timezone.utc).isoformat()


class AnomalyDetector:
    """
    Deterministic anomaly detector verifying domain business rules.
    """
    def __init__(self, load_coverage_matrix: bool = True):
        self._coverage_matrix: Dict[Tuple[str, str, str], bool] = {}
        if load_coverage_matrix:
            self._load_carrier_coverage()

    def _load_carrier_coverage(self) -> None:
        """Loads master carrier zone coverage for service level checking."""
        try:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT carrier_id, delivery_zone_id, standard_available, express_available, same_day_available
                    FROM carrier_service_zones
                """)
                for r in cursor.fetchall():
                    c_id = r["carrier_id"]
                    z_id = r["delivery_zone_id"]
                    self._coverage_matrix[(c_id, z_id, "STANDARD")] = bool(r["standard_available"])
                    self._coverage_matrix[(c_id, z_id, "EXPRESS")] = bool(r["express_available"])
                    self._coverage_matrix[(c_id, z_id, "SAME_DAY")] = bool(r["same_day_available"])
        except Exception:
            # Fallback if DB not ready
            pass

    # ==========================================
    # 1. ALLOCATION EXCEEDS AVAILABLE STOCK
    # ==========================================
    def inspect_allocation(
        self,
        order_id: str,
        node_id: str,
        sku_id: str,
        allocated_qty: int,
        available_qty: int,
        case_id: Optional[str] = None
    ) -> Optional[AnomalyFinding]:
        """Violation: allocated_qty > available_qty for a given SKU at a warehouse node."""
        if allocated_qty > available_qty:
            return AnomalyFinding(
                case_id=case_id,
                entity_id=order_id,
                entity_type="ALLOCATION",
                anomaly_type="ALLOCATION_EXCEEDS_AVAILABLE_STOCK",
                severity="CRITICAL",
                explanation=f"Allocated quantity ({allocated_qty}) exceeds available on-hand stock ({available_qty}) at warehouse {node_id} for SKU {sku_id}."
            )
        return None

    # ==========================================
    # 2. CARRIER UNSUPPORTED ZONE
    # ==========================================
    def inspect_carrier_selection(
        self,
        order_id: str,
        carrier_id: str,
        destination_zone_id: str,
        requested_service: str,
        is_zone_covered: Optional[bool] = None,
        case_id: Optional[str] = None
    ) -> Optional[AnomalyFinding]:
        """Violation: Assigned carrier does not support requested service level for destination zone."""
        service = requested_service.upper()
        if is_zone_covered is not None:
            covered = is_zone_covered
        else:
            covered = self._coverage_matrix.get((carrier_id, destination_zone_id, service), False)

        if not covered:
            return AnomalyFinding(
                case_id=case_id,
                entity_id=order_id,
                entity_type="CARRIER_SELECTION",
                anomaly_type="CARRIER_UNSUPPORTED_ZONE",
                severity="HIGH",
                explanation=f"Carrier {carrier_id} does not support service level {service} in destination zone {destination_zone_id}."
            )
        return None

    # ==========================================
    # 3. DELIVERED BEFORE DISPATCH
    # ==========================================
    def inspect_shipment_delivery(
        self,
        shipment_id: str,
        dispatch_date: str,
        actual_delivery_date: str,
        pickup_timestamp: Optional[str] = None,
        delivery_timestamp: Optional[str] = None,
        case_id: Optional[str] = None
    ) -> Optional[AnomalyFinding]:
        """Violation: actual delivery date is earlier than warehouse dispatch date."""
        is_violation = False
        reason = ""

        # Check dates
        try:
            d_dispatch = date.fromisoformat(dispatch_date[:10])
            d_delivery = date.fromisoformat(actual_delivery_date[:10])
            if d_delivery < d_dispatch:
                is_violation = True
                reason = f"Actual delivery date ({actual_delivery_date}) is earlier than warehouse dispatch date ({dispatch_date})."
        except Exception:
            pass

        # Check timestamps if available
        if not is_violation and pickup_timestamp and delivery_timestamp:
            try:
                ts_pickup = datetime.fromisoformat(pickup_timestamp)
                ts_delivery = datetime.fromisoformat(delivery_timestamp)
                if ts_delivery < ts_pickup:
                    is_violation = True
                    reason = f"Delivery timestamp ({delivery_timestamp}) precedes warehouse pickup timestamp ({pickup_timestamp})."
            except Exception:
                pass

        if is_violation:
            return AnomalyFinding(
                case_id=case_id,
                entity_id=shipment_id,
                entity_type="SHIPMENT",
                anomaly_type="DELIVERED_BEFORE_DISPATCH",
                severity="CRITICAL",
                explanation=reason
            )
        return None

    # ==========================================
    # 4. INCORRECT SPLIT SHIPMENT STATUS ROLLUP
    # ==========================================
    def inspect_split_rollup(
        self,
        order_id: str,
        shipments: List[Dict[str, Any]],
        reported_status: str,
        reported_on_time: Optional[int],
        reported_delayed_count: Optional[int] = None,
        case_id: Optional[str] = None
    ) -> Optional[AnomalyFinding]:
        """
        Violation: Multi-shipment order has contradictory or erroneous order-level rollup status.
        E.g.:
        - One or more shipments are delayed, but order is marked DELIVERED_ON_TIME or delivery_on_time == 1.
        - Not all shipments are completed, but order is marked DELIVERED_ON_TIME.
        - Reported delayed shipment count does not match actual count of delayed shipments.
        """
        if not shipments:
            return None

        actual_delayed_count = 0
        all_completed = True

        for s in shipments:
            s_actual = s.get("actual") or s.get("actual_delivery_date")
            s_promised = s.get("promised") or s.get("promised_delivery_date")
            s_delayed = s.get("is_delayed", 0)

            if not s_actual:
                all_completed = False
            elif s_delayed == 1 or (s_promised and s_actual > s_promised):
                actual_delayed_count += 1

        is_violation = False
        reasons = []

        # Check 1: Delayed shipments present but reported as on-time
        if actual_delayed_count > 0 and (reported_status == "DELIVERED_ON_TIME" or reported_on_time == 1):
            is_violation = True
            reasons.append(
                f"Order marked DELIVERED_ON_TIME despite {actual_delayed_count} delayed shipment(s) in split fulfillment."
            )

        # Check 2: Unfinished shipments but reported as delivered
        if not all_completed and reported_status in ("DELIVERED_ON_TIME", "DELIVERED_LATE"):
            is_violation = True
            reasons.append("Order marked as delivered before all constituent shipments completed delivery.")

        # Check 3: Delayed count mismatch
        if reported_delayed_count is not None and reported_delayed_count != actual_delayed_count:
            is_violation = True
            reasons.append(
                f"Reported delayed count ({reported_delayed_count}) does not match actual delayed shipments ({actual_delayed_count})."
            )

        if is_violation:
            return AnomalyFinding(
                case_id=case_id,
                entity_id=order_id,
                entity_type="DELIVERY_OUTCOME",
                anomaly_type="INCORRECT_SPLIT_SHIPMENT_STATUS_ROLLUP",
                severity="HIGH",
                explanation="; ".join(reasons)
            )
        return None

    # ==========================================
    # 5. PROMISE BEFORE ORDER
    # ==========================================
    def inspect_delivery_promise(
        self,
        order_id: str,
        order_time: str,
        dispatch_date: str,
        promised_delivery_date: str,
        case_id: Optional[str] = None
    ) -> Optional[AnomalyFinding]:
        """Violation: promised delivery date or dispatch date is earlier than order placement date."""
        try:
            d_order = date.fromisoformat(order_time[:10])
            d_promise = date.fromisoformat(promised_delivery_date[:10])
            d_dispatch = date.fromisoformat(dispatch_date[:10])

            if d_promise < d_order:
                return AnomalyFinding(
                    case_id=case_id,
                    entity_id=order_id,
                    entity_type="DELIVERY_PROMISE",
                    anomaly_type="PROMISE_BEFORE_ORDER",
                    severity="HIGH",
                    explanation=f"Promised delivery date ({promised_delivery_date}) is earlier than customer order date ({order_time[:10]})."
                )
            if d_dispatch < d_order:
                return AnomalyFinding(
                    case_id=case_id,
                    entity_id=order_id,
                    entity_type="DELIVERY_PROMISE",
                    anomaly_type="PROMISE_BEFORE_ORDER",
                    severity="HIGH",
                    explanation=f"Dispatch date ({dispatch_date}) is earlier than customer order date ({order_time[:10]})."
                )
        except Exception:
            pass
        return None

    # ==========================================
    # 6. WAREHOUSE CAPACITY EXCEEDED
    # ==========================================
    def inspect_warehouse_capacity(
        self,
        node_id: str,
        capacity_date: str,
        max_orders: int,
        max_units: int,
        allocated_orders: int,
        allocated_units: int,
        case_id: Optional[str] = None
    ) -> Optional[AnomalyFinding]:
        """Violation: allocated orders or allocated units exceed maximum warehouse daily capacity."""
        orders_exceeded = allocated_orders > max_orders
        units_exceeded = allocated_units > max_units

        if orders_exceeded or units_exceeded:
            details = []
            if orders_exceeded:
                details.append(f"allocated orders ({allocated_orders}) > max orders ({max_orders})")
            if units_exceeded:
                details.append(f"allocated units ({allocated_units}) > max units ({max_units})")

            return AnomalyFinding(
                case_id=case_id,
                entity_id=f"{node_id}_{capacity_date}",
                entity_type="WAREHOUSE_CAPACITY",
                anomaly_type="WAREHOUSE_CAPACITY_EXCEEDED",
                severity="CRITICAL",
                explanation=f"Warehouse capacity exceeded at node {node_id} on {capacity_date}: {', '.join(details)}."
            )
        return None

    # ==========================================
    # UNIVERSAL PAYLOAD DETECTOR
    # ==========================================
    def detect_scenario(
        self,
        payload: Dict[str, Any],
        case_id: Optional[str] = None
    ) -> Optional[AnomalyFinding]:
        """
        Dynamically detects which business rule (if any) is violated by a scenario payload.
        Independently checks all 6 invariant categories based on payload fields.
        """
        # 1. Allocation check
        if "allocated_qty" in payload and "available_qty" in payload:
            res = self.inspect_allocation(
                order_id=payload.get("order_id", ""),
                node_id=payload.get("node_id", ""),
                sku_id=payload.get("sku_id", ""),
                allocated_qty=int(payload["allocated_qty"]),
                available_qty=int(payload["available_qty"]),
                case_id=case_id
            )
            if res:
                return res

        # 2. Carrier unsupported zone check
        if "carrier_id" in payload and "destination_zone_id" in payload:
            is_covered = payload.get("is_zone_covered")
            if is_covered is None:
                is_covered = payload.get("service_available_in_zone")
            res = self.inspect_carrier_selection(
                order_id=payload.get("order_id", ""),
                carrier_id=payload["carrier_id"],
                destination_zone_id=payload["destination_zone_id"],
                requested_service=payload.get("requested_service", "STANDARD"),
                is_zone_covered=is_covered,
                case_id=case_id
            )
            if res:
                return res

        # 3. Delivered before dispatch check
        if "dispatch_date" in payload and "actual_delivery_date" in payload:
            res = self.inspect_shipment_delivery(
                shipment_id=payload.get("shipment_id", payload.get("order_id", "")),
                dispatch_date=payload["dispatch_date"],
                actual_delivery_date=payload["actual_delivery_date"],
                pickup_timestamp=payload.get("pickup_timestamp"),
                delivery_timestamp=payload.get("delivery_timestamp"),
                case_id=case_id
            )
            if res:
                return res

        # 4. Split shipment status rollup check
        if "shipments" in payload and ("reported_delivery_outcome_status" in payload or "reported_status" in payload):
            res = self.inspect_split_rollup(
                order_id=payload.get("order_id", ""),
                shipments=payload["shipments"],
                reported_status=payload.get("reported_delivery_outcome_status") or payload.get("reported_status", ""),
                reported_on_time=payload.get("reported_delivery_on_time"),
                reported_delayed_count=payload.get("delayed_shipment_count"),
                case_id=case_id
            )
            if res:
                return res

        # 5. Promise before order check
        if "order_time" in payload and ("promised_delivery_date" in payload or "dispatch_date" in payload):
            res = self.inspect_delivery_promise(
                order_id=payload.get("order_id", ""),
                order_time=payload["order_time"],
                dispatch_date=payload.get("dispatch_date", payload.get("promised_delivery_date", "")),
                promised_delivery_date=payload.get("promised_delivery_date", ""),
                case_id=case_id
            )
            if res:
                return res

        # 6. Warehouse capacity exceeded check
        if "max_orders" in payload and "allocated_orders" in payload:
            res = self.inspect_warehouse_capacity(
                node_id=payload.get("node_id", ""),
                capacity_date=payload.get("capacity_date", ""),
                max_orders=int(payload["max_orders"]),
                max_units=int(payload.get("max_units", 999999)),
                allocated_orders=int(payload["allocated_orders"]),
                allocated_units=int(payload.get("allocated_units", 0)),
                case_id=case_id
            )
            if res:
                return res

        return None
