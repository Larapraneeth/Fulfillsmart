r"""
FulfillSmart Standard Simulation Scenarios
Pre-configured, database-verified operational scenarios for what-if evaluation.
"""
from typing import Dict, List
from src.engine.simulation_config import SimulationScenarioConfig, SyntheticCostConfig


def get_southern_hub_outage_scenario() -> SimulationScenarioConfig:
    """
    Scenario 1: Southern Hub Outage (Chennai)
    Target Node: FUL-2026-000005 (Chennai Fulfillment Centre, Tamil Nadu).
    Tests network resiliency and re-routing to Bengaluru (FUL-2026-000002)
    and Hyderabad (FUL-2026-000001).
    """
    return SimulationScenarioConfig(
        scenario_id="SCEN-OUTAGE-CHENNAI",
        scenario_name="Southern Hub Outage (Chennai FUL-2026-000005)",
        description=(
            "Simulates a full shutdown of Chennai fulfillment centre (FUL-2026-000005). "
            "Evaluates parcel re-routing to alternative southern hubs, increased shipping distance, "
            "and delivery promise impacts."
        ),
        disabled_node_ids=["FUL-2026-000005"],
        allow_split_shipments=True
    )


def get_carrier_cutoff_extension_scenario() -> SimulationScenarioConfig:
    """
    Scenario 2: Carrier Cutoff Extension (BlueDart)
    Target Carrier: CAR-001 (BlueDart, baseline cutoff: 12:00).
    Extends cutoff to 16:00 to evaluate same-day dispatch eligibility for afternoon orders.
    """
    return SimulationScenarioConfig(
        scenario_id="SCEN-CUTOFF-BLUEDART",
        scenario_name="Carrier Cutoff Extension (BlueDart CAR-001)",
        description=(
            "Extends BlueDart (CAR-001) daily pickup cutoff time from 12:00 to 16:00. "
            "Enables same-day warehouse dispatch for orders placed between 12:00 and 16:00, "
            "reducing end-to-end customer delivery transit days."
        ),
        carrier_cutoff_overrides={"CAR-001": "16:00"},
        allow_split_shipments=True
    )


def get_peak_surge_scenario() -> SimulationScenarioConfig:
    """
    Scenario 3: Peak Festival Capacity Surge
    Applies +30% capacity expansion across all warehouse nodes.
    Relieves order and unit capacity bottlenecks during high-volume periods.
    """
    return SimulationScenarioConfig(
        scenario_id="SCEN-PEAK-SURGE",
        scenario_name="Peak Festival Capacity Surge (+30%)",
        description=(
            "Simulates a 30% temporary capacity expansion across all 20 fulfillment nodes "
            "to alleviate bottleneck constraints during seasonal e-commerce sales surges."
        ),
        capacity_multiplier=1.30,
        allow_split_shipments=True
    )


def get_strict_single_node_scenario() -> SimulationScenarioConfig:
    """
    Scenario 4: Strict Single-Node Policy (No Splits)
    Disallows multi-node split fallbacks.
    Eliminates multi-parcel deliveries and split handling penalties.
    """
    return SimulationScenarioConfig(
        scenario_id="SCEN-NO-SPLIT",
        scenario_name="Strict Single-Node Policy (No Splits)",
        description=(
            "Disallows multi-warehouse split allocations. An order must either be fulfilled "
            "100% from a single node with complete inventory and capacity, or remain unallocated. "
            "Eliminates multi-package customer deliveries and split penalties."
        ),
        allow_split_shipments=False
    )


STANDARD_SCENARIO_BUILDERS = {
    "SCEN-OUTAGE-CHENNAI": get_southern_hub_outage_scenario,
    "SCEN-CUTOFF-BLUEDART": get_carrier_cutoff_extension_scenario,
    "SCEN-PEAK-SURGE": get_peak_surge_scenario,
    "SCEN-NO-SPLIT": get_strict_single_node_scenario,
}


def get_standard_scenarios() -> Dict[str, SimulationScenarioConfig]:
    """Return all pre-configured standard scenarios."""
    return {k: builder() for k, builder in STANDARD_SCENARIO_BUILDERS.items()}


def get_standard_scenario(scenario_id: str) -> SimulationScenarioConfig:
    """Retrieve a specific standard scenario by ID."""
    builder = STANDARD_SCENARIO_BUILDERS.get(scenario_id)
    if not builder:
        raise ValueError(
            f"Unknown standard scenario ID: '{scenario_id}'. "
            f"Available scenarios: {list(STANDARD_SCENARIO_BUILDERS.keys())}"
        )
    return builder()
