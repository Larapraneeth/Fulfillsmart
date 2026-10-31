r"""
FulfillSmart Simulation & What-If Scenario Configuration Module
Defines scenario parameters, what-if operational levers, strict validation,
and configurable synthetic logistics cost modeling.
"""
from dataclasses import dataclass, field
from datetime import datetime, date
import math
import re
from typing import Dict, List, Optional, Tuple, Set, Any


@dataclass
class SyntheticCostConfig:
    """
    Configurable synthetic logistics cost model for scenario trade-off comparison.
    IMPORTANT: Cost metrics are synthetic estimates for scenario trade-off analysis
    and must not be interpreted as contractual carrier rate card savings.
    """
    base_shipping_cost_inr: float = 50.0        # Base fixed shipping fee per parcel
    distance_cost_per_km_inr: float = 0.05      # Variable straight-line distance cost per km
    express_premium_multiplier: float = 1.5     # Express service markup (e.g. 1.5x base)
    same_day_premium_multiplier: float = 2.0    # Same day service markup (e.g. 2.0x base)
    handling_cost_per_unit_inr: float = 5.0     # Warehouse handling pick/pack cost per unit
    split_shipment_penalty_inr: float = 40.0    # Extra packaging & dispatch penalty per split shipment beyond 1


@dataclass
class SimulationScenarioConfig:
    """
    Specification of a what-if simulation scenario.
    Enforces strict configuration validation, conservative capacity rounding,
    and isolated in-memory execution parameters.
    """
    scenario_id: str
    scenario_name: str
    description: str = ""
    
    # 1. Fulfillment Node & Capacity Levers
    capacity_multiplier: float = 1.0  # >= 0.0. 0.0 means complete network capacity shutdown
    disabled_node_ids: List[str] = field(default_factory=list)
    node_capacity_overrides: Dict[str, Dict[str, int]] = field(default_factory=dict)
    
    # 2. Inventory Levers: (node_id, sku_id) -> delta (+/- integer)
    inventory_deltas: Dict[Tuple[str, str], int] = field(default_factory=dict)
    
    # 3. Carrier & Promise Levers
    disabled_carrier_ids: List[str] = field(default_factory=list)
    carrier_cutoff_overrides: Dict[str, str] = field(default_factory=dict)  # carrier_id -> "HH:MM"
    transit_day_deltas: Dict[Tuple[str, str], int] = field(default_factory=dict)  # (carrier_id, service_code) -> delta
    
    # 4. Allocation Policy Levers
    allow_split_shipments: bool = True
    
    # 5. Scope & Filtering Levers
    order_priority_filter: Optional[List[str]] = None
    date_range: Optional[Tuple[str, str]] = None  # (start_date, end_date) in YYYY-MM-DD
    order_limit: Optional[int] = None
    
    # 6. Cost Evaluation Model
    cost_config: SyntheticCostConfig = field(default_factory=SyntheticCostConfig)

    def validate(
        self,
        valid_node_ids: Optional[Set[str]] = None,
        valid_carrier_ids: Optional[Set[str]] = None,
        current_inventory: Optional[Dict[Tuple[str, str], int]] = None
    ) -> None:
        """
        Validates all configuration parameters and levers.
        Raises ValueError with clear, actionable explanation if constraints are violated.
        """
        # Validate scenario_id
        if not self.scenario_id or not isinstance(self.scenario_id, str):
            raise ValueError("Scenario ID must be a non-empty string.")
        if not re.match(r"^[A-Za-z0-9_-]+$", self.scenario_id):
            raise ValueError(f"Scenario ID '{self.scenario_id}' contains invalid characters. Use alphanumeric, dash, or underscore.")
            
        # Validate capacity_multiplier
        if self.capacity_multiplier < 0.0:
            raise ValueError(f"Capacity multiplier cannot be negative: {self.capacity_multiplier}")
            
        # Validate node IDs if known
        if valid_node_ids:
            for node_id in self.disabled_node_ids:
                if node_id not in valid_node_ids:
                    raise ValueError(f"Unknown disabled node_id: '{node_id}'")
            for node_id in self.node_capacity_overrides.keys():
                if node_id not in valid_node_ids:
                    raise ValueError(f"Unknown node_id in node_capacity_overrides: '{node_id}'")
                    
        # Validate node capacity override values
        for node_id, caps in self.node_capacity_overrides.items():
            if "orders" in caps and caps["orders"] < 0:
                raise ValueError(f"Node '{node_id}' orders capacity override cannot be negative: {caps['orders']}")
            if "units" in caps and caps["units"] < 0:
                raise ValueError(f"Node '{node_id}' units capacity override cannot be negative: {caps['units']}")

        # Validate carrier IDs if known
        if valid_carrier_ids:
            for carrier_id in self.disabled_carrier_ids:
                if carrier_id not in valid_carrier_ids:
                    raise ValueError(f"Unknown disabled carrier_id: '{carrier_id}'")
            for carrier_id in self.carrier_cutoff_overrides.keys():
                if carrier_id not in valid_carrier_ids:
                    raise ValueError(f"Unknown carrier_id in carrier_cutoff_overrides: '{carrier_id}'")

        # Validate carrier cutoff times
        for carrier_id, cutoff in self.carrier_cutoff_overrides.items():
            if not isinstance(cutoff, str) or not re.match(r"^([01]\d|2[0-3]):[0-5]\d$", cutoff):
                raise ValueError(f"Carrier '{carrier_id}' cutoff override '{cutoff}' is not a valid 24-hour time (HH:MM).")

        # Conflict prevention: disabled node cannot have capacity override
        conflicting_nodes = set(self.disabled_node_ids).intersection(set(self.node_capacity_overrides.keys()))
        if conflicting_nodes:
            raise ValueError(f"Conflicting overrides: Nodes {conflicting_nodes} cannot be both disabled and assigned capacity overrides.")

        # Conflict prevention: disabled carrier cannot have cutoff override
        conflicting_carriers = set(self.disabled_carrier_ids).intersection(set(self.carrier_cutoff_overrides.keys()))
        if conflicting_carriers:
            raise ValueError(f"Conflicting overrides: Carriers {conflicting_carriers} cannot be both disabled and assigned cutoff overrides.")

        # Validate date range
        if self.date_range:
            start_str, end_str = self.date_range
            try:
                start_dt = date.fromisoformat(start_str)
                end_dt = date.fromisoformat(end_str)
                if start_dt > end_dt:
                    raise ValueError(f"Invalid date range: start_date '{start_str}' is after end_date '{end_str}'.")
            except ValueError as ex:
                raise ValueError(f"Malformed date range ({start_str}, {end_str}): {str(ex)}")

        # Validate inventory deltas against current inventory (prevent negative resulting inventory)
        if current_inventory is not None:
            for (node_id, sku_id), delta in self.inventory_deltas.items():
                curr_stock = current_inventory.get((node_id, sku_id), 0)
                resulting_stock = curr_stock + delta
                if resulting_stock < 0:
                    raise ValueError(
                        f"Inventory delta for ({node_id}, {sku_id}) results in negative available stock: "
                        f"{curr_stock} + ({delta}) = {resulting_stock}"
                    )

    def apply_capacity_multiplier(self, base_capacity: int) -> int:
        """
        Applies conservative floor rounding to scaled capacity limits:
        simulated_capacity = int(math.floor(base_capacity * multiplier))
        Guarantees that capacity is never rounded up into fractional phantom orders.
        """
        return int(math.floor(base_capacity * self.capacity_multiplier))
