"""
FulfillSmart Carrier & Promise API Schemas
Directly matches CarrierPromiseRequest and CarrierPromiseOutcome.
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class CarrierPromiseRequestSchema(BaseModel):
    order_id: str = Field(..., description="Customer order identifier")
    node_id: str = Field(..., description="Fulfillment node ID (e.g. FUL-2026-000001)")
    delivery_zone_id: str = Field(..., description="Destination delivery zone code (e.g. DZ-001)")
    requested_service: str = Field(..., description="Requested service level: STANDARD, EXPRESS, or SAME_DAY")
    allocation_date: str = Field(..., description="Warehouse processing date (YYYY-MM-DD)")
    order_time: str = Field(..., description="ISO 8601 order placement timestamp")
    allocated_line_count: int = Field(..., ge=1, description="Number of allocated line items")
    allocated_unit_count: int = Field(..., ge=1, description="Total units allocated")
    preferred_carrier_id: Optional[str] = Field(default=None, description="Optional preferred carrier ID")


class CalculatePromiseRequestSchema(BaseModel):
    dispatch_date: str = Field(..., description="Warehouse dispatch date (YYYY-MM-DD)")
    nominal_days: int = Field(..., ge=0, description="Nominal transit days for the service level")
    dest_state: str = Field(..., description="Destination state for synthetic holiday evaluation")


class CarrierPromiseOutcomeSchema(BaseModel):
    carrier_selection_id: str
    order_id: str
    node_id: str
    delivery_zone_id: str
    carrier_id: str
    carrier_name: str
    service_level_id: str
    selected_service: str
    allocation_date: str
    dispatch_date: str
    pickup_cutoff_time: str
    delivery_promise_id: str
    promised_delivery_date: str
    transit_business_days: int
    promise_status: str
    explanation: str
    is_success: bool
    exception_code: Optional[str] = None
    exception_detail: Optional[str] = None


class CarrierServiceLevelDistributionSchema(BaseModel):
    service_code: str
    service_name: str
    shipment_count: int
    delayed_shipments: int
    on_time_rate_pct: float


class CarrierItemSchema(BaseModel):
    carrier_id: str
    carrier_name: str
    carrier_type: str
    supports_reverse_logistics: bool
    is_active: bool
    pickup_cutoff_time: str
    dispatch_window_start: str
    dispatch_window_end: str
    shipment_count: int
    delayed_shipments: int
    average_delay_days: float
    median_delay_days: float
    on_time_rate_pct: float
    delay_rate_pct: float
    covered_zones_count: int
    service_distribution: List[CarrierServiceLevelDistributionSchema]


class ServiceLevelPerformanceItemSchema(BaseModel):
    service_level_id: str
    carrier_id: str
    carrier_name: str
    service_code: str
    service_name: str
    nominal_transit_days: int
    max_weight_kg: float
    shipment_count: int
    delayed_shipments: int
    average_delay_days: float
    on_time_rate_pct: float


class MonthlyCarrierTrendItemSchema(BaseModel):
    month: str
    carrier_id: str
    carrier_name: str
    shipment_count: int
    delayed_shipments: int
    on_time_rate_pct: float


class CarrierSummarySchema(BaseModel):
    total_orders: int
    total_shipments: int
    delivered_on_time_shipments: int
    delayed_shipments: int
    shipment_on_time_rate_pct: float
    shipment_delay_rate_pct: float
    carrier_unavailable_orders: int
    carrier_unavailable_rate_pct: float
    total_carriers: int
    active_carriers: int
    total_service_levels: int
    total_service_zone_routes: int
    carrier_promise_coverage_rate_pct: float
    strict_on_time_order_rate_pct: float


class CarrierOverviewResponseSchema(BaseModel):
    summary: CarrierSummarySchema
    carriers: List[CarrierItemSchema]
    service_levels: List[ServiceLevelPerformanceItemSchema]
    monthly_trends: List[MonthlyCarrierTrendItemSchema]


class CarrierShipmentItemSchema(BaseModel):
    shipment_id: str
    order_id: str
    node_id: str
    node_name: str
    node_city: str
    service_level_id: str
    service_name: str
    service_code: str
    dispatch_date: str
    promised_delivery_date: str
    actual_delivery_date: str
    shipment_status: str
    is_delayed: int
    delay_days: int
    package_line_count: int
    package_unit_count: int
    destination_city: str
    destination_zone_id: str


class CarrierDetailResponseSchema(BaseModel):
    carrier: CarrierItemSchema
    service_levels: List[ServiceLevelPerformanceItemSchema]
    covered_zones: List[Dict[str, Any]]
    recent_shipments: List[CarrierShipmentItemSchema]

