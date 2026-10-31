"""
FulfillSmart API Dependencies
Provides database sessions, constant-time API key security, and request-scoped engine lifecycle management.
"""
import os
import secrets
import sqlite3
from typing import Generator, Optional
from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader

from src.config import settings
from src.db import get_db_dep
from src.engine.allocation import TransactionalAllocationState, FulfillmentAllocationEngine
from src.engine.carrier_selection import CarrierSelectionEngine
from src.engine.tracking import ShipmentTrackingEngine
from src.engine.anomaly_detector import AnomalyDetector
from src.engine.anomaly_harness import AnomalyEvaluationHarness
from src.engine.simulation import SimulationEngine
from src.engine.scenario_comparator import ScenarioComparator
from src.metrics.service import MetricsService

# API Key Header dependency
api_key_header_scheme = APIKeyHeader(name="X-API-Key", auto_error=False)


# Re-export the FastAPI-compatible plain generator dependency.
# Use get_db_dep in Depends() calls; use `with get_db() as conn:` for synchronous code.
get_db = get_db_dep  # noqa: F401  – exported for router convenience


def verify_api_key(
    api_key: Optional[str] = Security(api_key_header_scheme)
) -> str:
    """
    Validates API key using constant-time comparison against FULFILLSMART_API_KEY environment variable.
    Fails safely if missing or mismatched.
    """
    expected_key = os.getenv("FULFILLSMART_API_KEY") or settings.api_key
    
    if not expected_key:
        # In production mode, missing key is a server configuration failure
        if settings.environment in ["production", "prod"]:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Server configuration error: FULFILLSMART_API_KEY is not configured."
            )
        # In testing/dev mode, if no key configured, reject by default
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing server API key configuration. Set FULFILLSMART_API_KEY in environment."
        )

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing required 'X-API-Key' authentication header."
        )

    if not secrets.compare_digest(api_key, expected_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid 'X-API-Key' authentication credential."
        )

    return api_key


def get_request_scoped_allocation_engine(
    allow_splits: bool = True
) -> FulfillmentAllocationEngine:
    """
    Creates an isolated, request-scoped allocation engine.
    Guarantees that order line evaluations never share mutable inventory or capacity state
    across concurrent API requests or leak staged reservations.
    """
    state = TransactionalAllocationState(simulation_mode=True, scenario_id="request_scoped_evaluation")
    return FulfillmentAllocationEngine(state=state, allow_splits=allow_splits)


# Read-only and stateless engine singletons
_carrier_engine = CarrierSelectionEngine()
_tracking_engine = ShipmentTrackingEngine()
_anomaly_detector = AnomalyDetector()
_anomaly_harness = AnomalyEvaluationHarness()
_metrics_service = MetricsService()
_simulation_engine = SimulationEngine()
_scenario_comparator = ScenarioComparator()


def get_carrier_engine() -> CarrierSelectionEngine:
    return _carrier_engine


def get_tracking_engine() -> ShipmentTrackingEngine:
    return _tracking_engine


def get_anomaly_detector() -> AnomalyDetector:
    return _anomaly_detector


def get_anomaly_harness() -> AnomalyEvaluationHarness:
    return _anomaly_harness


def get_metrics_service() -> MetricsService:
    return _metrics_service


def get_simulation_engine() -> SimulationEngine:
    return _simulation_engine


def get_scenario_comparator() -> ScenarioComparator:
    return _scenario_comparator
