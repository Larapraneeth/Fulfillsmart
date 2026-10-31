"""
FulfillSmart Orders Explorer Router
Provides paginated, filtered, and sorted access to the 50,000 historical baseline orders.
Enforces parameterized queries, strict whitelist sorting, and zero raw SQL injection risk.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request, HTTPException, status
import math

from src.db import get_db
from src.api.dependencies import verify_api_key
from src.api.schemas.orders import (
    OrderListItemSchema,
    PaginatedOrdersDataSchema,
    OrderLineItemDetailSchema,
    OrderDetailSchema
)
from src.api.schemas.common import ApiResponseEnvelope

router = APIRouter(prefix="/api/v1/orders", tags=["Order Management"])

VALID_SORT_FIELDS = {
    "order_time": "o.order_time",
    "order_id": "o.order_id",
    "order_priority": "o.order_priority"
}


@router.get(
    "",
    response_model=ApiResponseEnvelope[PaginatedOrdersDataSchema],
    summary="Paginated Order Explorer with multi-field search and filters",
    dependencies=[Depends(verify_api_key)]
)
def list_orders(
    request: Request,
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(default=50, ge=1, le=100, description="Items per page (max 100)"),
    search: Optional[str] = Query(default=None, max_length=64, description="Search by order_id or customer_id"),
    status: Optional[str] = Query(default=None, description="Filter by delivery outcome status (e.g. DELIVERED_ON_TIME)"),
    destination_zone_id: Optional[str] = Query(default=None, description="Filter by delivery zone ID (e.g. DZ-010)"),
    order_priority: Optional[str] = Query(default=None, description="Filter by priority tier (CRITICAL, HIGH, NORMAL, LOW)"),
    requested_service: Optional[str] = Query(default=None, description="Filter by service level (STANDARD, EXPRESS, SAME_DAY)"),
    carrier_id: Optional[str] = Query(default=None, description="Filter by assigned carrier ID (e.g. CAR-001)"),
    node_id: Optional[str] = Query(default=None, description="Filter by allocated fulfillment node ID (e.g. FUL-2026-000001)"),
    sort_by: str = Query(default="order_time", description="Field to sort by: order_time, order_id, order_priority"),
    sort_order: str = Query(default="desc", description="Sort order: asc, desc")
):
    """
    Returns a paginated list of historical fulfillment orders with order line counts,
    total units, delivery outcome status, assigned carrier, allocated warehouse node(s),
    and order total monetary value in INR.
    """
    if sort_by not in VALID_SORT_FIELDS:
        sort_by = "order_time"
    db_sort_col = VALID_SORT_FIELDS[sort_by]
    direction = "ASC" if sort_order.lower() == "asc" else "DESC"

    # Build WHERE conditions and parameters
    where_clauses = ["1=1"]
    params = []

    if search:
        search_pattern = f"{search.strip()}%"
        where_clauses.append("(o.order_id LIKE ? OR o.customer_id LIKE ?)")
        params.extend([search_pattern, search_pattern])

    if status:
        where_clauses.append("d.delivery_outcome_status = ?")
        params.append(status.strip())

    if destination_zone_id:
        where_clauses.append("o.destination_zone_id = ?")
        params.append(destination_zone_id.strip())

    if order_priority:
        where_clauses.append("o.order_priority = ?")
        params.append(order_priority.strip())

    if requested_service:
        where_clauses.append("o.requested_service = ?")
        params.append(requested_service.strip())

    if carrier_id:
        where_clauses.append("o.order_id IN (SELECT order_id FROM shipments WHERE carrier_id = ?)")
        params.append(carrier_id.strip())

    if node_id:
        where_clauses.append("o.order_id IN (SELECT order_id FROM allocation_decisions WHERE node_id = ?)")
        params.append(node_id.strip())

    where_sql = " AND ".join(where_clauses)
    offset = (page - 1) * page_size

    count_query = f"""
        SELECT COUNT(*)
        FROM orders o
        LEFT JOIN delivery_outcomes d ON o.order_id = d.order_id
        WHERE {where_sql}
    """

    # Primary Carrier Selection Rule for Multi-Shipment Orders:
    # Deterministically select dominant carrier by:
    # 1. package_unit_count DESC (largest volume consignment)
    # 2. package_line_count DESC (broadest SKU line consignment)
    # 3. shipment_id ASC (deterministic tie-breaker)
    # Aggregated carrier_ids and carrier_names are sorted deterministically ASC.
    data_query = f"""
        SELECT 
            o.order_id,
            o.customer_id,
            o.order_time,
            o.destination_zone_id,
            COALESCE(z.zone_name, o.destination_zone_id) AS zone_name,
            COALESCE(z.city, '') AS zone_city,
            COALESCE(z.state, '') AS zone_state,
            o.requested_service,
            o.order_priority,
            o.order_status,
            o.order_total_inr,
            d.delivery_outcome_status,
            d.delivery_on_time,
            (
                SELECT s.carrier_id 
                FROM shipments s 
                WHERE s.order_id = o.order_id 
                ORDER BY s.package_unit_count DESC, s.package_line_count DESC, s.shipment_id ASC 
                LIMIT 1
            ) AS primary_carrier_id,
            (
                SELECT c.carrier_name 
                FROM shipments s 
                JOIN carriers c ON s.carrier_id = c.carrier_id 
                WHERE s.order_id = o.order_id 
                ORDER BY s.package_unit_count DESC, s.package_line_count DESC, s.shipment_id ASC 
                LIMIT 1
            ) AS carrier_name,
            (
                SELECT GROUP_CONCAT(carrier_id) 
                FROM (
                    SELECT DISTINCT s.carrier_id 
                    FROM shipments s 
                    WHERE s.order_id = o.order_id 
                    ORDER BY s.carrier_id ASC
                )
            ) AS all_carrier_ids,
            (
                SELECT GROUP_CONCAT(carrier_name) 
                FROM (
                    SELECT DISTINCT c.carrier_name 
                    FROM shipments s 
                    JOIN carriers c ON s.carrier_id = c.carrier_id 
                    WHERE s.order_id = o.order_id 
                    ORDER BY c.carrier_name ASC
                )
            ) AS all_carrier_names,
            CASE WHEN als.allocation_type = 'SPLIT_NODE' THEN 1 ELSE 0 END AS is_split,
            COALESCE(als.total_units, 0) AS total_units,
            (SELECT COUNT(*) FROM order_lines ol WHERE ol.order_id = o.order_id) AS line_count,
            (SELECT GROUP_CONCAT(DISTINCT node_id) FROM allocation_decisions ad WHERE ad.order_id = o.order_id) AS allocated_nodes
        FROM (
            SELECT o.order_id
            FROM orders o
            LEFT JOIN delivery_outcomes d ON o.order_id = d.order_id
            WHERE {where_sql}
            ORDER BY {db_sort_col} {direction}
            LIMIT ? OFFSET ?
        ) p
        JOIN orders o ON p.order_id = o.order_id
        LEFT JOIN delivery_zones z ON o.destination_zone_id = z.delivery_zone_id
        LEFT JOIN delivery_outcomes d ON o.order_id = d.order_id
        LEFT JOIN order_allocation_summary als ON o.order_id = als.order_id
        ORDER BY {db_sort_col} {direction}
    """

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(count_query, params)
        total_count = cursor.fetchone()[0]

        cursor.execute(data_query, params + [page_size, offset])
        rows = cursor.fetchall()

    items = []
    for r in rows:
        allocated_nodes_str = r["allocated_nodes"]
        allocated_nodes_list = [n.strip() for n in allocated_nodes_str.split(",") if n.strip()] if allocated_nodes_str else []

        carrier_ids_str = r["all_carrier_ids"]
        carrier_ids_list = sorted(list(set(c.strip() for c in carrier_ids_str.split(",") if c.strip()))) if carrier_ids_str else []

        carrier_names_str = r["all_carrier_names"]
        carrier_names_list = sorted(list(set(c.strip() for c in carrier_names_str.split(",") if c.strip()))) if carrier_names_str else []

        items.append(
            OrderListItemSchema(
                order_id=r["order_id"],
                customer_id=r["customer_id"],
                order_time=r["order_time"],
                destination_zone_id=r["destination_zone_id"],
                zone_name=r["zone_name"],
                zone_city=r["zone_city"],
                zone_state=r["zone_state"],
                requested_service=r["requested_service"],
                order_priority=r["order_priority"],
                line_count=r["line_count"],
                total_units=r["total_units"],
                delivery_outcome_status=r["delivery_outcome_status"],
                delivery_on_time=r["delivery_on_time"],
                primary_carrier_id=r["primary_carrier_id"],
                carrier_name=r["carrier_name"],
                carrier_ids=carrier_ids_list,
                carrier_names=carrier_names_list,
                allocated_nodes=allocated_nodes_list,
                is_split=bool(r["is_split"]),
                order_total_inr=float(r["order_total_inr"])
            )
        )

    total_pages = math.ceil(total_count / page_size) if total_count > 0 else 1
    has_next = page < total_pages
    has_previous = page > 1

    paginated_data = PaginatedOrdersDataSchema(
        total_count=total_count,
        total_pages=total_pages,
        page=page,
        page_size=page_size,
        has_next=has_next,
        has_previous=has_previous,
        items=items
    )

    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(status="success", data=paginated_data, request_id=request_id)


@router.get(
    "/{order_id}",
    response_model=ApiResponseEnvelope[OrderDetailSchema],
    summary="Get detailed order header and SKU line items",
    dependencies=[Depends(verify_api_key)]
)
def get_order_detail(
    order_id: str,
    request: Request
):
    """
    Retrieves complete historical order header and SKU line items from SQLite.
    Returns 404 if the order identifier is not found.
    Allocation and shipment tracking histories are kept separate via their respective endpoints.
    """
    clean_order_id = order_id.strip()

    header_query = """
        SELECT 
            o.order_id,
            o.customer_id,
            o.order_time,
            o.destination_zone_id,
            COALESCE(z.zone_name, o.destination_zone_id) AS zone_name,
            o.destination_pincode,
            o.destination_city,
            o.destination_state,
            COALESCE(z.region, '') AS destination_region,
            o.requested_service,
            o.order_channel,
            o.order_priority,
            o.order_status,
            o.order_total_inr
        FROM orders o
        LEFT JOIN delivery_zones z ON o.destination_zone_id = z.delivery_zone_id
        WHERE o.order_id = ?
    """

    lines_query = """
        SELECT 
            ol.order_line_id,
            ol.line_number,
            ol.sku_id,
            COALESCE(s.sku_name, ol.sku_id) AS sku_name,
            COALESCE(s.category, 'General') AS sku_category,
            COALESCE(s.unit_weight_kg, 0.0) AS unit_weight_kg,
            ol.quantity,
            ol.unit_price_inr,
            ol.line_total_inr
        FROM order_lines ol
        LEFT JOIN skus s ON ol.sku_id = s.sku_id
        WHERE ol.order_id = ?
        ORDER BY ol.line_number ASC
    """

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(header_query, (clean_order_id,))
        order_row = cursor.fetchone()

        if not order_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order '{order_id}' was not found in historical baseline records."
            )

        cursor.execute(lines_query, (clean_order_id,))
        line_rows = cursor.fetchall()

    lines = [
        OrderLineItemDetailSchema(
            order_line_id=lr["order_line_id"],
            line_number=lr["line_number"],
            sku_id=lr["sku_id"],
            sku_name=lr["sku_name"],
            sku_category=lr["sku_category"],
            unit_weight_kg=float(lr["unit_weight_kg"]),
            quantity=int(lr["quantity"]),
            unit_price_inr=float(lr["unit_price_inr"]),
            line_total_inr=float(lr["line_total_inr"])
        )
        for lr in line_rows
    ]

    total_units = sum(l.quantity for l in lines)

    order_detail = OrderDetailSchema(
        order_id=order_row["order_id"],
        customer_id=order_row["customer_id"],
        order_time=order_row["order_time"],
        destination_zone_id=order_row["destination_zone_id"],
        zone_name=order_row["zone_name"],
        destination_pincode=order_row["destination_pincode"],
        destination_city=order_row["destination_city"],
        destination_state=order_row["destination_state"],
        destination_region=order_row["destination_region"],
        requested_service=order_row["requested_service"],
        order_channel=order_row["order_channel"],
        order_priority=order_row["order_priority"],
        order_status=order_row["order_status"],
        order_total_inr=float(order_row["order_total_inr"]),
        total_lines=len(lines),
        total_units=total_units,
        lines=lines
    )

    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(status="success", data=order_detail, request_id=request_id)

