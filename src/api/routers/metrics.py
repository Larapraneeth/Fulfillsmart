"""
FulfillSmart Operational Metrics & KPI Router
Exposes historical performance summaries, carrier scorecards, warehouse utilization, and monthly delivery trends.
"""
from typing import List
from fastapi import APIRouter, Depends, Request

from src.api.dependencies import verify_api_key, get_metrics_service
from src.api.schemas.metrics import (
    KpiItemSchema,
    CarrierPerformanceItemSchema,
    WarehouseUtilizationItemSchema,
    MonthlyTrendItemSchema,
    HeadlineSummarySchema
)
from src.api.schemas.common import ApiResponseEnvelope

router = APIRouter(prefix="/api/v1/metrics", tags=["Metrics & Analytics"])


@router.get(
    "/kpi-summary",
    response_model=ApiResponseEnvelope[List[KpiItemSchema]],
    summary="Query all 20 operational KPIs (Historical & Strict definitions)",
    dependencies=[Depends(verify_api_key)]
)
def get_kpi_summary(
    request: Request,
    metrics_svc=Depends(get_metrics_service)
):
    """
    Returns all 20 operational KPIs:
    - Preserves exact historical Step 7 backward-compatible values (legacy artifact).
    - Exposes strict operational on-time KPIs excluding carrier-unavailable nulls.
    """
    kpis = metrics_svc.get_kpi_summary()
    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(
        status="success",
        data=[KpiItemSchema(**k) for k in kpis],
        request_id=request_id
    )


@router.get(
    "/carrier-performance",
    response_model=ApiResponseEnvelope[List[CarrierPerformanceItemSchema]],
    summary="Query carrier performance scorecard",
    dependencies=[Depends(verify_api_key)]
)
def get_carrier_performance(
    request: Request,
    metrics_svc=Depends(get_metrics_service)
):
    """Returns shipment volumes, delay counts, average/median delays, and on-time rates per carrier."""
    perf = metrics_svc.get_carrier_performance()
    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(
        status="success",
        data=[CarrierPerformanceItemSchema(**p) for p in perf],
        request_id=request_id
    )


@router.get(
    "/warehouse-utilization",
    response_model=ApiResponseEnvelope[List[WarehouseUtilizationItemSchema]],
    summary="Query warehouse utilization across active node-days",
    dependencies=[Depends(verify_api_key)]
)
def get_warehouse_utilization(
    request: Request,
    metrics_svc=Depends(get_metrics_service)
):
    """Returns allocated vs maximum orders and units with utilization percentages per fulfillment node."""
    util = metrics_svc.get_warehouse_utilization()
    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(
        status="success",
        data=[WarehouseUtilizationItemSchema(**u) for u in util],
        request_id=request_id
    )


@router.get(
    "/monthly-trends",
    response_model=ApiResponseEnvelope[List[MonthlyTrendItemSchema]],
    summary="Query monthly delivery outcome trend series",
    dependencies=[Depends(verify_api_key)]
)
def get_monthly_trends(
    request: Request,
    metrics_svc=Depends(get_metrics_service)
):
    """Returns delivery outcomes, on-time rates, and completion rates by month (Dec 2025 – Oct 2026)."""
    trends = metrics_svc.get_monthly_delivery_trends()
    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(
        status="success",
        data=[MonthlyTrendItemSchema(**t) for t in trends],
        request_id=request_id
    )


@router.get(
    "/headline",
    response_model=ApiResponseEnvelope[HeadlineSummarySchema],
    summary="Query executive headline KPI summary",
    dependencies=[Depends(verify_api_key)]
)
def get_headline(
    request: Request,
    metrics_svc=Depends(get_metrics_service)
):
    """Returns top-level executive snapshot: total orders, total shipments, on-time rate, and leaders."""
    headline = metrics_svc.get_headline_summary()
    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(
        status="success",
        data=HeadlineSummarySchema(**headline),
        request_id=request_id
    )
