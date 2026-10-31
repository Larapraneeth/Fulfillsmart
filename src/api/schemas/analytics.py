"""Analytics API response schemas.

All schemas are read‑only and derived from the historical database.
They deliberately avoid any live or simulated data.
"""

from datetime import date
from typing import List, Optional

from pydantic import BaseModel, Field, validator

class OverviewSchema(BaseModel):
    total_orders: int = Field(..., description="Historical total orders (baseline 50,000).")
    total_shipments: int = Field(..., description="Historical total shipments dispatched.")
    allocation_success_rate_pct: float = Field(..., description="% of orders successfully allocated (single + split).")
    order_on_time_rate_pct: float = Field(..., description="Order‑level on‑time delivery rate.")
    shipment_on_time_rate_pct: float = Field(..., description="Shipment‑level on‑time delivery rate.")
    carrier_unavailable_count: int = Field(..., description="Orders that could not be assigned a carrier.")
    delayed_shipments: int = Field(..., description="Shipments delivered later than promised.")
    delayed_shipments_pct: float = Field(..., description="Percentage of delayed shipments over total shipments.")

class MonthlyTrendItemSchema(BaseModel):
    month: str = Field(..., description="YYYY‑MM string.")
    orders: int = Field(..., description="Orders placed in the month.")
    shipments: int = Field(..., description="Shipments dispatched in the month.")
    on_time_shipments: int = Field(..., description="Shipments delivered on time.")
    delayed_shipments: int = Field(..., description="Shipments delivered late.")
    allocation_successful: int = Field(..., description="Orders successfully allocated.")
    allocation_failed: int = Field(..., description="Orders that could not be allocated.")

class TrendsResponseSchema(BaseModel):
    monthly: List[MonthlyTrendItemSchema]

class NodePerformanceItemSchema(BaseModel):
    node_id: str
    capacity_total: int
    capacity_used: int
    utilization_pct: float
    allocated_orders: int
    allocated_units: int

class FulfillmentResponseSchema(BaseModel):
    nodes: List[NodePerformanceItemSchema]

class CarrierPerformanceItemSchema(BaseModel):
    carrier_id: str
    total_shipments: int
    on_time_shipments: int
    delayed_shipments: int
    on_time_pct: float
    delayed_pct: float

class CarriersResponseSchema(BaseModel):
    carriers: List[CarrierPerformanceItemSchema]

class DeliveryOutcomeItemSchema(BaseModel):
    outcome: str = Field(..., description="Delivery outcome status, e.g., DELIVERED, LATE, UNRESOLVED.")
    count: int
    pct_of_shipments: float

class DeliveryResponseSchema(BaseModel):
    outcomes: List[DeliveryOutcomeItemSchema]

class AllocationDistributionItemSchema(BaseModel):
    type: str = Field(..., description="single_node or split_order")
    count: int
    pct_of_orders: float

class AllocationResponseSchema(BaseModel):
    total_orders: int
    successful_allocations: int
    failed_allocations: int
    distribution: List[AllocationDistributionItemSchema]

class ExportResponseSchema(BaseModel):
    csv_url: Optional[str] = Field(None, description="Presigned URL to download CSV export (if supported).")

# Wrapper envelope is added in router responses via ApiResponseEnvelope.
