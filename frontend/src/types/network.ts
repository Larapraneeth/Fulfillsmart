/**
 * FulfillSmart Network Topology & Map TypeScript Interfaces
 * Directly matching FastAPI backend schemas from src/api/schemas/network.py
 * and supporting the Tactical Geographic Vector Canvas.
 */

export interface NodeTopologyItem {
  node_id: string;
  node_name: string;
  city: string;
  state: string;
  node_pincode: string;
  node_type: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
  is_exact_coordinate: boolean;
  coordinate_provenance: string;
  daily_order_capacity: number;
  daily_unit_capacity: number;
  total_period_order_capacity: number;
  total_period_unit_capacity: number;
  allocated_orders_total: number;
  allocated_units_total: number;
  order_utilization_pct: number;
  unit_utilization_pct: number;
}

export interface ZoneTopologyItem {
  delivery_zone_id: string;
  zone_name: string;
  city: string;
  state: string;
  region: string;
  synthetic_pincode: string;
  distance_band: string;
  is_active: boolean;
  latitude: number;
  longitude: number;
  is_exact_coordinate: boolean;
  coordinate_provenance: string;
  total_orders_received: number;
}

export interface HistoricalRouteCorridor {
  node_id: string;
  node_city: string;
  delivery_zone_id: string;
  zone_city: string;
  carrier_id: string;
  carrier_name: string;
  historical_shipment_count: number;
  haversine_distance_km: number;
  distance_type: string;
  distance_disclosure: string;
}

export interface NetworkTopologyData {
  nodes: NodeTopologyItem[];
  delivery_zones: ZoneTopologyItem[];
  historical_corridors: HistoricalRouteCorridor[];
}

/**
 * Tactical Map Filter & Viewport State
 */
export interface MapFilterState {
  selectedCarrierId: string; // 'ALL' or specific carrier_id e.g. 'CAR-001'
  minShipmentCount: number;  // 0, 80, 100, 120, etc.
  showCorridors: boolean;
  showDeliveryZones: boolean;
  showFulfillmentNodes: boolean;
  selectedNodeId: string | null;
  selectedZoneId: string | null;
}

/**
 * Vector Canvas Pan and Zoom Transform
 */
export interface MapTransform {
  x: number;
  y: number;
  k: number;
}

/**
 * Screen Coordinates Projected from [Longitude, Latitude]
 */
export interface ProjectedPoint {
  x: number;
  y: number;
}
