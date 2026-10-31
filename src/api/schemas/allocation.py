"""
FulfillSmart Allocation API Schemas
Directly matches OrderRequest, OrderLineRequest, AllocationDecisionRecord, and AllocationOutcome.
"""
from typing import List, Dict, Optional
from pydantic import BaseModel, Field


class OrderLineRequestSchema(BaseModel):
    order_line_id: str = Field(..., description="Unique order line item ID")
    sku_id: str = Field(..., description="SKU identifier")
    quantity: int = Field(..., gt=0, description="Quantity requested (must be positive integer)")


class OrderRequestSchema(BaseModel):
    order_id: str = Field(..., description="Unique customer order ID")
    customer_id: str = Field(..., description="Customer identifier")
    order_time: str = Field(..., description="ISO 8601 order placement timestamp")
    destination_zone_id: str = Field(..., description="Delivery destination zone code (e.g. DZ-001)")
    requested_service: str = Field(..., description="Service level requested: STANDARD, EXPRESS, or SAME_DAY")
    order_priority: str = Field(..., description="Order priority: CRITICAL, HIGH, NORMAL, or LOW")
    allow_splits: bool = Field(default=True, description="Whether multi-node split allocation is permitted")
    lines: List[OrderLineRequestSchema] = Field(..., min_length=1, description="List of order line items")


class BatchAllocationRequestSchema(BaseModel):
    orders: List[OrderRequestSchema] = Field(..., min_length=1, description="List of orders to allocate in batch")
    allow_splits: Optional[bool] = Field(default=None, description="Optional global override for allow_splits")


class AllocationDecisionRecordSchema(BaseModel):
    allocation_id: str
    order_id: str
    order_line_id: str
    node_id: str
    sku_id: str
    allocated_qty: int
    allocation_date: str
    allocation_type: str


class AllocationOutcomeSchema(BaseModel):
    order_id: str
    status: str
    allocation_type: str
    allocated_node_count: int
    total_units: int
    decisions: List[AllocationDecisionRecordSchema]
    explanation: str
    exceptions: List[Dict[str, str]] = Field(default_factory=list)


class ParticipatingNodeSchema(BaseModel):
    node_id: str
    node_name: str
    city: str
    state: str
    allocated_units: int
    line_count: int


class SplitOrderLineDecisionSchema(BaseModel):
    allocation_id: str
    order_line_id: str
    node_id: str
    node_name: str
    city: str
    sku_id: str
    sku_name: str
    allocated_qty: int
    allocation_date: str


class SplitOrderSummarySchema(BaseModel):
    order_id: str
    order_time: str
    destination_zone_id: str
    destination_city: str
    destination_state: str
    requested_service: str
    order_priority: str
    order_total_inr: float
    allocated_node_count: int
    total_units: int
    line_count: int
    participating_nodes: List[ParticipatingNodeSchema]
    decisions: List[SplitOrderLineDecisionSchema]


class NodeAllocationSummarySchema(BaseModel):
    node_id: str
    node_name: str
    city: str
    state: str
    allocated_orders: int
    allocated_units: int
    network_volume_share_pct: float
    order_capacity: int
    unit_capacity: int
    order_utilization_pct: float
    unit_utilization_pct: float


class AllocationMetricsSummarySchema(BaseModel):
    total_orders: int
    allocated_orders: int
    allocation_success_rate_pct: float
    single_node_orders: int
    single_node_rate_pct: float
    split_node_orders: int
    split_node_rate_pct: float
    total_units_allocated: int
    single_node_units: int
    split_node_units: int
    allocation_decisions_count: int
    sunday_orders_shifted: int
    warehouse_order_capacity_utilization_pct: float
    warehouse_unit_capacity_utilization_pct: float


class AllocationOverviewSchema(BaseModel):
    summary: AllocationMetricsSummarySchema
    split_orders: List[SplitOrderSummarySchema]
    node_distribution: List[NodeAllocationSummarySchema]

