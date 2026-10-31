"""Analytics router – provides read‑only historical KPI endpoints.
All calculations are based on the immutable historical database and must not modify any data.
"""

from fastapi import APIRouter, Depends, Request, HTTPException, status
from typing import List

from src.db import get_db_dep
from src.api.dependencies import verify_api_key
from src.api.schemas.analytics import (
    OverviewSchema,
    TrendsResponseSchema,
    FulfillmentResponseSchema,
    CarriersResponseSchema,
    DeliveryResponseSchema,
    AllocationResponseSchema,
    ExportResponseSchema,
)
from src.api.schemas.common import ApiResponseEnvelope

router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics"])

# ---------------------------------------------------------------------------
# Helper queries – isolated in this module for clarity.
# ---------------------------------------------------------------------------

def _get_overview(conn) -> OverviewSchema:
    cur = conn.cursor()
    # Total orders & shipments
    cur.execute("SELECT COUNT(*) FROM orders")
    total_orders = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM shipments")
    total_shipments = cur.fetchone()[0]
    # Allocation success – orders with allocation decisions (including splits)
    cur.execute("SELECT COUNT(DISTINCT order_id) FROM allocation_decisions")
    allocated_orders = cur.fetchone()[0]
    allocation_success_rate = round(allocated_orders / total_orders * 100, 2)
    # On‑time delivery – shipments with is_delayed = 0
    cur.execute("SELECT COUNT(*) FROM shipments WHERE is_delayed = 0")
    on_time_shipments = cur.fetchone()[0]
    shipment_on_time_rate = round(on_time_shipments / total_shipments * 100, 2)
    # Order‑level on‑time – orders whose all shipments are on‑time
    cur.execute("""
        SELECT COUNT(DISTINCT o.order_id)
        FROM orders o
        JOIN shipments s ON o.order_id = s.order_id
        GROUP BY o.order_id
        HAVING SUM(CASE WHEN s.is_delayed = 1 THEN 1 ELSE 0 END) = 0
    """)
    order_on_time = cur.fetchone()[0]
    order_on_time_rate = round(order_on_time / total_orders * 100, 2)
    # Carrier unavailable count from promise_exceptions
    cur.execute("SELECT COUNT(DISTINCT order_id) FROM promise_exceptions")
    carrier_unavailable = cur.fetchone()[0]
    # Delayed shipments count and pct
    cur.execute("SELECT COUNT(*) FROM shipments WHERE is_delayed = 1")
    delayed_shipments = cur.fetchone()[0]
    delayed_pct = round(delayed_shipments / total_shipments * 100, 2)
    return OverviewSchema(
        total_orders=total_orders,
        total_shipments=total_shipments,
        allocation_success_rate_pct=allocation_success_rate,
        order_on_time_rate_pct=order_on_time_rate,
        shipment_on_time_rate_pct=shipment_on_time_rate,
        carrier_unavailable_count=carrier_unavailable,
        delayed_shipments=delayed_shipments,
        delayed_shipments_pct=delayed_pct,
    )

def _get_monthly_trends(conn) -> TrendsResponseSchema:
    cur = conn.cursor()
    cur.execute("""
        SELECT
            substr(o.order_time,1,7) AS month,
            COUNT(DISTINCT o.order_id) AS orders,
            COUNT(s.shipment_id) AS shipments,
            SUM(CASE WHEN s.is_delayed = 0 THEN 1 ELSE 0 END) AS on_time_shipments,
            SUM(CASE WHEN s.is_delayed = 1 THEN 1 ELSE 0 END) AS delayed_shipments,
            SUM(CASE WHEN ad.order_id IS NOT NULL THEN 1 ELSE 0 END) AS allocation_successful,
            SUM(CASE WHEN ad.order_id IS NULL THEN 1 ELSE 0 END) AS allocation_failed
        FROM orders o
        LEFT JOIN shipments s ON o.order_id = s.order_id
        LEFT JOIN (
            SELECT DISTINCT order_id FROM allocation_decisions
        ) ad ON o.order_id = ad.order_id
        GROUP BY month
        ORDER BY month ASC;
    """)
    rows = cur.fetchall()
    items = []
    for r in rows:
        items.append(
            {
                "month": r["month"],
                "orders": r["orders"],
                "shipments": r["shipments"],
                "on_time_shipments": r["on_time_shipments"],
                "delayed_shipments": r["delayed_shipments"],
                "allocation_successful": r["allocation_successful"],
                "allocation_failed": r["allocation_failed"],
            }
        )
    return TrendsResponseSchema(monthly=items)

def _get_fulfillment(conn) -> FulfillmentResponseSchema:
    cur = conn.cursor()
    cur.execute("""
        SELECT
            fn.node_id,
            COALESCE(SUM(wc.max_orders),0) AS capacity_total,
            COALESCE(SUM(ad.allocated_qty),0) AS capacity_used,
            COUNT(DISTINCT ad.order_id) AS allocated_orders,
            COALESCE(SUM(ad.allocated_qty),0) AS allocated_units
        FROM fulfillment_nodes fn
        LEFT JOIN warehouse_capacity wc ON fn.node_id = wc.node_id
        LEFT JOIN allocation_decisions ad ON fn.node_id = ad.node_id
        GROUP BY fn.node_id
    """)
    rows = cur.fetchall()
    nodes = []
    for r in rows:
        utilization = round(r["capacity_used"] / r["capacity_total"] * 100, 2) if r["capacity_total"] else 0.0
        nodes.append(
            {
                "node_id": r["node_id"],
                "capacity_total": r["capacity_total"],
                "capacity_used": r["capacity_used"],
                "utilization_pct": utilization,
                "allocated_orders": r["allocated_orders"],
                "allocated_units": r["allocated_units"],
            }
        )
    return FulfillmentResponseSchema(nodes=nodes)

def _get_carriers(conn) -> CarriersResponseSchema:
    cur = conn.cursor()
    cur.execute("""
        SELECT
            c.carrier_id,
            COUNT(s.shipment_id) AS total_shipments,
            SUM(CASE WHEN s.is_delayed = 0 THEN 1 ELSE 0 END) AS on_time_shipments,
            SUM(CASE WHEN s.is_delayed = 1 THEN 1 ELSE 0 END) AS delayed_shipments
        FROM carriers c
        LEFT JOIN shipments s ON c.carrier_id = s.carrier_id
        GROUP BY c.carrier_id
    """)
    rows = cur.fetchall()
    carriers = []
    for r in rows:
        total = r["total_shipments"]
        on_time = r["on_time_shipments"]
        delayed = r["delayed_shipments"]
        on_time_pct = round(on_time / total * 100, 2) if total else 0.0
        delayed_pct = round(delayed / total * 100, 2) if total else 0.0
        carriers.append(
            {
                "carrier_id": r["carrier_id"],
                "total_shipments": total,
                "on_time_shipments": on_time,
                "delayed_shipments": delayed,
                "on_time_pct": on_time_pct,
                "delayed_pct": delayed_pct,
            }
        )
    return CarriersResponseSchema(carriers=carriers)

def _get_delivery(conn) -> DeliveryResponseSchema:
    cur = conn.cursor()
    cur.execute("""
        SELECT
            CASE WHEN is_delayed = 0 THEN 'ON_TIME' ELSE 'DELAYED' END AS outcome,
            COUNT(*) AS cnt
        FROM shipments
        GROUP BY outcome
    """)
    rows = cur.fetchall()
    total_ship = cur.execute("SELECT COUNT(*) FROM shipments").fetchone()[0]
    outcomes = []
    for r in rows:
        pct = round(r["cnt"] / total_ship * 100, 2) if total_ship else 0.0
        outcomes.append({"outcome": r["outcome"], "count": r["cnt"], "pct_of_shipments": pct})
    # Add UNRESOLVED (carrier unavailable) as separate outcome derived from promise_exceptions
    cur.execute("SELECT COUNT(DISTINCT order_id) FROM promise_exceptions")
    unresolved = cur.fetchone()[0]
    outcomes.append({"outcome": "UNRESOLVED", "count": unresolved, "pct_of_shipments": round(unresolved / total_ship * 100, 2) if total_ship else 0.0})
    return DeliveryResponseSchema(outcomes=outcomes)

def _get_allocation(conn) -> AllocationResponseSchema:
    cur = conn.cursor()
    # total orders
    cur.execute("SELECT COUNT(*) FROM orders")
    total_orders = cur.fetchone()[0]
    # successful allocations – orders with at least one decision
    cur.execute("SELECT COUNT(DISTINCT order_id) FROM allocation_decisions")
    successful = cur.fetchone()[0]
    failed = total_orders - successful
    # distribution single vs split
    cur.execute("""
        SELECT
            CASE WHEN allocated_node_count = 1 THEN 'single_node' ELSE 'split_order' END AS type,
            COUNT(*) AS cnt
        FROM order_allocation_summary
        GROUP BY type
    """)
    dist_rows = cur.fetchall()
    distribution = []
    for r in dist_rows:
        pct = round(r["cnt"] / total_orders * 100, 2) if total_orders else 0.0
        distribution.append({"type": r["type"], "count": r["cnt"], "pct_of_orders": pct})
    return AllocationResponseSchema(
        total_orders=total_orders,
        successful_allocations=successful,
        failed_allocations=failed,
        distribution=distribution,
    )

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/overview", response_model=ApiResponseEnvelope[OverviewSchema], summary="Historical analytics overview")
def get_overview(request: Request, db=Depends(get_db_dep), api_key=Depends(verify_api_key)):
    data = _get_overview(db)
    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(status="success", data=data, request_id=request_id)

@router.get("/trends", response_model=ApiResponseEnvelope[TrendsResponseSchema], summary="Monthly analytics trends")
def get_trends(request: Request, db=Depends(get_db_dep), api_key=Depends(verify_api_key)):
    data = _get_monthly_trends(db)
    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(status="success", data=data, request_id=request_id)

@router.get("/fulfillment", response_model=ApiResponseEnvelope[FulfillmentResponseSchema], summary="Fulfillment node performance")
def get_fulfillment(request: Request, db=Depends(get_db_dep), api_key=Depends(verify_api_key)):
    data = _get_fulfillment(db)
    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(status="success", data=data, request_id=request_id)

@router.get("/carriers", response_model=ApiResponseEnvelope[CarriersResponseSchema], summary="Carrier performance metrics")
def get_carriers(request: Request, db=Depends(get_db_dep), api_key=Depends(verify_api_key)):
    data = _get_carriers(db)
    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(status="success", data=data, request_id=request_id)

@router.get("/delivery", response_model=ApiResponseEnvelope[DeliveryResponseSchema], summary="Delivery outcome distribution")
def get_delivery(request: Request, db=Depends(get_db_dep), api_key=Depends(verify_api_key)):
    data = _get_delivery(db)
    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(status="success", data=data, request_id=request_id)

@router.get("/allocation", response_model=ApiResponseEnvelope[AllocationResponseSchema], summary="Allocation success and split‑order distribution")
def get_allocation(request: Request, db=Depends(get_db_dep), api_key=Depends(verify_api_key)):
    data = _get_allocation(db)
    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(status="success", data=data, request_id=request_id)

@router.get("/export", response_model=ApiResponseEnvelope[ExportResponseSchema], summary="Export analytics data as CSV (placeholder)")
def get_export(request: Request, db=Depends(get_db_dep), api_key=Depends(verify_api_key)):
    # Placeholder implementation – in a real system this would generate a CSV and return a presigned URL.
    # For now we return None to indicate export not supported in this sandbox.
    return ApiResponseEnvelope(status="success", data=ExportResponseSchema(csv_url=None), request_id=getattr(request.state, "request_id", None))

