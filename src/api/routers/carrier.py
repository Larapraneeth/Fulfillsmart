"""
FulfillSmart Carrier Selection & Delivery Promise Router
Implements deterministic carrier assignment, transit calculation, and historical promise lookups.
"""
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request, Query, status
import sqlite3

from src.db import get_db
from src.engine.carrier_selection import CarrierPromiseRequest
from src.api.dependencies import verify_api_key, get_carrier_engine
from src.api.schemas.carrier import (
    CarrierPromiseRequestSchema,
    CalculatePromiseRequestSchema,
    CarrierPromiseOutcomeSchema,
    CarrierOverviewResponseSchema,
    CarrierDetailResponseSchema,
    CarrierSummarySchema,
    CarrierItemSchema,
    CarrierServiceLevelDistributionSchema,
    ServiceLevelPerformanceItemSchema,
    MonthlyCarrierTrendItemSchema,
    CarrierShipmentItemSchema
)
from src.api.schemas.network import (
    CarrierZoneCoverageItemSchema,
    CarrierServiceZoneMatrixDataSchema
)
from src.api.schemas.common import ApiResponseEnvelope

router = APIRouter(prefix="/api/v1/carrier", tags=["Carrier Selection & Delivery Promises"])


@router.post(
    "/select",
    response_model=ApiResponseEnvelope[CarrierPromiseOutcomeSchema],
    summary="Evaluate carrier selection and delivery promise (Stateless In-Memory)",
    dependencies=[Depends(verify_api_key)]
)
def select_carrier(
    payload: CarrierPromiseRequestSchema,
    request: Request,
    carrier_engine=Depends(get_carrier_engine)
):
    """
    Evaluates carrier service zone coverage, operating calendars, cutoffs,
    and transit business days to select optimal carrier and calculate promise date.
    """
    domain_req = CarrierPromiseRequest(
        order_id=payload.order_id,
        node_id=payload.node_id,
        delivery_zone_id=payload.delivery_zone_id,
        requested_service=payload.requested_service,
        allocation_date=payload.allocation_date,
        order_time=payload.order_time,
        allocated_line_count=payload.allocated_line_count,
        allocated_unit_count=payload.allocated_unit_count,
        preferred_carrier_id=payload.preferred_carrier_id
    )

    res = carrier_engine.select_carrier_and_promise(domain_req)

    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(
        status="success",
        data=CarrierPromiseOutcomeSchema(
            carrier_selection_id=res.carrier_selection_id,
            order_id=res.order_id,
            node_id=res.node_id,
            delivery_zone_id=res.delivery_zone_id,
            carrier_id=res.carrier_id,
            carrier_name=res.carrier_name,
            service_level_id=res.service_level_id,
            selected_service=res.selected_service,
            allocation_date=res.allocation_date,
            dispatch_date=res.dispatch_date,
            pickup_cutoff_time=res.pickup_cutoff_time,
            delivery_promise_id=res.delivery_promise_id,
            promised_delivery_date=res.promised_delivery_date,
            transit_business_days=res.transit_business_days,
            promise_status=res.promise_status,
            explanation=res.explanation,
            is_success=res.is_success,
            exception_code=res.exception_code,
            exception_detail=res.exception_detail
        ),
        request_id=request_id
    )


@router.post(
    "/calculate-promise",
    response_model=ApiResponseEnvelope[Dict[str, str]],
    summary="Calculate promised delivery date from dispatch date and transit days",
    dependencies=[Depends(verify_api_key)]
)
def calculate_promise(
    payload: CalculatePromiseRequestSchema,
    request: Request,
    carrier_engine=Depends(get_carrier_engine)
):
    """Calculates promised delivery date advancing working days and skipping Sundays and synthetic holidays."""
    promise_date = carrier_engine.calculate_delivery_promise_date(
        dispatch_date_str=payload.dispatch_date,
        nominal_days=payload.nominal_days,
        dest_state=payload.dest_state
    )

    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(
        status="success",
        data={
            "dispatch_date": payload.dispatch_date,
            "nominal_days": str(payload.nominal_days),
            "dest_state": payload.dest_state,
            "promised_delivery_date": promise_date
        },
        request_id=request_id
    )


@router.get(
    "/history/{order_id}",
    response_model=ApiResponseEnvelope[Dict[str, Any]],
    summary="Query historical carrier selection and promise record (Read-Only)",
    dependencies=[Depends(verify_api_key)]
)
def get_carrier_history(
    order_id: str,
    request: Request
):
    """Retrieves baseline historical carrier selections and delivery promises for an order."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM carrier_selection WHERE order_id = ?", (order_id,))
        selections = [dict(r) for r in cursor.fetchall()]

        cursor.execute("SELECT * FROM delivery_promises WHERE order_id = ?", (order_id,))
        promises = [dict(r) for r in cursor.fetchall()]

    if not selections and not promises:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Historical carrier selection for order '{order_id}' was not found."
        )

    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(
        status="success",
        data={
            "carrier_selections": selections,
            "delivery_promises": promises
        },
        request_id=request_id
    )


@router.get(
    "/service-zones",
    response_model=ApiResponseEnvelope[CarrierServiceZoneMatrixDataSchema],
    summary="Query master carrier-to-zone service availability matrix",
    dependencies=[Depends(verify_api_key)]
)
def get_carrier_service_zones(
    request: Request,
    carrier_id: Optional[str] = Query(default=None, description="Optional carrier ID filter (e.g. CAR-001)"),
    delivery_zone_id: Optional[str] = Query(default=None, description="Optional delivery zone ID filter (e.g. DZ-010)")
):
    """
    Returns the master carrier service zone coverage matrix indicating Standard, Express,
    and Same-Day availability across delivery zones.
    """
    where_clauses = ["1=1"]
    params = []
    if carrier_id:
        where_clauses.append("csz.carrier_id = ?")
        params.append(carrier_id.strip())
    if delivery_zone_id:
        where_clauses.append("csz.delivery_zone_id = ?")
        params.append(delivery_zone_id.strip())

    where_sql = " AND ".join(where_clauses)

    query = f"""
        SELECT 
            csz.carrier_id,
            c.carrier_name,
            csz.delivery_zone_id,
            z.zone_name,
            z.city,
            z.state,
            z.region,
            csz.standard_available,
            csz.express_available,
            csz.same_day_available
        FROM carrier_service_zones csz
        JOIN carriers c ON csz.carrier_id = c.carrier_id
        JOIN delivery_zones z ON csz.delivery_zone_id = z.delivery_zone_id
        WHERE {where_sql}
        ORDER BY csz.carrier_id, csz.delivery_zone_id
    """

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT carrier_id, carrier_name FROM carriers WHERE is_active = 1 ORDER BY carrier_id")
        active_carriers = [{"carrier_id": r["carrier_id"], "carrier_name": r["carrier_name"]} for r in cursor.fetchall()]

        cursor.execute(query, params)
        rows = cursor.fetchall()

    coverage_items = [
        CarrierZoneCoverageItemSchema(
            carrier_id=r["carrier_id"],
            carrier_name=r["carrier_name"],
            delivery_zone_id=r["delivery_zone_id"],
            zone_name=r["zone_name"],
            city=r["city"],
            state=r["state"],
            region=r["region"],
            standard_available=bool(r["standard_available"]),
            express_available=bool(r["express_available"]),
            same_day_available=bool(r["same_day_available"])
        )
        for r in rows
    ]

    matrix_data = CarrierServiceZoneMatrixDataSchema(
        total_matrix_entries=len(coverage_items),
        carriers=active_carriers,
        coverage=coverage_items
    )

    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(status="success", data=matrix_data, request_id=request_id)


@router.get(
    "/overview",
    response_model=ApiResponseEnvelope[CarrierOverviewResponseSchema],
    summary="Query aggregate carrier performance scorecard, service level distribution, and monthly trends",
    dependencies=[Depends(verify_api_key)]
)
def get_carrier_overview(request: Request):
    """
    Returns verified aggregate carrier performance metrics across the 49,436 historical shipments,
    all 10 carriers with service level breakdowns and cutoffs, all 30 service level scorecards,
    and monthly trends by carrier.
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # 1. Summary
        cursor.execute("SELECT COUNT(*) FROM orders")
        total_orders = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*), SUM(is_delayed) FROM shipments")
        s_row = cursor.fetchone()
        total_shipments = s_row[0]
        delayed_shipments = s_row[1]
        ontime_shipments = total_shipments - delayed_shipments

        cursor.execute("SELECT COUNT(*) FROM delivery_outcomes WHERE delivery_outcome_status = 'CARRIER_UNAVAILABLE'")
        carrier_unavailable_orders = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM delivery_outcomes WHERE delivery_outcome_status = 'DELIVERED_ON_TIME'")
        strict_ontime_orders = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(DISTINCT order_id) FROM carrier_selection")
        orders_with_carrier = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM carriers WHERE is_active = 1")
        total_carriers = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM service_levels WHERE is_active = 1")
        total_service_levels = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM carrier_service_zones")
        total_service_zone_routes = cursor.fetchone()[0]

        summary = CarrierSummarySchema(
            total_orders=total_orders,
            total_shipments=total_shipments,
            delivered_on_time_shipments=ontime_shipments,
            delayed_shipments=delayed_shipments,
            shipment_on_time_rate_pct=round((ontime_shipments / total_shipments) * 100, 2) if total_shipments else 0.0,
            shipment_delay_rate_pct=round((delayed_shipments / total_shipments) * 100, 2) if total_shipments else 0.0,
            carrier_unavailable_orders=carrier_unavailable_orders,
            carrier_unavailable_rate_pct=round((carrier_unavailable_orders / total_orders) * 100, 3) if total_orders else 0.0,
            total_carriers=total_carriers,
            active_carriers=total_carriers,
            total_service_levels=total_service_levels,
            total_service_zone_routes=total_service_zone_routes,
            carrier_promise_coverage_rate_pct=round((orders_with_carrier / total_orders) * 100, 2) if total_orders else 0.0,
            strict_on_time_order_rate_pct=round((strict_ontime_orders / total_orders) * 100, 3) if total_orders else 0.0,
        )

        # 2. Service level distribution per carrier
        cursor.execute("""
            SELECT 
                s.carrier_id, sl.service_code, sl.service_name,
                COUNT(*) as shipment_cnt,
                SUM(s.is_delayed) as delayed_cnt,
                ROUND((1.0 - CAST(SUM(s.is_delayed) AS FLOAT) / COUNT(*)) * 100.0, 2) as on_time_rate_pct
            FROM shipments s
            JOIN service_levels sl ON s.service_level_id = sl.service_level_id
            GROUP BY s.carrier_id, sl.service_code, sl.service_name
            ORDER BY s.carrier_id, sl.service_code
        """)
        sl_dist_rows = cursor.fetchall()
        sl_dist_by_carrier: Dict[str, List[CarrierServiceLevelDistributionSchema]] = {}
        for r in sl_dist_rows:
            cid = r["carrier_id"]
            if cid not in sl_dist_by_carrier:
                sl_dist_by_carrier[cid] = []
            sl_dist_by_carrier[cid].append(CarrierServiceLevelDistributionSchema(
                service_code=r["service_code"],
                service_name=r["service_name"],
                shipment_count=r["shipment_cnt"],
                delayed_shipments=r["delayed_cnt"],
                on_time_rate_pct=r["on_time_rate_pct"]
            ))

        # 3. Carrier Items
        cursor.execute("""
            SELECT 
                c.carrier_id, c.carrier_name, c.carrier_type, c.supports_reverse_logistics, c.is_active,
                cp.shipment_count, cp.delayed_shipments, cp.average_delay_days, cp.median_delay_days,
                cp.on_time_rate_pct, cp.delay_rate_pct,
                MIN(cal.pickup_cutoff_time) as pickup_cutoff_time,
                MIN(cal.dispatch_window_start) as dispatch_window_start,
                MAX(cal.dispatch_window_end) as dispatch_window_end,
                (SELECT COUNT(*) FROM carrier_service_zones csz WHERE csz.carrier_id = c.carrier_id) as covered_zones_count
            FROM carriers c
            JOIN carrier_performance cp ON c.carrier_id = cp.carrier_id
            LEFT JOIN carrier_calendar cal ON c.carrier_id = cal.carrier_id
            GROUP BY c.carrier_id
            ORDER BY cp.shipment_count DESC
        """)
        carrier_rows = cursor.fetchall()
        carrier_items = [
            CarrierItemSchema(
                carrier_id=r["carrier_id"],
                carrier_name=r["carrier_name"],
                carrier_type=r["carrier_type"],
                supports_reverse_logistics=bool(r["supports_reverse_logistics"]),
                is_active=bool(r["is_active"]),
                pickup_cutoff_time=r["pickup_cutoff_time"] or "15:00",
                dispatch_window_start=r["dispatch_window_start"] or "09:00",
                dispatch_window_end=r["dispatch_window_end"] or "18:00",
                shipment_count=int(r["shipment_count"]),
                delayed_shipments=int(r["delayed_shipments"]),
                average_delay_days=round(float(r["average_delay_days"]), 4),
                median_delay_days=round(float(r["median_delay_days"]), 2),
                on_time_rate_pct=round(float(r["on_time_rate_pct"]), 2),
                delay_rate_pct=round(float(r["delay_rate_pct"]), 2),
                covered_zones_count=int(r["covered_zones_count"]),
                service_distribution=sl_dist_by_carrier.get(r["carrier_id"], [])
            )
            for r in carrier_rows
        ]

        # 4. Service Level Performance
        cursor.execute("""
            SELECT 
                sl.service_level_id, sl.carrier_id, c.carrier_name, sl.service_code, sl.service_name,
                sl.nominal_transit_days, sl.max_weight_kg,
                COALESCE(slp.shipment_count, 0) as shipment_count,
                COALESCE(slp.delayed_shipments, 0) as delayed_shipments,
                COALESCE(slp.average_delay_days, 0.0) as average_delay_days,
                COALESCE(slp.on_time_rate_pct, 100.0) as on_time_rate_pct
            FROM service_levels sl
            JOIN carriers c ON sl.carrier_id = c.carrier_id
            LEFT JOIN service_level_performance slp ON sl.service_level_id = slp.service_level_id
            ORDER BY sl.carrier_id, sl.priority_rank
        """)
        sl_rows = cursor.fetchall()
        sl_items = [
            ServiceLevelPerformanceItemSchema(
                service_level_id=r["service_level_id"],
                carrier_id=r["carrier_id"],
                carrier_name=r["carrier_name"],
                service_code=r["service_code"],
                service_name=r["service_name"],
                nominal_transit_days=int(r["nominal_transit_days"]),
                max_weight_kg=float(r["max_weight_kg"]),
                shipment_count=int(r["shipment_count"]),
                delayed_shipments=int(r["delayed_shipments"]),
                average_delay_days=round(float(r["average_delay_days"]), 4),
                on_time_rate_pct=round(float(r["on_time_rate_pct"]), 2)
            )
            for r in sl_rows
        ]

        # 5. Monthly Trends
        cursor.execute("""
            SELECT 
                substr(s.dispatch_date, 1, 7) as month, s.carrier_id, c.carrier_name,
                COUNT(*) as shipment_count,
                SUM(s.is_delayed) as delayed_shipments,
                ROUND((1.0 - CAST(SUM(s.is_delayed) AS FLOAT) / COUNT(*)) * 100.0, 2) as on_time_rate_pct
            FROM shipments s
            JOIN carriers c ON s.carrier_id = c.carrier_id
            GROUP BY month, s.carrier_id, c.carrier_name
            ORDER BY month ASC, s.carrier_id ASC
        """)
        trend_rows = cursor.fetchall()
        monthly_trends = [
            MonthlyCarrierTrendItemSchema(
                month=r["month"],
                carrier_id=r["carrier_id"],
                carrier_name=r["carrier_name"],
                shipment_count=int(r["shipment_count"]),
                delayed_shipments=int(r["delayed_shipments"]),
                on_time_rate_pct=float(r["on_time_rate_pct"])
            )
            for r in trend_rows
        ]

    overview_data = CarrierOverviewResponseSchema(
        summary=summary,
        carriers=carrier_items,
        service_levels=sl_items,
        monthly_trends=monthly_trends
    )
    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(status="success", data=overview_data, request_id=request_id)


@router.get(
    "/{carrier_id}",
    response_model=ApiResponseEnvelope[CarrierDetailResponseSchema],
    summary="Query detailed profile, coverage matrix, and sample shipments for a specific carrier",
    dependencies=[Depends(verify_api_key)]
)
def get_carrier_detail(
    carrier_id: str,
    request: Request
):
    """
    Retrieves carrier profile, operating cutoffs, service levels, covered delivery zones,
    and 50 recent shipments for the specified carrier ID.
    """
    clean_id = carrier_id.strip().upper()
    with get_db() as conn:
        cursor = conn.cursor()

        # Check carrier exists
        cursor.execute("""
            SELECT 
                c.carrier_id, c.carrier_name, c.carrier_type, c.supports_reverse_logistics, c.is_active,
                cp.shipment_count, cp.delayed_shipments, cp.average_delay_days, cp.median_delay_days,
                cp.on_time_rate_pct, cp.delay_rate_pct,
                MIN(cal.pickup_cutoff_time) as pickup_cutoff_time,
                MIN(cal.dispatch_window_start) as dispatch_window_start,
                MAX(cal.dispatch_window_end) as dispatch_window_end,
                (SELECT COUNT(*) FROM carrier_service_zones csz WHERE csz.carrier_id = c.carrier_id) as covered_zones_count
            FROM carriers c
            LEFT JOIN carrier_performance cp ON c.carrier_id = cp.carrier_id
            LEFT JOIN carrier_calendar cal ON c.carrier_id = cal.carrier_id
            WHERE c.carrier_id = ?
            GROUP BY c.carrier_id
        """, (clean_id,))
        c_row = cursor.fetchone()

        if not c_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Carrier '{clean_id}' was not found in master database."
            )

        # Service level distribution
        cursor.execute("""
            SELECT 
                sl.service_code, sl.service_name,
                COUNT(*) as shipment_cnt,
                SUM(s.is_delayed) as delayed_cnt,
                ROUND((1.0 - CAST(SUM(s.is_delayed) AS FLOAT) / COUNT(*)) * 100.0, 2) as on_time_rate_pct
            FROM shipments s
            JOIN service_levels sl ON s.service_level_id = sl.service_level_id
            WHERE s.carrier_id = ?
            GROUP BY sl.service_code, sl.service_name
            ORDER BY sl.service_code
        """, (clean_id,))
        sl_dist = [
            CarrierServiceLevelDistributionSchema(
                service_code=r["service_code"],
                service_name=r["service_name"],
                shipment_count=r["shipment_cnt"],
                delayed_shipments=r["delayed_cnt"],
                on_time_rate_pct=r["on_time_rate_pct"]
            )
            for r in cursor.fetchall()
        ]

        carrier_item = CarrierItemSchema(
            carrier_id=c_row["carrier_id"],
            carrier_name=c_row["carrier_name"],
            carrier_type=c_row["carrier_type"],
            supports_reverse_logistics=bool(c_row["supports_reverse_logistics"]),
            is_active=bool(c_row["is_active"]),
            pickup_cutoff_time=c_row["pickup_cutoff_time"] or "15:00",
            dispatch_window_start=c_row["dispatch_window_start"] or "09:00",
            dispatch_window_end=c_row["dispatch_window_end"] or "18:00",
            shipment_count=int(c_row["shipment_count"] or 0),
            delayed_shipments=int(c_row["delayed_shipments"] or 0),
            average_delay_days=round(float(c_row["average_delay_days"] or 0.0), 4),
            median_delay_days=round(float(c_row["median_delay_days"] or 0.0), 2),
            on_time_rate_pct=round(float(c_row["on_time_rate_pct"] or 100.0), 2),
            delay_rate_pct=round(float(c_row["delay_rate_pct"] or 0.0), 2),
            covered_zones_count=int(c_row["covered_zones_count"] or 0),
            service_distribution=sl_dist
        )

        # Service Levels
        cursor.execute("""
            SELECT 
                sl.service_level_id, sl.carrier_id, c.carrier_name, sl.service_code, sl.service_name,
                sl.nominal_transit_days, sl.max_weight_kg,
                COALESCE(slp.shipment_count, 0) as shipment_count,
                COALESCE(slp.delayed_shipments, 0) as delayed_shipments,
                COALESCE(slp.average_delay_days, 0.0) as average_delay_days,
                COALESCE(slp.on_time_rate_pct, 100.0) as on_time_rate_pct
            FROM service_levels sl
            JOIN carriers c ON sl.carrier_id = c.carrier_id
            LEFT JOIN service_level_performance slp ON sl.service_level_id = slp.service_level_id
            WHERE sl.carrier_id = ?
            ORDER BY sl.priority_rank
        """, (clean_id,))
        service_levels = [
            ServiceLevelPerformanceItemSchema(
                service_level_id=r["service_level_id"],
                carrier_id=r["carrier_id"],
                carrier_name=r["carrier_name"],
                service_code=r["service_code"],
                service_name=r["service_name"],
                nominal_transit_days=int(r["nominal_transit_days"]),
                max_weight_kg=float(r["max_weight_kg"]),
                shipment_count=int(r["shipment_count"]),
                delayed_shipments=int(r["delayed_shipments"]),
                average_delay_days=round(float(r["average_delay_days"]), 4),
                on_time_rate_pct=round(float(r["on_time_rate_pct"]), 2)
            )
            for r in cursor.fetchall()
        ]

        # Covered Zones
        cursor.execute("""
            SELECT 
                csz.delivery_zone_id, z.zone_name, z.city, z.state, z.region,
                csz.standard_available, csz.express_available, csz.same_day_available
            FROM carrier_service_zones csz
            JOIN delivery_zones z ON csz.delivery_zone_id = z.delivery_zone_id
            WHERE csz.carrier_id = ?
            ORDER BY csz.delivery_zone_id
        """, (clean_id,))
        covered_zones = [
            {
                "delivery_zone_id": r["delivery_zone_id"],
                "zone_name": r["zone_name"],
                "city": r["city"],
                "state": r["state"],
                "region": r["region"],
                "standard_available": bool(r["standard_available"]),
                "express_available": bool(r["express_available"]),
                "same_day_available": bool(r["same_day_available"]),
            }
            for r in cursor.fetchall()
        ]

        # Recent 50 Shipments
        cursor.execute("""
            SELECT 
                s.shipment_id, s.order_id, s.node_id, fn.node_name, fn.city as node_city,
                s.service_level_id, sl.service_name, sl.service_code,
                s.dispatch_date, s.promised_delivery_date, s.actual_delivery_date,
                s.shipment_status, s.is_delayed, s.delay_days,
                s.package_line_count, s.package_unit_count,
                o.destination_city, o.destination_zone_id
            FROM shipments s
            JOIN fulfillment_nodes fn ON s.node_id = fn.node_id
            JOIN service_levels sl ON s.service_level_id = sl.service_level_id
            JOIN orders o ON s.order_id = o.order_id
            WHERE s.carrier_id = ?
            ORDER BY s.dispatch_date DESC, s.shipment_id DESC
            LIMIT 50
        """, (clean_id,))
        recent_shipments = [
            CarrierShipmentItemSchema(
                shipment_id=r["shipment_id"],
                order_id=r["order_id"],
                node_id=r["node_id"],
                node_name=r["node_name"],
                node_city=r["node_city"],
                service_level_id=r["service_level_id"],
                service_name=r["service_name"],
                service_code=r["service_code"],
                dispatch_date=r["dispatch_date"],
                promised_delivery_date=r["promised_delivery_date"],
                actual_delivery_date=r["actual_delivery_date"],
                shipment_status=r["shipment_status"],
                is_delayed=int(r["is_delayed"]),
                delay_days=int(r["delay_days"]),
                package_line_count=int(r["package_line_count"]),
                package_unit_count=int(r["package_unit_count"]),
                destination_city=r["destination_city"],
                destination_zone_id=r["destination_zone_id"]
            )
            for r in cursor.fetchall()
        ]

    detail_data = CarrierDetailResponseSchema(
        carrier=carrier_item,
        service_levels=service_levels,
        covered_zones=covered_zones,
        recent_shipments=recent_shipments
    )
    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(status="success", data=detail_data, request_id=request_id)


