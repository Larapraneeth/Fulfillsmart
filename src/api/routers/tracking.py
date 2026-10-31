"""
FulfillSmart Shipment Tracking & Rollup Router
Implements event lifecycle validation, multi-shipment order rollups, and tracking history lookups.
"""
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Query, status
import sqlite3

from src.db import get_db
from src.engine.tracking import TrackingEventRecord, ShipmentRecord
from src.api.dependencies import verify_api_key, get_tracking_engine
from src.api.schemas.tracking import (
    ValidateLifecycleRequestSchema,
    LifecycleValidationResultSchema,
    OrderRollupRequestSchema,
    OrderDeliveryOutcomeSchema,
    TrackingEventSchema,
    DelayDistributionItemSchema,
    CarrierDeliveryPerformanceItemSchema,
    NodeDeliveryPerformanceItemSchema,
    TrackingOverviewSummarySchema,
    TrackingOverviewResponseSchema,
    ShipmentExplorerItemSchema,
    ShipmentPaginatedResponseSchema,
    ShipmentDetailResponseSchema
)
from src.api.schemas.common import ApiResponseEnvelope

router = APIRouter(prefix="/api/v1/tracking", tags=["Shipment Tracking & Order Rollup"])


@router.post(
    "/validate-events",
    response_model=ApiResponseEnvelope[LifecycleValidationResultSchema],
    summary="Validate shipment tracking event sequence (Stateless In-Memory)",
    dependencies=[Depends(verify_api_key)]
)
def validate_lifecycle_events(
    payload: ValidateLifecycleRequestSchema,
    request: Request,
    tracking_engine=Depends(get_tracking_engine)
):
    """
    Validates the contiguous sequencing (1, 2, 3...) and chronological ordering
    of tracking events for a shipment parcel.
    """
    domain_events = [
        TrackingEventRecord(
            tracking_event_id=ev.tracking_event_id,
            shipment_id=ev.shipment_id,
            order_id=ev.order_id,
            event_sequence=ev.event_sequence,
            event_type=ev.event_type,
            event_timestamp=ev.event_timestamp,
            event_location=ev.event_location,
            event_description=ev.event_description
        )
        for ev in payload.events
    ]

    res = tracking_engine.validate_lifecycle_events(payload.shipment_id, domain_events)

    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(
        status="success",
        data=LifecycleValidationResultSchema(
            shipment_id=res.shipment_id,
            is_valid=res.is_valid,
            event_count=res.event_count,
            terminal_status=res.terminal_status,
            violations=res.violations
        ),
        request_id=request_id
    )


@router.post(
    "/rollup",
    response_model=ApiResponseEnvelope[OrderDeliveryOutcomeSchema],
    summary="Compute order delivery outcome rollup across shipments (Stateless In-Memory)",
    dependencies=[Depends(verify_api_key)]
)
def rollup_order_delivery(
    payload: OrderRollupRequestSchema,
    request: Request,
    tracking_engine=Depends(get_tracking_engine)
):
    """
    Computes unified order-level delivery outcome.
    Strictly evaluates every shipment against its own promise date:
    An order is DELIVERED_ON_TIME only if all assigned shipments are delivered on or before promise date.
    """
    domain_shipments = [
        ShipmentRecord(
            shipment_id=s.shipment_id,
            order_id=s.order_id,
            node_id=s.node_id,
            carrier_id=s.carrier_id,
            service_level_id=s.service_level_id,
            delivery_promise_id=s.delivery_promise_id,
            dispatch_date=s.dispatch_date,
            promised_delivery_date=s.promised_delivery_date,
            actual_delivery_date=s.actual_delivery_date,
            shipment_status=s.shipment_status,
            is_delayed=s.is_delayed,
            delay_days=s.delay_days,
            package_line_count=s.package_line_count,
            package_unit_count=s.package_unit_count
        )
        for s in payload.shipments
    ]

    outcome = tracking_engine.calculate_order_rollup(
        order_id=payload.order_id,
        order_time=payload.order_time,
        requested_service=payload.requested_service,
        allocated_node_groups=payload.allocated_node_groups,
        shipments=domain_shipments
    )

    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(
        status="success",
        data=OrderDeliveryOutcomeSchema(
            order_id=outcome.order_id,
            order_time=outcome.order_time,
            requested_service=outcome.requested_service,
            allocated_node_groups=outcome.allocated_node_groups,
            shipment_count=outcome.shipment_count,
            delivered_shipment_count=outcome.delivered_shipment_count,
            latest_actual_delivery_date=outcome.latest_actual_delivery_date,
            latest_promised_delivery_date=outcome.latest_promised_delivery_date,
            delayed_shipment_count=outcome.delayed_shipment_count,
            delivery_outcome_status=outcome.delivery_outcome_status,
            delivery_completed=outcome.delivery_completed,
            delivery_on_time=outcome.delivery_on_time
        ),
        request_id=request_id
    )


@router.get(
    "/history/{order_id}",
    response_model=ApiResponseEnvelope[Dict[str, Any]],
    summary="Query historical shipment tracking events and delivery outcome (Read-Only)",
    dependencies=[Depends(verify_api_key)]
)
def get_order_tracking_history(
    order_id: str,
    request: Request,
    tracking_engine=Depends(get_tracking_engine)
):
    """Retrieves baseline historical shipments, tracking events, and delivery outcome from SQLite."""
    shipments, events = tracking_engine.load_order_tracking_from_db(order_id)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM delivery_outcomes WHERE order_id = ?", (order_id,))
        outcome_row = cursor.fetchone()

    if not shipments and not outcome_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Historical tracking records for order '{order_id}' were not found."
        )

    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(
        status="success",
        data={
            "order_id": order_id,
            "delivery_outcome": dict(outcome_row) if outcome_row else None,
            "shipments_count": len(shipments),
            "tracking_events_count": len(events),
            "shipments": [s.__dict__ for s in shipments],
            "tracking_events": [e.__dict__ for e in events]
        },
        request_id=request_id
    )


@router.get(
    "/overview",
    response_model=ApiResponseEnvelope[TrackingOverviewResponseSchema],
    summary="Query tracking overview KPIs, delay distribution, carrier and node performance",
    dependencies=[Depends(verify_api_key)]
)
def get_tracking_overview(request: Request):
    """
    Returns verified aggregate shipment tracking metrics across the 49,436 historical shipments
    and 100,000 tracking events, including delay duration distribution, carrier performance,
    and fulfillment node delivery comparisons.
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # 1. Summary KPIs
        cursor.execute("SELECT COUNT(*) FROM orders")
        total_orders = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM delivery_outcomes WHERE delivery_outcome_status = 'CARRIER_UNAVAILABLE'")
        carrier_unavailable_orders = cursor.fetchone()[0]
        assigned_orders = total_orders - carrier_unavailable_orders

        cursor.execute("SELECT COUNT(*), SUM(is_delayed) FROM shipments")
        s_row = cursor.fetchone()
        total_shipments = s_row[0]
        delayed_shipments = s_row[1]
        ontime_shipments = total_shipments - delayed_shipments

        cursor.execute("SELECT event_type, COUNT(*) FROM tracking_events GROUP BY event_type")
        event_counts = dict(cursor.fetchall())
        picked_up_events = event_counts.get("PICKED_UP", 0)
        delay_events = event_counts.get("DELAYED", 0)
        delivered_events = event_counts.get("DELIVERED", 0)
        total_tracking_events = picked_up_events + delay_events + delivered_events

        summary = TrackingOverviewSummarySchema(
            total_orders=total_orders,
            assigned_orders=assigned_orders,
            carrier_unavailable_orders=carrier_unavailable_orders,
            carrier_unavailable_rate_pct=round((carrier_unavailable_orders / total_orders) * 100, 3) if total_orders else 0.0,
            total_shipments=total_shipments,
            delivered_shipments=total_shipments,
            in_transit_shipments=0,  # Terminal historical outcomes
            on_time_shipments=ontime_shipments,
            delayed_shipments=delayed_shipments,
            shipment_on_time_rate_pct=round((ontime_shipments / total_shipments) * 100, 2) if total_shipments else 0.0,
            shipment_delay_rate_pct=round((delayed_shipments / total_shipments) * 100, 2) if total_shipments else 0.0,
            total_tracking_events=total_tracking_events,
            picked_up_events=picked_up_events,
            delay_events=delay_events,
            delivered_events=delivered_events,
        )

        # 2. Delay Distribution
        cursor.execute("""
            SELECT delay_days, COUNT(*) as cnt
            FROM shipments
            WHERE is_delayed = 1
            GROUP BY delay_days
            ORDER BY delay_days ASC
        """)
        delay_rows = cursor.fetchall()
        delay_distribution = [
            DelayDistributionItemSchema(
                delay_days=int(r["delay_days"]),
                count=int(r["cnt"]),
                percentage=round((int(r["cnt"]) / delayed_shipments) * 100, 2) if delayed_shipments else 0.0
            )
            for r in delay_rows
        ]

        # 3. Carrier Delivery Performance
        cursor.execute("""
            SELECT 
                c.carrier_id, c.carrier_name,
                COUNT(s.shipment_id) as shipment_count,
                SUM(s.is_delayed) as delayed_shipments,
                ROUND((1.0 - CAST(SUM(s.is_delayed) AS FLOAT) / COUNT(s.shipment_id)) * 100.0, 2) as on_time_rate_pct,
                ROUND(AVG(s.delay_days), 4) as average_delay_days
            FROM carriers c
            JOIN shipments s ON c.carrier_id = s.carrier_id
            GROUP BY c.carrier_id, c.carrier_name
            ORDER BY shipment_count DESC
        """)
        carrier_perf_rows = cursor.fetchall()
        carrier_performance = [
            CarrierDeliveryPerformanceItemSchema(
                carrier_id=r["carrier_id"],
                carrier_name=r["carrier_name"],
                shipment_count=int(r["shipment_count"]),
                delayed_shipments=int(r["delayed_shipments"]),
                on_time_rate_pct=float(r["on_time_rate_pct"]),
                average_delay_days=float(r["average_delay_days"])
            )
            for r in carrier_perf_rows
        ]

        # 4. Node Delivery Performance
        cursor.execute("""
            SELECT 
                fn.node_id, fn.node_name, fn.city, fn.state,
                COUNT(s.shipment_id) as shipment_count,
                SUM(s.is_delayed) as delayed_shipments,
                ROUND((1.0 - CAST(SUM(s.is_delayed) AS FLOAT) / COUNT(s.shipment_id)) * 100.0, 2) as on_time_rate_pct,
                ROUND(AVG(s.delay_days), 4) as average_delay_days
            FROM fulfillment_nodes fn
            JOIN shipments s ON fn.node_id = s.node_id
            GROUP BY fn.node_id, fn.node_name, fn.city, fn.state
            ORDER BY shipment_count DESC
        """)
        node_perf_rows = cursor.fetchall()
        node_performance = [
            NodeDeliveryPerformanceItemSchema(
                node_id=r["node_id"],
                node_name=r["node_name"],
                city=r["city"],
                state=r["state"],
                shipment_count=int(r["shipment_count"]),
                delayed_shipments=int(r["delayed_shipments"]),
                on_time_rate_pct=float(r["on_time_rate_pct"]),
                average_delay_days=float(r["average_delay_days"])
            )
            for r in node_perf_rows
        ]

    overview_data = TrackingOverviewResponseSchema(
        summary=summary,
        delay_distribution=delay_distribution,
        carrier_performance=carrier_performance,
        node_performance=node_performance
    )
    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(status="success", data=overview_data, request_id=request_id)


@router.get(
    "/shipments",
    response_model=ApiResponseEnvelope[ShipmentPaginatedResponseSchema],
    summary="Query paginated shipments with search and multi-dimensional filters",
    dependencies=[Depends(verify_api_key)]
)
def get_shipments_paginated(
    request: Request,
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(default=None, description="Search shipment ID, order ID, or destination city"),
    carrier_id: Optional[str] = Query(default=None, description="Carrier filter (e.g. CAR-001)"),
    node_id: Optional[str] = Query(default=None, description="Fulfillment node filter (e.g. FUL-2026-000001)"),
    is_delayed: Optional[int] = Query(default=None, ge=0, le=1, description="Delay filter: 0 for on-time, 1 for delayed"),
    service_code: Optional[str] = Query(default=None, description="Service level code (STANDARD, EXPRESS, SAME_DAY)")
):
    """
    Returns server-side paginated shipments matching filter criteria with full metadata,
    tracking events count, and split-order indicators.
    """
    where_clauses = ["1=1"]
    params = []

    if search and search.strip():
        q = search.strip()
        where_clauses.append("(s.shipment_id LIKE ? OR s.order_id LIKE ? OR o.destination_city LIKE ?)")
        params.extend([f"%{q}%", f"%{q}%", f"%{q}%"])

    if carrier_id and carrier_id.strip() and carrier_id != "ALL":
        where_clauses.append("s.carrier_id = ?")
        params.append(carrier_id.strip())

    if node_id and node_id.strip() and node_id != "ALL":
        where_clauses.append("s.node_id = ?")
        params.append(node_id.strip())

    if is_delayed is not None:
        where_clauses.append("s.is_delayed = ?")
        params.append(is_delayed)

    if service_code and service_code.strip() and service_code != "ALL":
        where_clauses.append("sl.service_code = ?")
        params.append(service_code.strip().upper())

    where_sql = " AND ".join(where_clauses)

    count_query = f"""
        SELECT COUNT(*)
        FROM shipments s
        JOIN service_levels sl ON s.service_level_id = sl.service_level_id
        JOIN orders o ON s.order_id = o.order_id
        WHERE {where_sql}
    """

    offset = (page - 1) * page_size
    data_query = f"""
        SELECT 
            s.shipment_id, s.order_id, s.node_id, fn.node_name, fn.city as node_city,
            s.carrier_id, c.carrier_name,
            s.service_level_id, sl.service_name, sl.service_code,
            o.destination_city, o.destination_zone_id,
            s.dispatch_date, s.promised_delivery_date, s.actual_delivery_date,
            s.shipment_status, s.is_delayed, s.delay_days,
            s.package_line_count, s.package_unit_count,
            (SELECT COUNT(*) FROM tracking_events te WHERE te.shipment_id = s.shipment_id) as events_count,
            CASE WHEN (SELECT COUNT(*) FROM shipments s2 WHERE s2.order_id = s.order_id) > 1 THEN 1 ELSE 0 END as is_split
        FROM shipments s
        JOIN fulfillment_nodes fn ON s.node_id = fn.node_id
        JOIN carriers c ON s.carrier_id = c.carrier_id
        JOIN service_levels sl ON s.service_level_id = sl.service_level_id
        JOIN orders o ON s.order_id = o.order_id
        WHERE {where_sql}
        ORDER BY s.dispatch_date DESC, s.shipment_id DESC
        LIMIT ? OFFSET ?
    """

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(count_query, params)
        total_count = cursor.fetchone()[0]

        data_params = list(params) + [page_size, offset]
        cursor.execute(data_query, data_params)
        rows = cursor.fetchall()

    items = [
        ShipmentExplorerItemSchema(
            shipment_id=r["shipment_id"],
            order_id=r["order_id"],
            node_id=r["node_id"],
            node_name=r["node_name"],
            node_city=r["node_city"],
            carrier_id=r["carrier_id"],
            carrier_name=r["carrier_name"],
            service_level_id=r["service_level_id"],
            service_name=r["service_name"],
            service_code=r["service_code"],
            destination_city=r["destination_city"],
            destination_zone_id=r["destination_zone_id"],
            dispatch_date=r["dispatch_date"],
            promised_delivery_date=r["promised_delivery_date"],
            actual_delivery_date=r["actual_delivery_date"],
            shipment_status=r["shipment_status"],
            is_delayed=int(r["is_delayed"]),
            delay_days=int(r["delay_days"]),
            package_line_count=int(r["package_line_count"]),
            package_unit_count=int(r["package_unit_count"]),
            events_count=int(r["events_count"]),
            is_split=bool(r["is_split"])
        )
        for r in rows
    ]

    total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1
    paginated_data = ShipmentPaginatedResponseSchema(
        items=items,
        total_count=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_previous=page > 1
    )

    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(status="success", data=paginated_data, request_id=request_id)


@router.get(
    "/shipment/{shipment_id}",
    response_model=ApiResponseEnvelope[ShipmentDetailResponseSchema],
    summary="Query detailed shipment metadata, chronological event timeline, and split-order context",
    dependencies=[Depends(verify_api_key)]
)
def get_shipment_detail(
    shipment_id: str,
    request: Request
):
    """
    Retrieves full details for a shipment parcel: origin fulfillment node, assigned carrier,
    service tier, promised and actual delivery dates, complete chronological tracking events,
    parent order metadata, and sibling shipments if part of a split order.
    """
    clean_id = shipment_id.strip().upper()

    with get_db() as conn:
        cursor = conn.cursor()

        # 1. Shipment record
        cursor.execute("""
            SELECT 
                s.shipment_id, s.order_id, s.node_id, fn.node_name, fn.city as node_city,
                s.carrier_id, c.carrier_name,
                s.service_level_id, sl.service_name, sl.service_code,
                o.destination_city, o.destination_zone_id,
                s.dispatch_date, s.promised_delivery_date, s.actual_delivery_date,
                s.shipment_status, s.is_delayed, s.delay_days,
                s.package_line_count, s.package_unit_count,
                (SELECT COUNT(*) FROM tracking_events te WHERE te.shipment_id = s.shipment_id) as events_count,
                CASE WHEN (SELECT COUNT(*) FROM shipments s2 WHERE s2.order_id = s.order_id) > 1 THEN 1 ELSE 0 END as is_split
            FROM shipments s
            JOIN fulfillment_nodes fn ON s.node_id = fn.node_id
            JOIN carriers c ON s.carrier_id = c.carrier_id
            JOIN service_levels sl ON s.service_level_id = sl.service_level_id
            JOIN orders o ON s.order_id = o.order_id
            WHERE s.shipment_id = ?
        """, (clean_id,))
        s_row = cursor.fetchone()

        if not s_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Shipment '{clean_id}' was not found in historical records."
            )

        shipment_item = ShipmentExplorerItemSchema(
            shipment_id=s_row["shipment_id"],
            order_id=s_row["order_id"],
            node_id=s_row["node_id"],
            node_name=s_row["node_name"],
            node_city=s_row["node_city"],
            carrier_id=s_row["carrier_id"],
            carrier_name=s_row["carrier_name"],
            service_level_id=s_row["service_level_id"],
            service_name=s_row["service_name"],
            service_code=s_row["service_code"],
            destination_city=s_row["destination_city"],
            destination_zone_id=s_row["destination_zone_id"],
            dispatch_date=s_row["dispatch_date"],
            promised_delivery_date=s_row["promised_delivery_date"],
            actual_delivery_date=s_row["actual_delivery_date"],
            shipment_status=s_row["shipment_status"],
            is_delayed=int(s_row["is_delayed"]),
            delay_days=int(s_row["delay_days"]),
            package_line_count=int(s_row["package_line_count"]),
            package_unit_count=int(s_row["package_unit_count"]),
            events_count=int(s_row["events_count"]),
            is_split=bool(s_row["is_split"])
        )

        # 2. Chronological tracking events
        cursor.execute("""
            SELECT * FROM tracking_events
            WHERE shipment_id = ?
            ORDER BY event_sequence ASC
        """, (clean_id,))
        events_rows = cursor.fetchall()
        events = [
            TrackingEventSchema(
                tracking_event_id=r["tracking_event_id"],
                shipment_id=r["shipment_id"],
                order_id=r["order_id"],
                event_sequence=int(r["event_sequence"]),
                event_type=r["event_type"],
                event_timestamp=r["event_timestamp"],
                event_location=r["event_location"],
                event_description=r["event_description"]
            )
            for r in events_rows
        ]

        # 3. Parent order details
        order_id = s_row["order_id"]
        cursor.execute("SELECT * FROM orders WHERE order_id = ?", (order_id,))
        o_row = cursor.fetchone()
        parent_order = dict(o_row) if o_row else None

        # 4. Delivery outcome for parent order
        cursor.execute("SELECT * FROM delivery_outcomes WHERE order_id = ?", (order_id,))
        do_row = cursor.fetchone()
        delivery_outcome = None
        if do_row:
            delivery_outcome = OrderDeliveryOutcomeSchema(
                order_id=do_row["order_id"],
                order_time=do_row["order_time"],
                requested_service=do_row["requested_service"],
                allocated_node_groups=do_row["allocated_node_groups"],
                shipment_count=do_row["shipment_count"],
                delivered_shipment_count=do_row["delivered_shipment_count"],
                latest_actual_delivery_date=do_row["latest_actual_delivery_date"],
                latest_promised_delivery_date=do_row["latest_promised_delivery_date"],
                delayed_shipment_count=do_row["delayed_shipment_count"],
                delivery_outcome_status=do_row["delivery_outcome_status"],
                delivery_completed=do_row["delivery_completed"],
                delivery_on_time=do_row["delivery_on_time"]
            )

        # 5. Sibling shipments for split orders
        cursor.execute("""
            SELECT 
                s.shipment_id, s.order_id, s.node_id, fn.node_name, fn.city as node_city,
                s.carrier_id, c.carrier_name,
                s.service_level_id, sl.service_name, sl.service_code,
                o.destination_city, o.destination_zone_id,
                s.dispatch_date, s.promised_delivery_date, s.actual_delivery_date,
                s.shipment_status, s.is_delayed, s.delay_days,
                s.package_line_count, s.package_unit_count,
                (SELECT COUNT(*) FROM tracking_events te WHERE te.shipment_id = s.shipment_id) as events_count,
                1 as is_split
            FROM shipments s
            JOIN fulfillment_nodes fn ON s.node_id = fn.node_id
            JOIN carriers c ON s.carrier_id = c.carrier_id
            JOIN service_levels sl ON s.service_level_id = sl.service_level_id
            JOIN orders o ON s.order_id = o.order_id
            WHERE s.order_id = ? AND s.shipment_id != ?
            ORDER BY s.shipment_id ASC
        """, (order_id, clean_id))
        sibling_rows = cursor.fetchall()
        sibling_shipments = [
            ShipmentExplorerItemSchema(
                shipment_id=r["shipment_id"],
                order_id=r["order_id"],
                node_id=r["node_id"],
                node_name=r["node_name"],
                node_city=r["node_city"],
                carrier_id=r["carrier_id"],
                carrier_name=r["carrier_name"],
                service_level_id=r["service_level_id"],
                service_name=r["service_name"],
                service_code=r["service_code"],
                destination_city=r["destination_city"],
                destination_zone_id=r["destination_zone_id"],
                dispatch_date=r["dispatch_date"],
                promised_delivery_date=r["promised_delivery_date"],
                actual_delivery_date=r["actual_delivery_date"],
                shipment_status=r["shipment_status"],
                is_delayed=int(r["is_delayed"]),
                delay_days=int(r["delay_days"]),
                package_line_count=int(r["package_line_count"]),
                package_unit_count=int(r["package_unit_count"]),
                events_count=int(r["events_count"]),
                is_split=True
            )
            for r in sibling_rows
        ]

    detail_data = ShipmentDetailResponseSchema(
        shipment=shipment_item,
        tracking_events=events,
        parent_order=parent_order,
        delivery_outcome=delivery_outcome,
        sibling_shipments=sibling_shipments
    )
    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(status="success", data=detail_data, request_id=request_id)

