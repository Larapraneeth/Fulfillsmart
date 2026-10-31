"""
FulfillSmart FastAPI Application Entrypoint
Mounts middleware, registers modular API routers, configures OpenAPI metadata,
and establishes global exception handling.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError, HTTPException

from src.config import settings
from src.api.middleware import (
    RequestTracingAndSecurityMiddleware,
    http_exception_handler,
    validation_exception_handler,
    unhandled_exception_handler
)
from src.api.routers import (
    health,
    allocation,
    carrier,
    tracking,
    anomalies,
    metrics,
    simulation,
    analytics,
    orders,
    network
)


def create_app() -> FastAPI:
    """Application factory for FulfillSmart REST API."""
    app = FastAPI(
        title="FulfillSmart Logistics Optimization API",
        version=settings.version,
        description=(
            "Production-quality REST API for E-Commerce Fulfillment Node Selection, "
            "Carrier Selection & Delivery Promises, Shipment Lifecycle Tracking, "
            "Deterministic Anomaly Detection, Operational Metrics, and What-If Scenario Simulations."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json"
    )

    # 1. Mount Request Tracing & Security Middleware (Before CORS)
    app.add_middleware(RequestTracingAndSecurityMiddleware)

    # 2. Mount CORS Middleware with Explicit Origin Whitelist
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "X-Process-Time-Ms"]
    )

    # 3. Register Genuine RFC 7807 Exception Handlers
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

    # 4. Include Routers
    app.include_router(health.router)
    app.include_router(allocation.router)
    app.include_router(carrier.router)
    app.include_router(tracking.router)
    app.include_router(anomalies.router)
    app.include_router(metrics.router)
    app.include_router(simulation.router)
    app.include_router(analytics.router)
    app.include_router(orders.router)
    app.include_router(network.router)

    return app



# Export application singleton for uvicorn
app = create_app()
