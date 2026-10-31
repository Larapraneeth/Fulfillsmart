"""
FulfillSmart Simulation API Schemas
Directly matches SimulationScenarioConfig, SimulationRunResult, and ScenarioComparisonReport.
"""
from typing import List, Dict, Optional, Tuple, Any
from pydantic import BaseModel, Field


class SyntheticCostConfigSchema(BaseModel):
    base_shipping_cost_inr: float = 50.0
    distance_cost_per_km_inr: float = 0.05
    express_premium_multiplier: float = 1.5
    same_day_premium_multiplier: float = 2.0
    handling_cost_per_unit_inr: float = 5.0
    split_shipment_penalty_inr: float = 40.0


class SimulationScenarioConfigSchema(BaseModel):
    scenario_id: str = Field(..., description="Unique alphanumeric scenario code")
    scenario_name: str = Field(..., description="Human-readable scenario name")
    description: Optional[str] = Field(default="", description="Scenario description")
    capacity_multiplier: float = Field(default=1.0, ge=0.0, description="Warehouse capacity multiplier (>= 0.0)")
    disabled_node_ids: List[str] = Field(default_factory=list, description="List of disabled fulfillment node IDs")
    node_capacity_overrides: Dict[str, Dict[str, int]] = Field(default_factory=dict, description="Per-node capacity overrides")
    inventory_deltas: Dict[str, int] = Field(default_factory=dict, description="Inventory adjustments keyed as 'node_id:sku_id'")
    disabled_carrier_ids: List[str] = Field(default_factory=list, description="List of disabled carrier IDs")
    carrier_cutoff_overrides: Dict[str, str] = Field(default_factory=dict, description="Carrier cutoff overrides (carrier_id -> HH:MM)")
    transit_day_deltas: Dict[str, int] = Field(default_factory=dict, description="Transit day adjustments keyed as 'carrier_id:service_code'")
    allow_split_shipments: bool = Field(default=True, description="Whether split allocations are permitted")
    order_priority_filter: Optional[List[str]] = Field(default=None, description="Optional priority filter (CRITICAL, HIGH, etc.)")
    date_range: Optional[Tuple[str, str]] = Field(default=None, description="Optional date range (start_date, end_date) in YYYY-MM-DD")
    order_limit: Optional[int] = Field(default=None, ge=1, description="Optional maximum orders to evaluate")
    cost_config: Optional[SyntheticCostConfigSchema] = Field(default_factory=SyntheticCostConfigSchema)


class RunSimulationRequestSchema(BaseModel):
    config: SimulationScenarioConfigSchema = Field(..., description="Scenario parameters and what-if levers")
    persist: bool = Field(default=True, description="Whether to persist results to SQLite sandbox tables")
    overwrite: bool = Field(default=False, description="Whether to overwrite existing run if run_id provided")
    run_id: Optional[str] = Field(default=None, description="Optional custom run ID")


class CompareSimulationRequestSchema(BaseModel):
    config: SimulationScenarioConfigSchema = Field(..., description="Scenario parameters and what-if levers")
    persist: bool = Field(default=True, description="Whether to persist results to SQLite sandbox tables")
    overwrite: bool = Field(default=False, description="Whether to overwrite existing run if run_id provided")
    run_id: Optional[str] = Field(default=None, description="Optional custom run ID")


class SimulationRunSummarySchema(BaseModel):
    run_id: str
    scenario_id: str
    scenario_name: str
    created_at: str
    summary_kpis: Dict[str, Any]
    node_order_counts: Dict[str, int]
    carrier_shipment_counts: Dict[str, int]
    total_inventory_reservations_count: int
    total_capacity_deductions_count: int


class ScenarioComparisonReportSchema(BaseModel):
    scenario_id: str
    scenario_name: str
    run_id: str
    order_cohort_size: int
    rate_deltas_pp: Dict[str, float]
    financial_deltas: Dict[str, float]
    volume_deltas: Dict[str, int]
    node_order_deltas: Dict[str, Dict[str, int]]
    carrier_shipment_deltas: Dict[str, Dict[str, int]]
    tradeoff_summary: str
    cost_disclaimer: str


class SimulationHistoryItemSchema(BaseModel):
    run_id: str
    scenario_name: str
    created_at: str
    simulated_orders_count: int
    notes: Optional[Dict[str, Any]] = None
