"""
FulfillSmart Health and System Diagnostics Router
Provides distinct liveness (/health) and readiness (/ready) probes.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
import sqlite3

from src.config import settings
from src.db import get_db
from src.api.dependencies import verify_api_key

router = APIRouter(tags=["System & Diagnostics"])


@router.get("/health", summary="Liveness probe", status_code=status.HTTP_200_OK)
def liveness_probe():
    """
    Immediate liveness check.
    Returns 200 OK without database overhead. Used by load balancers and orchestrators.
    """
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.version,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/ready", summary="Readiness probe", status_code=status.HTTP_200_OK)
def readiness_probe():
    """
    Service readiness check.
    Validates SQLite database connectivity and master table availability.
    Returns 503 if database connection fails or tables are inaccessible.
    """
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")
            table_count = cursor.fetchone()[0]

            if table_count < 25:
                raise RuntimeError(f"Database schema incomplete: found {table_count} tables.")

            return {
                "status": "ready",
                "service": settings.app_name,
                "database": "connected",
                "table_count": table_count,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Service not ready: database connection check failed ({str(ex)})"
        )


@router.get(
    "/api/v1/system/info",
    summary="System information and configuration metadata",
    dependencies=[Depends(verify_api_key)]
)
def system_info():
    """Returns runtime configuration, storage paths, and active policy parameters."""
    return {
        "app_name": settings.app_name,
        "version": settings.version,
        "environment": settings.environment,
        "timezone": settings.timezone,
        "database_path": str(settings.database_path),
        "allocation_policy": {
            "ordering_policy": settings.ordering_policy,
            "sunday_handling": settings.sunday_handling,
            "distance_metric": settings.distance_metric,
            "single_node_preference": settings.single_node_preference
        },
        "carrier_policy": {
            "strict_service_level": settings.strict_service_level,
            "allow_silent_downgrades": settings.allow_silent_downgrades,
            "exclude_sundays": settings.exclude_sundays,
            "exclude_holidays": settings.exclude_holidays
        }
    }
