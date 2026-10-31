"""
FulfillSmart Tracking API Schemas
Directly matches TrackingEventRecord, LifecycleValidationResult, and OrderDeliveryOutcome.
"""
from typing import List, Optional
from pydantic import BaseModel, Field


class TrackingEventSchema(BaseModel):
    tracking_event_id: str = Field(..., description="Unique event identifier")
    shipment_id: str = Field(..., description="Shipment package identifier")
    order_id: str = Field(..., description="Customer order identifier")
    event_sequence: int = Field(..., ge=1, description="1-indexed contiguous event sequence")
    event_type: str = Field(..., description="Lifecycle event: PICKED_UP, IN_TRANSIT, DELIVERED, EXCEPTION")
    event_timestamp: str = Field(..., description="ISO 8601 event timestamp")
    event_location: str = Field(..., description="Geographic location of the tracking scan")
    event_description: str = Field(..., description="Human-readable event description")


class ValidateLifecycleRequestSchema(BaseModel):
    shipment_id: str = Field(..., description="Shipment ID to validate")
    events: List[TrackingEventSchema] = Field(..., min_length=1, description="List of tracking events")


class LifecycleValidationResultSchema(BaseModel):
    shipment_id: str
    is_valid: bool
    event_count: int
    terminal_status: str
    violations: List[str]


class ShipmentRecordSchema(BaseModel):
    shipment_id: str
    order_id: str
    node_id: str
    carrier_id: str
    service_level_id: str
    delivery_promise_id: str
    dispatch_date: str
    promised_delivery_date: str
    actual_delivery_date: Optional[str] = None
    shipment_status: str = "CREATED"
    is_delayed: int = 0
    delay_days: int = 0
    package_line_count: int = 1
    package_unit_count: int = 1


class OrderRollupRequestSchema(BaseModel):
    order_id: str
    order_time: str
    requested_service: str
    allocated_node_groups: int = Field(..., ge=1)
    shipments: List[ShipmentRecordSchema] = Field(default_factory=list)


class OrderDeliveryOutcomeSchema(BaseModel):
    order_id: str
    order_time: str
    requested_service: str
    allocated_node_groups: int
    shipment_count: int
    delivered_shipment_count: int
    latest_actual_delivery_date: Optional[str]
    latest_promised_delivery_date: Optional[str]
    delayed_shipment_count: int
    delivery_outcome_status: str
    delivery_completed: int
    delivery_on_time: Optional[int]


class DelayDistributionItemSchema(BaseModel):
    delay_days: int
    count: int
    percentage: float


class CarrierDeliveryPerformanceItemSchema(BaseModel):
    carrier_id: str
    carrier_name: str
    shipment_count: int
    delayed_shipments: int
    on_time_rate_pct: float
    average_delay_days: float


class NodeDeliveryPerformanceItemSchema(BaseModel):
    node_id: str
    node_name: str
    city: str
    state: str
    shipment_count: int
    delayed_shipments: int
    on_time_rate_pct: float
    average_delay_days: float


class TrackingOverviewSummarySchema(BaseModel):
    total_orders: int
    assigned_orders: int
    carrier_unavailable_orders: int
    carrier_unavailable_rate_pct: float
    total_shipments: int
    delivered_shipments: int
    in_transit_shipments: int
    on_time_shipments: int
    delayed_shipments: int
    shipment_on_time_rate_pct: float
    shipment_delay_rate_pct: float
    total_tracking_events: int
    picked_up_events: int
    delay_events: int
    delivered_events: int


class TrackingOverviewResponseSchema(BaseModel):
    summary: TrackingOverviewSummarySchema
    delay_distribution: List[DelayDistributionItemSchema]
    carrier_performance: List[CarrierDeliveryPerformanceItemSchema]
    node_performance: List[NodeDeliveryPerformanceItemSchema]


class ShipmentExplorerItemSchema(BaseModel):
    shipment_id: str
    order_id: str
    node_id: str
    node_name: str
    node_city: str
    carrier_id: str
    carrier_name: str
    service_level_id: str
    service_name: str
    service_code: str
    destination_city: str
    destination_zone_id: str
    dispatch_date: str
    promised_delivery_date: str
    actual_delivery_date: Optional[str] = None
    shipment_status: str
    is_delayed: int
    delay_days: int
    package_line_count: int
    package_unit_count: int
    events_count: int
    is_split: bool = False


class ShipmentPaginatedResponseSchema(BaseModel):
    items: List[ShipmentExplorerItemSchema]
    total_count: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_previous: bool


class ShipmentDetailResponseSchema(BaseModel):
    shipment: ShipmentExplorerItemSchema
    tracking_events: List[TrackingEventSchema]
    parent_order: Optional[dict] = None
    delivery_outcome: Optional[OrderDeliveryOutcomeSchema] = None
    sibling_shipments: List[ShipmentExplorerItemSchema] = []

