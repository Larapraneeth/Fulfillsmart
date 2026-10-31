r"""
Focused Test Suite: Carrier Selection and Delivery Promise Engine
Verifies exact service level coverage (no silent downgrades), pickup cutoff thresholds,
working transit business days excluding Sundays & holidays, and exception handling.
"""
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.engine.carrier_selection import (
    CarrierSelectionEngine,
    CarrierPromiseRequest
)


@pytest.fixture
def carrier_engine():
    """Create a fresh carrier selection engine instance."""
    return CarrierSelectionEngine()


def test_standard_transit_skips_sunday(carrier_engine):
    """
    Verify 4-business-day STANDARD delivery dispatched on Friday skips Sunday.
    Friday 2026-05-22:
      - Day 1: Saturday 2026-05-23
      - Sunday 2026-05-24: SKIPPED (non-working)
      - Day 2: Monday 2026-05-25
      - Day 3: Tuesday 2026-05-26
      - Day 4: Wednesday 2026-05-27
    Promised date must be 2026-05-27 (matches historical order ORD-2026-019142).
    """
    promised = carrier_engine.calculate_delivery_promise_date(
        dispatch_date_str="2026-05-22",
        nominal_days=4,
        dest_state="Haryana"
    )
    assert promised == "2026-05-27"


def test_holiday_exclusion_in_transit_calculation(carrier_engine):
    """
    Verify synthetic holidays from holidays.csv are excluded from transit business days.
    HOL-001: 2026-01-26 (Republic Day, state_scope=ALL, is_working_day=False)
    Dispatched Friday 2026-01-23, EXPRESS service (2 business days):
      - Day 1: Saturday 2026-01-24
      - Sunday 2026-01-25: SKIPPED (Sunday)
      - Monday 2026-01-26: SKIPPED (Republic Day holiday!)
      - Day 2: Tuesday 2026-01-27
    Promised date must be 2026-01-27.
    """
    promised = carrier_engine.calculate_delivery_promise_date(
        dispatch_date_str="2026-01-23",
        nominal_days=2,
        dest_state="Delhi"
    )
    assert promised == "2026-01-27"


def test_pickup_cutoff_before_cutoff_dispatches_same_day(carrier_engine):
    """Verify order arriving before pickup cutoff dispatches on the allocation date."""
    req = CarrierPromiseRequest(
        order_id="TEST-CUTOFF-EARLY",
        node_id="FUL-2026-000001",
        delivery_zone_id="DZ-001",
        requested_service="STANDARD",
        allocation_date="2026-05-20",  # Wednesday
        order_time="2026-05-20T08:30:00+05:30",  # 8:30 AM (well before 12:00 cutoff)
        allocated_line_count=1,
        allocated_unit_count=2
    )
    
    outcome = carrier_engine.select_carrier_and_promise(req)
    assert outcome.is_success is True
    # Must dispatch on same day: 2026-05-20
    assert outcome.dispatch_date == "2026-05-20"


def test_pickup_cutoff_after_cutoff_advances_dispatch_date(carrier_engine):
    """Verify order arriving after pickup cutoff advances dispatch date to the next operating day."""
    req = CarrierPromiseRequest(
        order_id="TEST-CUTOFF-LATE",
        node_id="FUL-2026-000001",
        delivery_zone_id="DZ-001",
        requested_service="STANDARD",
        allocation_date="2026-05-20",  # Wednesday
        order_time="2026-05-20T22:30:00+05:30",  # 10:30 PM (after all pickup cutoffs)
        allocated_line_count=1,
        allocated_unit_count=2
    )
    
    outcome = carrier_engine.select_carrier_and_promise(req)
    assert outcome.is_success is True
    # Must advance to next operating day: 2026-05-21 (Thursday)
    assert outcome.dispatch_date == "2026-05-21"


def test_strict_service_level_enforcement_no_silent_downgrade(carrier_engine):
    """Verify that when customer requests EXPRESS, selected carrier service is strictly EXPRESS."""
    req = CarrierPromiseRequest(
        order_id="TEST-EXPRESS",
        node_id="FUL-2026-000001",
        delivery_zone_id="DZ-001",
        requested_service="EXPRESS",
        allocation_date="2026-05-20",
        order_time="2026-05-20T10:00:00+05:30",
        allocated_line_count=1,
        allocated_unit_count=1
    )
    
    outcome = carrier_engine.select_carrier_and_promise(req)
    assert outcome.is_success is True
    assert outcome.selected_service == "EXPRESS"
    assert outcome.transit_business_days == 2


def test_same_day_delivery_promise_date(carrier_engine):
    """Verify SAME_DAY delivery promise date is identical to dispatch date."""
    # Zone DZ-006 (Mumbai) supports SAME_DAY on CAR-001
    req = CarrierPromiseRequest(
        order_id="TEST-SAMEDAY",
        node_id="FUL-2026-000003",
        delivery_zone_id="DZ-006",
        requested_service="SAME_DAY",
        allocation_date="2026-05-20",
        order_time="2026-05-20T08:00:00+05:30",
        allocated_line_count=1,
        allocated_unit_count=1
    )
    
    outcome = carrier_engine.select_carrier_and_promise(req)
    assert outcome.is_success is True
    assert outcome.selected_service == "SAME_DAY"
    assert outcome.transit_business_days == 0
    assert outcome.promised_delivery_date == outcome.dispatch_date


def test_unsupported_zone_service_returns_exception(carrier_engine):
    """Verify requesting SAME_DAY in an unsupported zone returns promise exception."""
    # DZ-015 (Shimla) does not have same-day carrier coverage
    req = CarrierPromiseRequest(
        order_id="TEST-EXCEPTION",
        node_id="FUL-2026-000004",
        delivery_zone_id="DZ-015",
        requested_service="SAME_DAY",
        allocation_date="2026-05-20",
        order_time="2026-05-20T10:00:00+05:30",
        allocated_line_count=1,
        allocated_unit_count=1
    )
    
    outcome = carrier_engine.select_carrier_and_promise(req)
    assert outcome.is_success is False
    assert outcome.exception_code == "NO_ELIGIBLE_CARRIER_OR_CUTOFF_MISSED"
    assert "No carrier matched requested service" in outcome.explanation
