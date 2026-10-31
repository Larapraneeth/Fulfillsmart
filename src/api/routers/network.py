"""
FulfillSmart Network Topology Router
Provides complete cartographic and operational topology for the Interactive India Network Map:
1. All 20 fulfillment nodes with exact database coordinates, capacities, and cumulative utilization.
2. All 50 delivery zones with documented urban city centroids, regions, and historical demand.
3. Historical shipment corridors with geodesic Haversine distance and straight-line disclosures.
"""
from typing import List, Dict, Tuple
from fastapi import APIRouter, Depends, Request

from src.db import get_db
from src.api.dependencies import verify_api_key
from src.api.utils.geo_centroids import ZONE_CITY_CENTROIDS, calculate_haversine_km
from src.api.schemas.network import (
    NodeTopologyItemSchema,
    ZoneTopologyItemSchema,
    HistoricalRouteCorridorSchema,
    NetworkTopologyDataSchema
)
from src.api.schemas.common import ApiResponseEnvelope

router = APIRouter(prefix="/api/v1/network", tags=["Network Topology"])


@router.get(
    "/topology",
    response_model=ApiResponseEnvelope[NetworkTopologyDataSchema],
    summary="Retrieve complete India fulfillment network topology, nodes, zones, and corridors",
    dependencies=[Depends(verify_api_key)]
)
def get_network_topology(request: Request):
    """
    Returns authentic network metadata:
    - 20 fulfillment nodes with exact database coordinates (WGS-84) and operational capacity stats.
    - 50 delivery zones with documented approximate city centroids and historical order demand.
    - Historical shipment route corridors with straight-line Haversine distance and distance disclosures.
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # 1. Fetch fulfillment nodes + cumulative capacity usage
        node_query = """
            SELECT 
                fn.node_id,
                fn.node_name,
                fn.city,
                fn.state,
                fn.node_pincode,
                fn.node_type,
                fn.latitude,
                fn.longitude,
                fn.is_active,
                COALESCE(ROUND(AVG(cu.max_orders)), 0) AS daily_order_capacity,
                COALESCE(ROUND(AVG(cu.max_units)), 0) AS daily_unit_capacity,
                COALESCE(SUM(cu.max_orders), 0) AS total_period_order_capacity,
                COALESCE(SUM(cu.max_units), 0) AS total_period_unit_capacity,
                COALESCE(SUM(cu.allocated_orders), 0) AS allocated_orders_total,
                COALESCE(SUM(cu.allocated_units), 0) AS allocated_units_total
            FROM fulfillment_nodes fn
            LEFT JOIN capacity_usage cu ON fn.node_id = cu.node_id
            GROUP BY fn.node_id
            ORDER BY fn.node_id
        """
        cursor.execute(node_query)
        node_rows = cursor.fetchall()

        nodes_data = []
        node_coords: Dict[str, Tuple[float, float, str]] = {}
        for r in node_rows:
            daily_order_cap = r["daily_order_capacity"]
            daily_unit_cap = r["daily_unit_capacity"]
            total_order_cap = r["total_period_order_capacity"]
            total_unit_cap = r["total_period_unit_capacity"]
            alloc_orders = r["allocated_orders_total"]
            alloc_units = r["allocated_units_total"]

            order_util = round((alloc_orders / total_order_cap * 100), 2) if total_order_cap > 0 else 0.0
            unit_util = round((alloc_units / total_unit_cap * 100), 2) if total_unit_cap > 0 else 0.0

            node_coords[r["node_id"]] = (float(r["latitude"]), float(r["longitude"]), r["city"])

            nodes_data.append(
                NodeTopologyItemSchema(
                    node_id=r["node_id"],
                    node_name=r["node_name"],
                    city=r["city"],
                    state=r["state"],
                    node_pincode=r["node_pincode"],
                    node_type=r["node_type"],
                    latitude=float(r["latitude"]),
                    longitude=float(r["longitude"]),
                    is_active=bool(r["is_active"]),
                    is_exact_coordinate=True,
                    coordinate_provenance="DATABASE_FULFILLMENT_NODES",
                    daily_order_capacity=int(daily_order_cap),
                    daily_unit_capacity=int(daily_unit_cap),
                    total_period_order_capacity=int(total_order_cap),
                    total_period_unit_capacity=int(total_unit_cap),
                    allocated_orders_total=int(alloc_orders),
                    allocated_units_total=int(alloc_units),
                    order_utilization_pct=order_util,
                    unit_utilization_pct=unit_util
                )
            )


        # 2. Fetch delivery zones + historical demand counts
        zone_query = """
            SELECT 
                dz.delivery_zone_id,
                dz.zone_name,
                dz.city,
                dz.state,
                dz.region,
                dz.synthetic_pincode,
                dz.distance_band,
                dz.is_active,
                COALESCE(COUNT(o.order_id), 0) AS total_orders_received
            FROM delivery_zones dz
            LEFT JOIN orders o ON dz.delivery_zone_id = o.destination_zone_id
            GROUP BY dz.delivery_zone_id
            ORDER BY dz.delivery_zone_id
        """
        cursor.execute(zone_query)
        zone_rows = cursor.fetchall()

        zones_data = []
        for z in zone_rows:
            zid = z["delivery_zone_id"]
            # Look up documented urban city centroid
            centroid = ZONE_CITY_CENTROIDS.get(zid, (20.5937, 78.9629))
            zones_data.append(
                ZoneTopologyItemSchema(
                    delivery_zone_id=zid,
                    zone_name=z["zone_name"],
                    city=z["city"],
                    state=z["state"],
                    region=z["region"],
                    synthetic_pincode=z["synthetic_pincode"],
                    distance_band=z["distance_band"],
                    is_active=bool(z["is_active"]),
                    latitude=centroid[0],
                    longitude=centroid[1],
                    is_exact_coordinate=False,
                    coordinate_provenance="APPROXIMATE_URBAN_CITY_CENTROID",
                    total_orders_received=int(z["total_orders_received"])
                )
            )

        # 3. Fetch top historical route corridors
        corridor_query = """
            SELECT 
                ad.node_id,
                o.destination_zone_id AS delivery_zone_id,
                z.city AS zone_city,
                s.carrier_id,
                c.carrier_name,
                COUNT(DISTINCT s.shipment_id) AS shipment_count
            FROM shipments s
            JOIN orders o ON s.order_id = o.order_id
            JOIN allocation_decisions ad ON s.order_id = ad.order_id
            JOIN delivery_zones z ON o.destination_zone_id = z.delivery_zone_id
            JOIN carriers c ON s.carrier_id = c.carrier_id
            GROUP BY ad.node_id, o.destination_zone_id, s.carrier_id
            ORDER BY shipment_count DESC
            LIMIT 150
        """
        cursor.execute(corridor_query)
        corridor_rows = cursor.fetchall()

        corridors_data = []
        for cr in corridor_rows:
            nid = cr["node_id"]
            zid = cr["delivery_zone_id"]
            n_coord = node_coords.get(nid, (0.0, 0.0, ""))
            z_coord = ZONE_CITY_CENTROIDS.get(zid, (0.0, 0.0))

            dist_km = calculate_haversine_km(n_coord[0], n_coord[1], z_coord[0], z_coord[1]) if n_coord[0] and z_coord[0] else 0.0

            corridors_data.append(
                HistoricalRouteCorridorSchema(
                    node_id=nid,
                    node_city=n_coord[2],
                    delivery_zone_id=zid,
                    zone_city=cr["zone_city"],
                    carrier_id=cr["carrier_id"],
                    carrier_name=cr["carrier_name"],
                    historical_shipment_count=int(cr["shipment_count"]),
                    haversine_distance_km=dist_km
                )
            )

    network_topology = NetworkTopologyDataSchema(
        nodes=nodes_data,
        delivery_zones=zones_data,
        historical_corridors=corridors_data
    )

    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(status="success", data=network_topology, request_id=request_id)
