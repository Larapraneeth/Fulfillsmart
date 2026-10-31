"""
FulfillSmart Metrics API Schemas
Directly matches MetricsService return structures.
"""
from typing import List, Dict, Any
from pydantic import BaseModel


class KpiItemSchema(BaseModel):
    metric: str
    value: float
    unit: str
    definition: str


class CarrierPerformanceItemSchema(BaseModel):
    carrier_id: str
    carrier_name: str
    shipment_count: int
    delayed_shipments: int
    average_delay_days: float
    median_delay_days: float
    on_time_rate_pct: float
    delay_rate_pct: float


class WarehouseUtilizationItemSchema(BaseModel):
    node_id: str
    active_node_days: int
    allocated_orders: int
    allocated_units: int
    order_capacity: int
    unit_capacity: int
    node_name: str
    city: str
    state: str
    order_utilization_pct: float
    unit_utilization_pct: float


class MonthlyTrendItemSchema(BaseModel):
    month: str
    orders: int
    on_time_orders: int
    completed_orders: int
    late_orders: int
    carrier_unavailable_orders: int
    on_time_rate_all_orders_pct: float
    completion_rate_pct: float


class HeadlineSummarySchema(BaseModel):
    total_orders: int
    allocated_orders: int
    allocation_success_rate_pct: float
    shipments: int
    order_on_time_rate_all_orders_pct: float
    order_on_time_rate_completed_pct: float
    order_on_time_rate_strict_all_orders_pct: float
    order_on_time_rate_strict_completed_pct: float
    carrier_unavailable_orders: int
    split_node_orders: int
    warehouse_order_capacity_utilization_pct: float
    warehouse_unit_capacity_utilization_pct: float

