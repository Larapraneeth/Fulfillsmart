"""
FulfillSmart Network Topology & Carrier Matrix Schemas
Provides structured schemas for node coordinates, delivery zone centroids,
historical route corridors, and carrier service zone availability.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class NodeTopologyItemSchema(BaseModel):
    node_id: str = Field(..., description="Fulfillment node identifier")
    node_name: str = Field(..., description="Warehouse hub name")
    city: str = Field(..., description="Hub city")
    state: str = Field(..., description="Hub state")
    node_pincode: str = Field(..., description="Hub postal code")
    node_type: str = Field(..., description="Facility operational type")
    latitude: float = Field(..., description="Exact facility latitude from master database")
    longitude: float = Field(..., description="Exact facility longitude from master database")
    is_active: bool = Field(..., description="Facility active status")
    is_exact_coordinate: bool = Field(True, description="True: coordinates are exact facility geolocations from database")
    coordinate_provenance: str = Field("DATABASE_FULFILLMENT_NODES", description="Data provenance of coordinates")
    daily_order_capacity: int = Field(..., description="Nominal daily order processing capacity limit (orders/day, averaged across active operating days)")
    daily_unit_capacity: int = Field(..., description="Nominal daily unit processing capacity limit (units/day, averaged across active operating days)")
    total_period_order_capacity: int = Field(..., description="Total cumulative order capacity ceiling across all operating days in the dataset period (SUM of daily max_orders)")
    total_period_unit_capacity: int = Field(..., description="Total cumulative unit capacity ceiling across all operating days in the dataset period (SUM of daily max_units)")
    allocated_orders_total: int = Field(..., description="Total cumulative orders allocated to this node across all operating days in the dataset period")
    allocated_units_total: int = Field(..., description="Total cumulative units allocated to this node across all operating days in the dataset period")
    order_utilization_pct: float = Field(..., description="Cumulative order capacity utilization percentage (allocated_orders_total / total_period_order_capacity * 100)")
    unit_utilization_pct: float = Field(..., description="Cumulative unit capacity utilization percentage (allocated_units_total / total_period_unit_capacity * 100)")



class ZoneTopologyItemSchema(BaseModel):
    delivery_zone_id: str = Field(..., description="Delivery zone identifier")
    zone_name: str = Field(..., description="Zone commercial name")
    city: str = Field(..., description="Urban hub city")
    state: str = Field(..., description="Zone state")
    region: str = Field(..., description="Geographic zone region (North, South, East, West)")
    synthetic_pincode: str = Field(..., description="Representative postal code")
    distance_band: str = Field(..., description="Operational distance band (LOCAL, REGIONAL, NATIONAL)")
    is_active: bool = Field(..., description="Zone active status")
    latitude: float = Field(..., description="Approximate urban city-centroid latitude")
    longitude: float = Field(..., description="Approximate urban city-centroid longitude")
    is_exact_coordinate: bool = Field(False, description="False: coordinates represent urban city centroids, not exact zone polygons")
    coordinate_provenance: str = Field("APPROXIMATE_URBAN_CITY_CENTROID", description="Data provenance of coordinates")
    total_orders_received: int = Field(..., description="Total cumulative customer orders destined for this zone")


class HistoricalRouteCorridorSchema(BaseModel):
    node_id: str = Field(..., description="Origin fulfillment node ID")
    node_city: str = Field(..., description="Origin city")
    delivery_zone_id: str = Field(..., description="Destination delivery zone ID")
    zone_city: str = Field(..., description="Destination city")
    carrier_id: str = Field(..., description="Transport carrier ID")
    carrier_name: str = Field(..., description="Transport carrier commercial name")
    historical_shipment_count: int = Field(..., description="Number of historical shipments traversing this corridor")
    haversine_distance_km: float = Field(..., description="Straight-line spherical geographic distance in kilometers")
    distance_type: str = Field("STRAIGHT_LINE_HAVERSINE_KM", description="Geodesic distance calculation method")
    distance_disclosure: str = Field(
        "Calculated as geodesic straight-line spherical displacement. Actual road distance and driving travel time depend on physical highway routing and are not currently calculated by this system.",
        description="Explicit disclosure regarding road vs straight-line distance"
    )


class NetworkTopologyDataSchema(BaseModel):
    nodes: List[NodeTopologyItemSchema] = Field(..., description="All 20 fulfillment nodes with actual database coordinates and capacity")
    delivery_zones: List[ZoneTopologyItemSchema] = Field(..., description="All 50 delivery zones with documented city centroids and demand")
    historical_corridors: List[HistoricalRouteCorridorSchema] = Field(..., description="Historical transport corridors between nodes and zones")


class CarrierZoneCoverageItemSchema(BaseModel):
    carrier_id: str = Field(..., description="Carrier identifier")
    carrier_name: str = Field(..., description="Carrier commercial name")
    delivery_zone_id: str = Field(..., description="Delivery zone identifier")
    zone_name: str = Field(..., description="Zone name")
    city: str = Field(..., description="Zone city")
    state: str = Field(..., description="Zone state")
    region: str = Field(..., description="Geographic region")
    standard_available: bool = Field(..., description="Whether Standard ground delivery is supported")
    express_available: bool = Field(..., description="Whether Express air delivery is supported")
    same_day_available: bool = Field(..., description="Whether Same-Day intra-city service is supported")


class CarrierServiceZoneMatrixDataSchema(BaseModel):
    total_matrix_entries: int = Field(..., description="Total coverage mappings defined in master database")
    carriers: List[Dict[str, str]] = Field(..., description="List of active carriers with IDs and names")
    coverage: List[CarrierZoneCoverageItemSchema] = Field(..., description="Carrier-to-zone service availability records")
