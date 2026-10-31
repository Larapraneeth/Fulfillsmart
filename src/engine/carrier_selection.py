r"""
FulfillSmart Carrier Selection and Delivery Promise Engine
Determines the optimal carrier, service level, dispatch date, and guaranteed delivery promise date
based on:
1. Destination delivery zone coverage (carrier_service_zones).
2. Exact requested service level matching (strict enforcement, NO silent downgrades).
3. Carrier operating calendars and daily pickup cutoff times (carrier_calendar).
4. Working transit business days calculation excluding Sundays and synthetic holidays (holidays).
5. Comprehensive decision explanation and exception logging.
"""
from dataclasses import dataclass
from datetime import datetime, date, time, timedelta
from typing import Dict, List, Optional, Tuple, Any
import sqlite3

from src.config import settings
from src.db import get_db


@dataclass
class CarrierPromiseRequest:
    order_id: str
    node_id: str
    delivery_zone_id: str
    requested_service: str  # STANDARD, EXPRESS, SAME_DAY
    allocation_date: str    # YYYY-MM-DD
    order_time: str         # ISO timestamp e.g. 2026-06-16T01:54:27+05:30
    allocated_line_count: int
    allocated_unit_count: int
    preferred_carrier_id: Optional[str] = None


@dataclass
class CarrierPromiseOutcome:
    carrier_selection_id: str
    order_id: str
    node_id: str
    delivery_zone_id: str
    carrier_id: str
    carrier_name: str
    service_level_id: str
    selected_service: str
    allocation_date: str
    dispatch_date: str
    pickup_cutoff_time: str
    delivery_promise_id: str
    promised_delivery_date: str
    transit_business_days: int
    promise_status: str
    explanation: str
    is_success: bool
    exception_code: Optional[str] = None
    exception_detail: Optional[str] = None


class CarrierSelectionEngine:
    """
    Deterministic Carrier Selection and Delivery Promise Engine.
    Evaluates zone coverage, operating calendars, pickup cutoffs, and transit calendars.
    """
    def __init__(self, initial_data: Optional[Dict[str, Any]] = None):
        self._carriers: Dict[str, Dict[str, Any]] = {}
        self._service_levels: Dict[Tuple[str, str], Dict[str, Any]] = {}
        self._service_zones: Dict[Tuple[str, str], Dict[str, bool]] = {}
        self._calendars: Dict[Tuple[str, str], Dict[str, Any]] = {}
        self._holidays: Dict[str, Dict[str, Any]] = {}
        self._zone_states: Dict[str, str] = {}
        
        self._selection_counter = 1
        self._promise_counter = 1
        
        if initial_data is not None:
            self._carriers = {k: dict(v) for k, v in initial_data.get("carriers", {}).items()}
            self._service_levels = {k: dict(v) for k, v in initial_data.get("service_levels", {}).items()}
            self._service_zones = {k: dict(v) for k, v in initial_data.get("service_zones", {}).items()}
            self._calendars = {k: dict(v) for k, v in initial_data.get("calendars", {}).items()}
            self._holidays = {k: dict(v) for k, v in initial_data.get("holidays", {}).items()}
            self._zone_states = dict(initial_data.get("zone_states", {}))
        else:
            self._load_master_data()

    def _load_master_data(self) -> None:
        """Load carrier coverage, calendars, service levels, and holidays into fast memory structures."""
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Carriers
            cursor.execute("SELECT carrier_id, carrier_name, carrier_type, supports_reverse_logistics FROM carriers WHERE is_active = 1")
            for r in cursor.fetchall():
                self._carriers[r["carrier_id"]] = {
                    "carrier_name": r["carrier_name"],
                    "carrier_type": r["carrier_type"],
                    "supports_reverse_logistics": bool(r["supports_reverse_logistics"])
                }
                
            # Service Levels
            cursor.execute("""
                SELECT service_level_id, carrier_id, service_code, service_name, nominal_transit_days, priority_rank, max_weight_kg
                FROM service_levels WHERE is_active = 1
            """)
            for r in cursor.fetchall():
                key = (r["carrier_id"], r["service_code"].upper())
                self._service_levels[key] = {
                    "service_level_id": r["service_level_id"],
                    "service_name": r["service_name"],
                    "nominal_transit_days": int(r["nominal_transit_days"]),
                    "priority_rank": int(r["priority_rank"]),
                    "max_weight_kg": float(r["max_weight_kg"])
                }
                
            # Carrier Service Zones Coverage
            cursor.execute("""
                SELECT carrier_id, delivery_zone_id, standard_available, express_available, same_day_available
                FROM carrier_service_zones
            """)
            for r in cursor.fetchall():
                key = (r["carrier_id"], r["delivery_zone_id"])
                self._service_zones[key] = {
                    "STANDARD": bool(r["standard_available"]),
                    "EXPRESS": bool(r["express_available"]),
                    "SAME_DAY": bool(r["same_day_available"])
                }
                
            # Carrier Calendar
            cursor.execute("""
                SELECT carrier_id, calendar_date, is_operating_day, pickup_cutoff_time, dispatch_window_start, dispatch_window_end
                FROM carrier_calendar
            """)
            for r in cursor.fetchall():
                key = (r["carrier_id"], r["calendar_date"])
                self._calendars[key] = {
                    "is_operating_day": bool(r["is_operating_day"]),
                    "pickup_cutoff_time": r["pickup_cutoff_time"],
                    "dispatch_window_start": r["dispatch_window_start"],
                    "dispatch_window_end": r["dispatch_window_end"]
                }
                
            # Holidays
            cursor.execute("SELECT holiday_date, holiday_name, state_scope, is_working_day FROM holidays")
            for r in cursor.fetchall():
                self._holidays[r["holiday_date"]] = {
                    "holiday_name": r["holiday_name"],
                    "state_scope": r["state_scope"],
                    "is_working_day": bool(r["is_working_day"])
                }
                
            # Delivery zone states
            cursor.execute("SELECT delivery_zone_id, state FROM delivery_zones")
            for r in cursor.fetchall():
                self._zone_states[r["delivery_zone_id"]] = r["state"]

    def is_holiday(self, check_date: str, dest_state: str) -> bool:
        """Check if date is a non-working holiday for the destination region."""
        hol = self._holidays.get(check_date)
        if not hol:
            return False
        if hol["is_working_day"]:
            return False
        scope = hol["state_scope"]
        return scope == "ALL" or scope.lower() == dest_state.lower()

    def calculate_delivery_promise_date(
        self,
        dispatch_date_str: str,
        nominal_days: int,
        dest_state: str
    ) -> str:
        """
        Calculate promised delivery date by advancing working days from dispatch date.
        Strictly excludes Sundays and synthetic holidays from holidays.csv.
        """
        curr = date.fromisoformat(dispatch_date_str)
        
        # SAME_DAY service (0 transit days): delivery occurs on dispatch date
        if nominal_days == 0:
            return curr.isoformat()
            
        remaining_transit_days = nominal_days
        while remaining_transit_days > 0:
            curr += timedelta(days=1)
            
            # Exclude Sundays
            if curr.weekday() == 6:
                continue
                
            # Exclude synthetic holidays
            if self.is_holiday(curr.isoformat(), dest_state):
                continue
                
            remaining_transit_days -= 1
            
        return curr.isoformat()

    def select_carrier_and_promise(self, req: CarrierPromiseRequest) -> CarrierPromiseOutcome:
        """
        Evaluate candidate carriers and calculate the delivery promise for an allocated order-node group.
        Enforces:
        - Exact service coverage (no silent service downgrades)
        - Pickup cutoff time validation on operating days
        - Exclusion of Sundays and holidays in transit calculation
        """
        service = req.requested_service.upper()
        dest_zone = req.delivery_zone_id
        dest_state = self._zone_states.get(dest_zone, "")
        alloc_date_obj = date.fromisoformat(req.allocation_date)
        
        # Parse order placement time (HH:MM:SS)
        try:
            order_dt = datetime.fromisoformat(req.order_time)
            order_tod = order_dt.time()
        except Exception:
            order_tod = time(12, 0, 0)
            
        eligible_candidates = []
        
        for carrier_id, carrier_info in self._carriers.items():
            if req.preferred_carrier_id and carrier_id != req.preferred_carrier_id:
                continue
                
            # 1. Check Zone Coverage for the EXACT requested service
            coverage = self._service_zones.get((carrier_id, dest_zone), {})
            if not coverage.get(service, False):
                continue  # Carrier does not cover zone for requested service
                
            # 2. Check Service Level Definition
            sl_info = self._service_levels.get((carrier_id, service))
            if not sl_info:
                continue
                
            # 3. Search for earliest dispatch date meeting operating day and pickup cutoff (up to 7 days)
            dispatch_date = None
            pickup_cutoff_str = "12:00"
            
            for day_offset in range(settings.cutoff_search_window_days):
                candidate_date = alloc_date_obj + timedelta(days=day_offset)
                c_date_str = candidate_date.isoformat()
                cal = self._calendars.get((carrier_id, c_date_str))
                
                if not cal or not cal["is_operating_day"]:
                    continue  # Non-operating day (e.g. Sunday or carrier closure)
                    
                cutoff_parts = cal["pickup_cutoff_time"].split(":")
                cutoff_time = time(int(cutoff_parts[0]), int(cutoff_parts[1]))
                pickup_cutoff_str = cal["pickup_cutoff_time"]
                
                if day_offset == 0:
                    # Same-day allocation: check if order time meets cutoff
                    if order_tod <= cutoff_time:
                        dispatch_date = c_date_str
                        break
                else:
                    # Future operating day: package is pre-staged, cutoff is satisfied
                    dispatch_date = c_date_str
                    break
                    
            if not dispatch_date:
                continue  # Missed cutoff across entire 7-day search window
                
            # 4. Calculate Promised Delivery Date
            promised_date = self.calculate_delivery_promise_date(
                dispatch_date_str=dispatch_date,
                nominal_days=sl_info["nominal_transit_days"],
                dest_state=dest_state
            )
            
            eligible_candidates.append({
                "carrier_id": carrier_id,
                "carrier_name": carrier_info["carrier_name"],
                "service_level_id": sl_info["service_level_id"],
                "dispatch_date": dispatch_date,
                "pickup_cutoff_time": pickup_cutoff_str,
                "promised_delivery_date": promised_date,
                "transit_business_days": sl_info["nominal_transit_days"],
                "priority_rank": sl_info["priority_rank"]
            })
            
        if not eligible_candidates:
            # Exception: No carrier matched coverage, service level, or available cutoff
            return CarrierPromiseOutcome(
                carrier_selection_id="",
                order_id=req.order_id,
                node_id=req.node_id,
                delivery_zone_id=req.delivery_zone_id,
                carrier_id="",
                carrier_name="",
                service_level_id="",
                selected_service=service,
                allocation_date=req.allocation_date,
                dispatch_date="",
                pickup_cutoff_time="",
                delivery_promise_id="",
                promised_delivery_date="",
                transit_business_days=0,
                promise_status="EXCEPTION",
                explanation=f"No carrier matched requested service {service} in zone {dest_zone} with an available pickup cutoff within 7 days.",
                is_success=False,
                exception_code="NO_ELIGIBLE_CARRIER_OR_CUTOFF_MISSED",
                exception_detail=f"No carrier matched the requested service, destination coverage and an available pickup cutoff within the next seven days."
            )

        # 5. Select Best Carrier: Earliest Promised Date first, then highest priority rank
        eligible_candidates.sort(key=lambda x: (x["promised_delivery_date"], x["priority_rank"], x["carrier_id"]))
        best = eligible_candidates[0]
        
        cs_id = f"CS-{self._selection_counter:08d}"
        dp_id = f"DP-{self._promise_counter:08d}"
        self._selection_counter += 1
        self._promise_counter += 1
        
        explanation = (
            f"Selected {best['carrier_name']} ({best['carrier_id']}) for service {service}. "
            f"Dispatch on {best['dispatch_date']} (cutoff {best['pickup_cutoff_time']}). "
            f"Guaranteed delivery on {best['promised_delivery_date']} ({best['transit_business_days']} working transit days, excluding Sundays & holidays)."
        )

        return CarrierPromiseOutcome(
            carrier_selection_id=cs_id,
            order_id=req.order_id,
            node_id=req.node_id,
            delivery_zone_id=req.delivery_zone_id,
            carrier_id=best["carrier_id"],
            carrier_name=best["carrier_name"],
            service_level_id=best["service_level_id"],
            selected_service=service,
            allocation_date=req.allocation_date,
            dispatch_date=best["dispatch_date"],
            pickup_cutoff_time=best["pickup_cutoff_time"],
            delivery_promise_id=dp_id,
            promised_delivery_date=best["promised_delivery_date"],
            transit_business_days=best["transit_business_days"],
            promise_status="INITIAL",
            explanation=explanation,
            is_success=True
        )
