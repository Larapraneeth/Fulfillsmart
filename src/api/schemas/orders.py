"""
FulfillSmart Orders Explorer API Schemas
Supports paginated searching, filtering, and sorting across the 50,000 baseline orders.
"""
from typing import List, Optional
from pydantic import BaseModel, Field


class OrderListItemSchema(BaseModel):
    order_id: str = Field(..., description="Unique order identifier")
    customer_id: str = Field(..., description="Customer identifier")
    order_time: str = Field(..., description="Order placement timestamp in ISO 8601")
    destination_zone_id: str = Field(..., description="Target delivery zone ID")
    zone_name: str = Field(..., description="Delivery zone title")
    zone_city: str = Field(..., description="Destination city")
    zone_state: str = Field(..., description="Destination state")
    requested_service: str = Field(..., description="Requested service level (STANDARD, EXPRESS, SAME_DAY)")
    order_priority: str = Field(..., description="Order priority tier (CRITICAL, HIGH, NORMAL, LOW)")
    line_count: int = Field(..., description="Number of distinct SKU line items in the order")
    total_units: int = Field(..., description="Total quantity of units across all order lines")
    delivery_outcome_status: Optional[str] = Field(None, description="Final operational delivery outcome")
    delivery_on_time: Optional[int] = Field(None, description="Binary on-time status flag (1=on-time, 0=late/unavailable)")
    primary_carrier_id: Optional[str] = Field(None, description="Assigned primary delivery carrier ID")
    carrier_name: Optional[str] = Field(None, description="Assigned primary carrier commercial name")
    carrier_ids: List[str] = Field(default_factory=list, description="All assigned carrier IDs for this order (preserves multi-carrier split orders)")
    carrier_names: List[str] = Field(default_factory=list, description="All assigned carrier names for this order (preserves multi-carrier split orders)")
    allocated_nodes: List[str] = Field(default_factory=list, description="Fulfillment warehouse node IDs allocated to this order")
    is_split: bool = Field(..., description="Whether fulfillment was split across multiple warehouse nodes")
    order_total_inr: float = Field(..., description="Total order monetary value in INR from orders table")


class PaginatedOrdersDataSchema(BaseModel):
    total_count: int = Field(..., description="Total matching order records in dataset")
    total_pages: int = Field(..., description="Total available pages at current page size")
    page: int = Field(..., description="Current 1-indexed page number")
    page_size: int = Field(..., description="Number of items per page")
    has_next: bool = Field(..., description="Whether subsequent pages exist")
    has_previous: bool = Field(..., description="Whether previous pages exist")
    items: List[OrderListItemSchema] = Field(..., description="Order list items for the requested page")


class OrderLineItemDetailSchema(BaseModel):
    order_line_id: str = Field(..., description="Unique order line identifier")
    line_number: int = Field(..., description="Sequential line item position within order")
    sku_id: str = Field(..., description="Stock keeping unit identifier")
    sku_name: str = Field(..., description="Descriptive SKU commercial title")
    sku_category: str = Field(..., description="Product category taxonomy")
    unit_weight_kg: float = Field(..., description="Per-unit physical weight in kilograms")
    quantity: int = Field(..., description="Ordered unit quantity")
    unit_price_inr: float = Field(..., description="Unit selling price in INR")
    line_total_inr: float = Field(..., description="Extended line item total (quantity * unit_price_inr)")


class OrderDetailSchema(BaseModel):
    order_id: str = Field(..., description="Unique order identifier")
    customer_id: str = Field(..., description="Customer identifier")
    order_time: str = Field(..., description="Order placement timestamp in ISO 8601")
    destination_zone_id: str = Field(..., description="Target delivery zone ID")
    zone_name: str = Field(..., description="Delivery zone title")
    destination_pincode: str = Field(..., description="Destination delivery postal code")
    destination_city: str = Field(..., description="Destination city")
    destination_state: str = Field(..., description="Destination state")
    destination_region: str = Field(..., description="Destination geographical region (North, South, East, West, etc.)")
    requested_service: str = Field(..., description="Requested service level (STANDARD, EXPRESS, SAME_DAY)")
    order_channel: str = Field(..., description="Ordering sales channel (MOBILE_APP, MARKETPLACE, WEB, etc.)")
    order_priority: str = Field(..., description="Order priority tier (CRITICAL, HIGH, NORMAL, LOW)")
    order_status: str = Field(..., description="Order status in pipeline (e.g. CREATED)")
    order_total_inr: float = Field(..., description="Total order monetary value in INR")
    total_lines: int = Field(..., description="Total distinct SKU line count")
    total_units: int = Field(..., description="Total unit volume across all lines")
    lines: List[OrderLineItemDetailSchema] = Field(..., description="Detailed SKU line items")

