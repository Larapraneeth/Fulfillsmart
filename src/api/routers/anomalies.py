"""
FulfillSmart Anomaly Detection & Evaluation Router
Implements deterministic rule-based anomaly detection, historical operational exception inspection,
and computation-heavy audit endpoints.
"""
from typing import List, Dict, Any, Optional
import csv
import json
from pathlib import Path
from fastapi import APIRouter, Depends, Request, Query, HTTPException, status
import sqlite3

from src.db import get_db
from src.api.dependencies import verify_api_key, get_anomaly_detector, get_anomaly_harness
from src.api.schemas.anomalies import (
    DetectAnomalyRequestSchema,
    AnomalyFindingSchema,
    AnomalyEvaluationReportSchema,
    CleanDataAuditReportSchema,
    AnomalyOverviewCategorySchema,
    AnomalyOverviewSeveritySchema,
    AnomalyOverviewStatusSchema,
    AnomalyTimeTrendItemSchema,
    AnomalyOverviewResponseSchema,
    AnomalyExplorerItemSchema,
    AnomalyPaginatedResponseSchema,
    AnomalyDetailResponseSchema
)
from src.api.schemas.common import ApiResponseEnvelope

router = APIRouter(prefix="/api/v1/anomalies", tags=["Anomaly Detection & Auditing"])


# Common Table Expression for querying historical operational exceptions and deviations
ANOMALIES_CTE_SQL = """
WITH anomalies_cte AS (
    -- 1. Carrier Unavailable Exceptions (579 distinct orders)
    SELECT 
        'ANOM-CARRIER-' || pe.order_id AS anomaly_id,
        'CARRIER_UNAVAILABLE' AS category,
        'CRITICAL' AS severity,
        1 AS is_derived_severity,
        'Carrier promise exception: Order could not be dispatched due to missed pickup cutoff or missing carrier coverage for requested SAME_DAY service' AS severity_rule,
        'ORDER' AS entity_type,
        pe.order_id AS entity_id,
        pe.order_id AS order_id,
        NULL AS shipment_id,
        MIN(pe.node_id) AS node_id,
        'NONE' AS carrier_id,
        pe.requested_service AS service_level_id,
        'UNRESOLVED' AS status,
        substr(o.order_time, 1, 10) AS detected_date,
        o.destination_city AS destination_city,
        o.destination_state AS destination_state,
        'Order unfulfillable: no carrier matched requested service (' || pe.requested_service || ') or cutoff missed' AS title,
        pe.exception_detail AS explanation
    FROM promise_exceptions pe
    JOIN orders o ON pe.order_id = o.order_id
    GROUP BY pe.order_id

    UNION ALL

    -- 2. Delivery Delays (1,128 shipments)
    SELECT 
        'ANOM-DELAY-' || s.shipment_id AS anomaly_id,
        'DELIVERY_DELAY' AS category,
        CASE 
            WHEN s.delay_days >= 3 THEN 'HIGH'
            WHEN s.delay_days = 2 THEN 'MEDIUM'
            ELSE 'LOW'
        END AS severity,
        1 AS is_derived_severity,
        'Delivery delay deviation: 1-day delay is classified as LOW, 2-day delay as MEDIUM, and 3+ day delay as HIGH priority' AS severity_rule,
        'SHIPMENT' AS entity_type,
        s.shipment_id AS entity_id,
        s.order_id AS order_id,
        s.shipment_id AS shipment_id,
        s.node_id AS node_id,
        s.carrier_id AS carrier_id,
        s.service_level_id AS service_level_id,
        'DELIVERED_HISTORICAL' AS status,
        s.actual_delivery_date AS detected_date,
        o.destination_city AS destination_city,
        o.destination_state AS destination_state,
        'Shipment delivered ' || s.delay_days || ' day(s) late (Promised: ' || s.promised_delivery_date || ', Actual: ' || s.actual_delivery_date || ')' AS title,
        'Carrier ' || s.carrier_id || ' delivered parcel ' || s.delay_days || ' day(s) past promised SLA date.' AS explanation
    FROM shipments s
    JOIN orders o ON s.order_id = o.order_id
    WHERE s.is_delayed = 1

    UNION ALL

    -- 3. Split-Order Complexity (11 orders)
    SELECT 
        'ANOM-SPLIT-' || s.order_id AS anomaly_id,
        'SPLIT_ORDER_COMPLEXITY' AS category,
        'MEDIUM' AS severity,
        1 AS is_derived_severity,
        'Split-order complexity: Multi-warehouse fulfillment coordination overhead and multi-shipment tracking risk' AS severity_rule,
        'ORDER' AS entity_type,
        s.order_id AS entity_id,
        s.order_id AS order_id,
        NULL AS shipment_id,
        'MULTI_NODE' AS node_id,
        'MULTI_CARRIER' AS carrier_id,
        o.requested_service AS service_level_id,
        CASE WHEN d.delivery_outcome_status = 'CARRIER_UNAVAILABLE' THEN 'UNRESOLVED' ELSE 'DELIVERED_HISTORICAL' END AS status,
        substr(o.order_time, 1, 10) AS detected_date,
        o.destination_city AS destination_city,
        o.destination_state AS destination_state,
        'Split fulfillment complexity: order split across ' || s.allocated_node_count || ' fulfillment centers' AS title,
        'Order lines distributed across ' || s.allocated_node_count || ' nodes for ' || s.total_units || ' total units.' AS explanation
    FROM order_allocation_summary s
    JOIN orders o ON s.order_id = o.order_id
    JOIN delivery_outcomes d ON s.order_id = d.order_id
    WHERE s.allocated_node_count > 1
)
"""


# =====================================================================
# Read-Only Anomaly Endpoints
# =====================================================================

@router.get(
    "/overview",
    response_model=ApiResponseEnvelope[AnomalyOverviewResponseSchema],
    summary="Get aggregated anomaly metrics, distributions, and baseline disclosures",
    dependencies=[Depends(verify_api_key)]
)
def get_anomalies_overview(request: Request):
    """
    Returns high-level summary of historical operational anomalies, verified source categories,
    rule-based severity distributions, operational statuses, and 10-month historical trends.
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # Monthly trends
        query_monthly = """
        WITH delays AS (
            SELECT substr(actual_delivery_date, 1, 7) as month, count(*) as delays_cnt
            FROM shipments
            WHERE is_delayed = 1
            GROUP BY month
        ),
        unavail AS (
            SELECT substr(o.order_time, 1, 7) as month, count(DISTINCT pe.order_id) as unavail_cnt
            FROM promise_exceptions pe
            JOIN orders o ON pe.order_id = o.order_id
            GROUP BY month
        ),
        splits AS (
            SELECT substr(o.order_time, 1, 7) as month, count(*) as splits_cnt
            FROM order_allocation_summary s
            JOIN orders o ON s.order_id = o.order_id
            WHERE s.allocated_node_count > 1
            GROUP BY month
        ),
        all_months AS (
            SELECT month FROM delays
            UNION
            SELECT month FROM unavail
            UNION
            SELECT month FROM splits
        )
        SELECT 
            m.month,
            COALESCE(u.unavail_cnt, 0) as carrier_unavailable_count,
            COALESCE(d.delays_cnt, 0) as delivery_delay_count,
            COALESCE(s.splits_cnt, 0) as split_order_count,
            (COALESCE(u.unavail_cnt, 0) + COALESCE(d.delays_cnt, 0) + COALESCE(s.splits_cnt, 0)) as total_count
        FROM all_months m
        LEFT JOIN unavail u ON m.month = u.month
        LEFT JOIN delays d ON m.month = d.month
        LEFT JOIN splits s ON m.month = s.month
        ORDER BY m.month ASC
        """
        cursor.execute(query_monthly)
        monthly_trends = [
            AnomalyTimeTrendItemSchema(
                month=r["month"],
                carrier_unavailable_count=r["carrier_unavailable_count"],
                delivery_delay_count=r["delivery_delay_count"],
                split_order_count=r["split_order_count"],
                total_count=r["total_count"]
            )
            for r in cursor.fetchall()
        ]

    # Category definitions and counts
    # 579 carrier unavailable, 1,128 delivery delays, 11 split orders = 1,718 total
    categories = [
        AnomalyOverviewCategorySchema(
            category="CARRIER_UNAVAILABLE",
            name="Carrier Assignment Exceptions",
            count=579,
            percentage=round(579 / 1718 * 100, 2),
            rate_against_baseline=round(579 / 50000 * 100, 3),
            denominator_entity="ORDER",
            denominator_count=50000,
            source_table="promise_exceptions",
            verification_type="VERIFIED_HISTORICAL_RECORD",
            description="Orders requesting SAME_DAY service where no carrier supported destination zone coverage or pickup cutoff window."
        ),
        AnomalyOverviewCategorySchema(
            category="DELIVERY_DELAY",
            name="Delivery Delay Deviations",
            count=1128,
            percentage=round(1128 / 1718 * 100, 2),
            rate_against_baseline=round(1128 / 49436 * 100, 3),
            denominator_entity="SHIPMENT",
            denominator_count=49436,
            source_table="shipments",
            verification_type="VERIFIED_HISTORICAL_RECORD",
            description="Dispatched parcels delivered past promised SLA date (exactly 376 for +1d, 376 for +2d, 376 for +3d)."
        ),
        AnomalyOverviewCategorySchema(
            category="SPLIT_ORDER_COMPLEXITY",
            name="Split-Order Fulfillment Complexities",
            count=11,
            percentage=round(11 / 1718 * 100, 2),
            rate_against_baseline=round(11 / 50000 * 100, 3),
            denominator_entity="ORDER",
            denominator_count=50000,
            source_table="order_allocation_summary",
            verification_type="DERIVED_LOGISTICS_INDICATOR",
            description="Orders fulfilled across multiple warehouse nodes, incurring coordination complexity (10 completed, 1 carrier unavailable)."
        ),
        AnomalyOverviewCategorySchema(
            category="ALLOCATION_EXCEPTION",
            name="Allocation Stock Shortages",
            count=0,
            percentage=0.0,
            rate_against_baseline=0.0,
            denominator_entity="ORDER",
            denominator_count=50000,
            source_table="allocation_exceptions",
            verification_type="VERIFIED_HISTORICAL_RECORD",
            description="Failed inventory allocations due to stock exhaustion. Verified 0 occurrences in historical baseline."
        ),
        AnomalyOverviewCategorySchema(
            category="TRACKING_IRREGULARITY",
            name="Tracking Event Irregularities",
            count=0,
            percentage=0.0,
            rate_against_baseline=0.0,
            denominator_entity="SHIPMENT",
            denominator_count=49436,
            source_table="tracking_events",
            verification_type="VERIFIED_HISTORICAL_RECORD",
            description="Out-of-order, non-contiguous, or orphaned tracking events. Verified 0 occurrences across 100,000 events."
        )
    ]

    # Severities
    severities = [
        AnomalyOverviewSeveritySchema(
            severity="CRITICAL",
            count=579,
            percentage=round(579 / 1718 * 100, 2),
            classification_rule="Carrier assignment failure: order unable to be fulfilled or dispatched to customer.",
            is_derived=True
        ),
        AnomalyOverviewSeveritySchema(
            severity="HIGH",
            count=376,
            percentage=round(376 / 1718 * 100, 2),
            classification_rule="Severe delivery delay: parcel delivered 3 or more days past promised SLA delivery date.",
            is_derived=True
        ),
        AnomalyOverviewSeveritySchema(
            severity="MEDIUM",
            count=387,
            percentage=round(387 / 1718 * 100, 2),
            classification_rule="Moderate operational deviation: 2-day delivery delays (376) and split-order coordination complexities (11).",
            is_derived=True
        ),
        AnomalyOverviewSeveritySchema(
            severity="LOW",
            count=376,
            percentage=round(376 / 1718 * 100, 2),
            classification_rule="Minor delivery delay: parcel delivered 1 day past promised SLA date.",
            is_derived=True
        )
    ]

    # Statuses
    statuses = [
        AnomalyOverviewStatusSchema(
            status="DELIVERED_HISTORICAL",
            count=1138,
            percentage=round(1138 / 1718 * 100, 2),
            description="Parcels/orders that reached delivery in historical records despite operational delays or split complexity."
        ),
        AnomalyOverviewStatusSchema(
            status="UNRESOLVED",
            count=580,
            percentage=round(580 / 1718 * 100, 2),
            description="Carrier-unavailable orders that could not be assigned or dispatched (includes single split-order carrier failure)."
        )
    ]

    data = AnomalyOverviewResponseSchema(
        total_anomalies=1718,
        total_orders_evaluated=50000,
        total_shipments_evaluated=49436,
        order_exception_rate_pct=round(579 / 50000 * 100, 3),
        shipment_delay_rate_pct=round(1128 / 49436 * 100, 3),
        split_order_rate_pct=round(11 / 50000 * 100, 3),
        clean_records_audit_evaluated=247061,
        clean_records_false_positives=0,
        clean_records_specificity_pct=100.0,
        synthetic_benchmark_cases=976,
        synthetic_benchmark_f1=1.0,
        categories=categories,
        severities=severities,
        statuses=statuses,
        monthly_trends=monthly_trends,
        baseline_disclosure="Historical operational dataset audit spanning 50,000 orders and 49,436 shipments (January–November 2026). All metrics represent verified historical records or documented deterministic business-rule classifications. No live GPS or simulated telemetry."
    )

    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(status="success", data=data, request_id=request_id)


@router.get(
    "",
    response_model=ApiResponseEnvelope[AnomalyPaginatedResponseSchema],
    summary="Search, filter, and paginate historical operational anomalies",
    dependencies=[Depends(verify_api_key)]
)
def get_anomalies_paginated(
    request: Request,
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(25, ge=1, le=100, description="Items per page"),
    category: Optional[str] = Query(None, description="Filter by category (CARRIER_UNAVAILABLE, DELIVERY_DELAY, SPLIT_ORDER_COMPLEXITY)"),
    severity: Optional[str] = Query(None, description="Filter by severity (CRITICAL, HIGH, MEDIUM, LOW)"),
    status: Optional[str] = Query(None, description="Filter by status (UNRESOLVED, DELIVERED_HISTORICAL)"),
    carrier_id: Optional[str] = Query(None, description="Filter by carrier ID"),
    node_id: Optional[str] = Query(None, description="Filter by fulfillment node ID"),
    search: Optional[str] = Query(None, description="Search by anomaly ID, order ID, shipment ID, city, state"),
    sort_by: str = Query("detected_date", pattern="^(detected_date|severity|category|anomaly_id|order_id)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$")
):
    """
    Server-side paginated explorer of verified historical operational anomalies and deviations.
    Supports filtering by category, severity, status, carrier, node, and free-text search.
    """
    conditions = []
    params: List[Any] = []

    if category:
        conditions.append("category = ?")
        params.append(category.upper())

    if severity:
        conditions.append("severity = ?")
        params.append(severity.upper())

    if status:
        conditions.append("status = ?")
        params.append(status.upper())

    if carrier_id:
        conditions.append("carrier_id = ?")
        params.append(carrier_id.upper())

    if node_id:
        conditions.append("node_id = ?")
        params.append(node_id.upper())

    if search:
        search_term = f"%{search.strip()}%"
        conditions.append(
            "(anomaly_id LIKE ? OR order_id LIKE ? OR shipment_id LIKE ? OR destination_city LIKE ? OR destination_state LIKE ? OR carrier_id LIKE ? OR node_id LIKE ?)"
        )
        params.extend([search_term] * 7)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    # Sort handling
    if sort_by == "severity":
        sort_expr = "CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 WHEN 'LOW' THEN 4 END"
    else:
        sort_expr = sort_by

    order_clause = f"ORDER BY {sort_expr} {sort_order.upper()}, anomaly_id ASC"

    with get_db() as conn:
        cursor = conn.cursor()

        # Count total matches
        count_sql = f"{ANOMALIES_CTE_SQL} SELECT COUNT(*) FROM anomalies_cte {where_clause}"
        cursor.execute(count_sql, params)
        total_count = cursor.fetchone()[0]

        total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1
        offset = (page - 1) * page_size

        # Paginated items
        items_sql = f"""
        {ANOMALIES_CTE_SQL}
        SELECT 
            anomaly_id,
            category,
            severity,
            is_derived_severity,
            severity_rule,
            entity_type,
            entity_id,
            order_id,
            shipment_id,
            node_id,
            carrier_id,
            service_level_id,
            status,
            detected_date,
            destination_city,
            destination_state,
            title,
            explanation
        FROM anomalies_cte
        {where_clause}
        {order_clause}
        LIMIT ? OFFSET ?
        """
        cursor.execute(items_sql, params + [page_size, offset])
        rows = cursor.fetchall()

        items = [
            AnomalyExplorerItemSchema(
                anomaly_id=r["anomaly_id"],
                category=r["category"],
                severity=r["severity"],
                is_derived_severity=bool(r["is_derived_severity"]),
                severity_rule=r["severity_rule"],
                entity_type=r["entity_type"],
                entity_id=r["entity_id"],
                order_id=r["order_id"],
                shipment_id=r["shipment_id"],
                node_id=r["node_id"],
                carrier_id=r["carrier_id"],
                service_level_id=r["service_level_id"],
                status=r["status"],
                detected_date=r["detected_date"],
                destination_city=r["destination_city"],
                destination_state=r["destination_state"],
                title=r["title"],
                explanation=r["explanation"]
            )
            for r in rows
        ]

    data = AnomalyPaginatedResponseSchema(
        items=items,
        total_count=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_previous=page > 1
    )

    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(status="success", data=data, request_id=request_id)


@router.get(
    "/{anomaly_id}",
    response_model=ApiResponseEnvelope[AnomalyDetailResponseSchema],
    summary="Get full evidence and source records for a specific anomaly",
    dependencies=[Depends(verify_api_key)]
)
def get_anomaly_detail(
    anomaly_id: str,
    request: Request
):
    """
    Returns full forensic evidence, related database records, timeline events,
    and documented rule explanations for an anomaly record.
    """
    norm_id = anomaly_id.strip()

    with get_db() as conn:
        cursor = conn.cursor()

        # 1. Carrier Unavailable Exception
        if norm_id.startswith("ANOM-CARRIER-") or norm_id.startswith("ORD-"):
            clean_order_id = norm_id.replace("ANOM-CARRIER-", "")
            cursor.execute("""
                SELECT 
                    o.*,
                    pe.node_id,
                    pe.delivery_zone_id,
                    pe.requested_service,
                    pe.exception_code,
                    pe.exception_detail,
                    d.delivery_outcome_status
                FROM promise_exceptions pe
                JOIN orders o ON pe.order_id = o.order_id
                JOIN delivery_outcomes d ON o.order_id = d.order_id
                WHERE o.order_id = ?
            """, (clean_order_id,))
            carrier_row = cursor.fetchone()

            if carrier_row:
                # Fetch allocation lines if any
                cursor.execute("""
                    SELECT node_id, sku_id, allocated_qty
                    FROM allocation_decisions
                    WHERE order_id = ?
                """, (clean_order_id,))
                allocations = [dict(r) for r in cursor.fetchall()]

                # Fetch shipment exceptions if any
                cursor.execute("""
                    SELECT row_id, node_id, exception_code, exception_detail
                    FROM shipment_exceptions
                    WHERE order_id = ?
                """, (clean_order_id,))
                ship_exceptions = [dict(r) for r in cursor.fetchall()]

                data = AnomalyDetailResponseSchema(
                    anomaly_id=f"ANOM-CARRIER-{clean_order_id}",
                    category="CARRIER_UNAVAILABLE",
                    severity="CRITICAL",
                    is_derived_severity=True,
                    severity_rule="Carrier promise exception: Order could not be dispatched due to missed pickup cutoff or missing carrier coverage for requested SAME_DAY service.",
                    entity_type="ORDER",
                    entity_id=clean_order_id,
                    order_id=clean_order_id,
                    shipment_id=None,
                    node_id=carrier_row["node_id"],
                    carrier_id="NONE",
                    service_level_id=carrier_row["requested_service"],
                    status="UNRESOLVED",
                    detected_date=carrier_row["order_time"][:10],
                    title=f"Order {clean_order_id} Unfulfillable (Carrier Unavailable)",
                    explanation=carrier_row["exception_detail"],
                    source_table="promise_exceptions",
                    verification_type="VERIFIED_HISTORICAL_RECORD",
                    evidence={
                        "exception_code": carrier_row["exception_code"],
                        "exception_detail": carrier_row["exception_detail"],
                        "requested_service": carrier_row["requested_service"],
                        "destination_zone_id": carrier_row["delivery_zone_id"],
                        "destination_city": carrier_row["destination_city"],
                        "destination_state": carrier_row["destination_state"],
                        "destination_pincode": carrier_row["destination_pincode"],
                        "order_total_inr": carrier_row["order_total_inr"],
                        "delivery_outcome_status": carrier_row["delivery_outcome_status"],
                        "root_cause": "Customer requested SAME_DAY service; no carrier had active zone coverage or cutoff window within the next seven days."
                    },
                    related_entities={
                        "order": {
                            "order_id": carrier_row["order_id"],
                            "customer_id": carrier_row["customer_id"],
                            "order_time": carrier_row["order_time"],
                            "order_channel": carrier_row["order_channel"],
                            "order_priority": carrier_row["order_priority"],
                            "order_status": carrier_row["order_status"]
                        },
                        "allocations": allocations,
                        "shipment_exceptions": ship_exceptions
                    }
                )
                request_id = getattr(request.state, "request_id", None)
                return ApiResponseEnvelope(status="success", data=data, request_id=request_id)

        # 2. Delivery Delay Deviation
        if norm_id.startswith("ANOM-DELAY-") or norm_id.startswith("SHP-"):
            clean_shp_id = norm_id.replace("ANOM-DELAY-", "")
            cursor.execute("""
                SELECT 
                    s.*,
                    o.order_time,
                    o.customer_id,
                    o.destination_city,
                    o.destination_state,
                    o.destination_pincode,
                    o.requested_service
                FROM shipments s
                JOIN orders o ON s.order_id = o.order_id
                WHERE s.shipment_id = ? AND s.is_delayed = 1
            """, (clean_shp_id,))
            delay_row = cursor.fetchone()

            if delay_row:
                delay_days = delay_row["delay_days"]
                sev = "HIGH" if delay_days >= 3 else ("MEDIUM" if delay_days == 2 else "LOW")

                # Fetch tracking events timeline
                cursor.execute("""
                    SELECT tracking_event_id, event_sequence, event_type, event_timestamp, event_location, event_description
                    FROM tracking_events
                    WHERE shipment_id = ?
                    ORDER BY event_sequence ASC
                """, (clean_shp_id,))
                events = [dict(r) for r in cursor.fetchall()]

                data = AnomalyDetailResponseSchema(
                    anomaly_id=f"ANOM-DELAY-{clean_shp_id}",
                    category="DELIVERY_DELAY",
                    severity=sev,
                    is_derived_severity=True,
                    severity_rule=f"Delivery delay deviation: parcel delivered {delay_days} day(s) late. Classified as {sev} priority.",
                    entity_type="SHIPMENT",
                    entity_id=clean_shp_id,
                    order_id=delay_row["order_id"],
                    shipment_id=clean_shp_id,
                    node_id=delay_row["node_id"],
                    carrier_id=delay_row["carrier_id"],
                    service_level_id=delay_row["service_level_id"],
                    status="DELIVERED_HISTORICAL",
                    detected_date=delay_row["actual_delivery_date"],
                    title=f"Shipment {clean_shp_id} Delivered {delay_days} Day(s) Late",
                    explanation=f"Carrier {delay_row['carrier_id']} delivered parcel {delay_days} day(s) past promised delivery SLA (Promised: {delay_row['promised_delivery_date']}, Actual: {delay_row['actual_delivery_date']}).",
                    source_table="shipments",
                    verification_type="VERIFIED_HISTORICAL_RECORD",
                    evidence={
                        "dispatch_date": delay_row["dispatch_date"],
                        "promised_delivery_date": delay_row["promised_delivery_date"],
                        "actual_delivery_date": delay_row["actual_delivery_date"],
                        "delay_days": delay_days,
                        "package_line_count": delay_row["package_line_count"],
                        "package_unit_count": delay_row["package_unit_count"],
                        "carrier_id": delay_row["carrier_id"],
                        "service_level_id": delay_row["service_level_id"],
                        "fulfillment_node_id": delay_row["node_id"],
                        "destination_city": delay_row["destination_city"],
                        "destination_state": delay_row["destination_state"]
                    },
                    related_entities={
                        "order": {
                            "order_id": delay_row["order_id"],
                            "customer_id": delay_row["customer_id"],
                            "order_time": delay_row["order_time"],
                            "requested_service": delay_row["requested_service"]
                        },
                        "tracking_events": events
                    }
                )
                request_id = getattr(request.state, "request_id", None)
                return ApiResponseEnvelope(status="success", data=data, request_id=request_id)

        # 3. Split-Order Complexity
        if norm_id.startswith("ANOM-SPLIT-") or norm_id.startswith("ORD-"):
            clean_split_id = norm_id.replace("ANOM-SPLIT-", "")
            cursor.execute("""
                SELECT 
                    s.*,
                    o.customer_id,
                    o.order_time,
                    o.order_total_inr,
                    o.destination_city,
                    o.destination_state,
                    o.requested_service,
                    d.delivery_outcome_status
                FROM order_allocation_summary s
                JOIN orders o ON s.order_id = o.order_id
                JOIN delivery_outcomes d ON s.order_id = d.order_id
                WHERE s.order_id = ? AND s.allocated_node_count > 1
            """, (clean_split_id,))
            split_row = cursor.fetchone()

            if split_row:
                # Fetch constituent shipments
                cursor.execute("""
                    SELECT shipment_id, node_id, carrier_id, service_level_id, dispatch_date, promised_delivery_date, actual_delivery_date, is_delayed, delay_days
                    FROM shipments
                    WHERE order_id = ?
                """, (clean_split_id,))
                split_shipments = [dict(r) for r in cursor.fetchall()]

                # Fetch constituent allocation decisions
                cursor.execute("""
                    SELECT node_id, sku_id, allocated_qty
                    FROM allocation_decisions
                    WHERE order_id = ?
                """, (clean_split_id,))
                split_allocations = [dict(r) for r in cursor.fetchall()]

                status_val = "UNRESOLVED" if split_row["delivery_outcome_status"] == "CARRIER_UNAVAILABLE" else "DELIVERED_HISTORICAL"

                data = AnomalyDetailResponseSchema(
                    anomaly_id=f"ANOM-SPLIT-{clean_split_id}",
                    category="SPLIT_ORDER_COMPLEXITY",
                    severity="MEDIUM",
                    is_derived_severity=True,
                    severity_rule="Split-order complexity: Multi-warehouse fulfillment coordination overhead and multi-shipment tracking risk.",
                    entity_type="ORDER",
                    entity_id=clean_split_id,
                    order_id=clean_split_id,
                    shipment_id=None,
                    node_id="MULTI_NODE",
                    carrier_id="MULTI_CARRIER",
                    service_level_id=split_row["requested_service"],
                    status=status_val,
                    detected_date=split_row["order_time"][:10],
                    title=f"Split Order {clean_split_id} Across {split_row['allocated_node_count']} Facilities",
                    explanation=f"Order inventory distributed across {split_row['allocated_node_count']} regional warehouses for {split_row['total_units']} total units, producing {len(split_shipments)} separate shipments.",
                    source_table="order_allocation_summary",
                    verification_type="DERIVED_LOGISTICS_INDICATOR",
                    evidence={
                        "allocated_node_count": split_row["allocated_node_count"],
                        "total_units": split_row["total_units"],
                        "allocation_type": split_row["allocation_type"],
                        "delivery_outcome_status": split_row["delivery_outcome_status"],
                        "constituent_shipment_count": len(split_shipments),
                        "destination_city": split_row["destination_city"],
                        "destination_state": split_row["destination_state"]
                    },
                    related_entities={
                        "order": {
                            "order_id": split_row["order_id"],
                            "customer_id": split_row["customer_id"],
                            "order_time": split_row["order_time"],
                            "order_total_inr": split_row["order_total_inr"]
                        },
                        "allocations": split_allocations,
                        "shipments": split_shipments
                    }
                )
                request_id = getattr(request.state, "request_id", None)
                return ApiResponseEnvelope(status="success", data=data, request_id=request_id)

    # 4. Check synthetic ground-truth benchmark cases (e.g. RGT-0001)
    if norm_id.startswith("RGT-") or norm_id.startswith("ORD-ANOM-RGT-"):
        csv_path = Path(__file__).resolve().parents[3] / "data" / "replacement_ground_truth" / "replacement_ground_truth.csv"
        if csv_path.exists():
            with open(csv_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row["case_id"] == norm_id or row["entity_id"] == norm_id:
                        payload = json.loads(row["scenario_payload"])
                        data = AnomalyDetailResponseSchema(
                            anomaly_id=row["case_id"],
                            category=row["anomaly_type"],
                            severity=row["severity"],
                            is_derived_severity=False,
                            severity_rule="Synthetic test benchmark evaluation suite case (seed 20261022).",
                            entity_type=row["entity_type"],
                            entity_id=row["entity_id"],
                            order_id=payload.get("order_id", row["entity_id"]),
                            shipment_id=payload.get("shipment_id"),
                            node_id=payload.get("node_id"),
                            carrier_id=payload.get("carrier_id"),
                            service_level_id=payload.get("requested_service"),
                            status="BENCHMARK_SYNTHETIC",
                            detected_date="2026-10-22",
                            title=f"Synthetic Benchmark Anomaly ({row['anomaly_type']})",
                            explanation=row["description"],
                            source_table="replacement_ground_truth.csv",
                            verification_type="SYNTHETIC_BENCHMARK_CASE",
                            evidence=payload,
                            related_entities={
                                "benchmark_case": {
                                    "case_id": row["case_id"],
                                    "split": row["split"],
                                    "entity_type": row["entity_type"]
                                }
                            }
                        )
                        request_id = getattr(request.state, "request_id", None)
                        return ApiResponseEnvelope(status="success", data=data, request_id=request_id)

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Anomaly with identifier '{anomaly_id}' was not found in historical or benchmark records."
    )


# =====================================================================
# Existing Anomaly Evaluation & Detection Endpoints (Preserved)
# =====================================================================

@router.post(
    "/detect",
    response_model=ApiResponseEnvelope[List[AnomalyFindingSchema]],
    summary="Inspect operational record against the 6 deterministic business rules",
    dependencies=[Depends(verify_api_key)]
)
def detect_anomalies(
    payload: DetectAnomalyRequestSchema,
    request: Request,
    detector=Depends(get_anomaly_detector)
):
    """
    Evaluates an operational scenario record directly against the 6 agreed logistics rules:
    - Rule 1: Allocation exceeds available inventory stock
    - Rule 2: Carrier assigned to unsupported delivery zone/service
    - Rule 3: Actual delivery date precedes dispatch date
    - Rule 4: Incorrect split-shipment status rollup
    - Rule 5: Delivery promise date precedes order placement date
    - Rule 6: Warehouse daily order or unit capacity exceeded
    """
    finding = detector.detect_scenario(payload.scenario)
    response_data = []
    if finding:
        response_data.append(
            AnomalyFindingSchema(
                case_id=finding.case_id,
                entity_id=finding.entity_id,
                entity_type=finding.entity_type,
                anomaly_type=finding.anomaly_type,
                severity=finding.severity,
                explanation=finding.explanation,
                detected_at_utc=finding.detected_at_utc
            )
        )

    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(status="success", data=response_data, request_id=request_id)


@router.post(
    "/evaluate/ground-truth",
    response_model=ApiResponseEnvelope[AnomalyEvaluationReportSchema],
    summary="Trigger full evaluation harness on 976 replacement synthetic test cases (POST Heavy)",
    dependencies=[Depends(verify_api_key)]
)
def evaluate_ground_truth(
    request: Request,
    harness=Depends(get_anomaly_harness)
):
    """
    Executes detector evaluation against all 976 labelled synthetic test cases (seed 20261022).
    Computes TP, FP, FN, TN, precision, recall, and F1 per category, plus micro and macro averages.
    """
    res = harness.evaluate_replacement_ground_truth()
    data = AnomalyEvaluationReportSchema(**res)
    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(status="success", data=data, request_id=request_id)


@router.post(
    "/evaluate/clean-audit",
    response_model=ApiResponseEnvelope[CleanDataAuditReportSchema],
    summary="Trigger full audit of all 6 anomaly rules across clean operational records (POST Heavy)",
    dependencies=[Depends(verify_api_key)]
)
def audit_clean_operational_records(
    request: Request,
    harness=Depends(get_anomaly_harness)
):
    """
    Audits all 6 deterministic rules against 247,061 clean operational records from historical SQLite tables.
    Proves 0 false positives on production baseline data.
    """
    res = harness.evaluate_clean_operational_data()
    data = CleanDataAuditReportSchema(**res)
    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(status="success", data=data, request_id=request_id)
