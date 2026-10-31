"""
FulfillSmart Simulation & What-If Scenario Analysis Router
Exposes standard scenario templates, custom scenario runs, comparative delta analytics, and run history.
"""
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
import json
import sqlite3

from src.db import get_db, get_db_context
from src.engine.simulation import SimulationEngine, SimulationRunResult
from src.engine.simulation_config import SimulationScenarioConfig, SyntheticCostConfig
from src.engine.scenario_comparator import ScenarioComparator
from src.engine.standard_scenarios import (
    get_standard_scenarios,
    get_standard_scenario
)
from src.api.dependencies import (
    verify_api_key,
    get_simulation_engine,
    get_scenario_comparator
)
from src.api.schemas.simulation import (
    SimulationScenarioConfigSchema,
    RunSimulationRequestSchema,
    CompareSimulationRequestSchema,
    SimulationRunSummarySchema,
    ScenarioComparisonReportSchema,
    SimulationHistoryItemSchema
)
from src.api.schemas.common import ApiResponseEnvelope

router = APIRouter(prefix="/api/v1/simulation", tags=["What-If Simulation & Scenarios"])


def _schema_to_domain_config(s: SimulationScenarioConfigSchema) -> SimulationScenarioConfig:
    """Converts Pydantic scenario schema to domain SimulationScenarioConfig dataclass."""
    # Convert string-keyed tuples back to Tuple[str, str]
    inv_deltas = {}
    for k, v in s.inventory_deltas.items():
        if ":" in k:
            parts = k.split(":", 1)
            inv_deltas[(parts[0], parts[1])] = v
        else:
            inv_deltas[(k, "")] = v

    transit_deltas = {}
    for k, v in s.transit_day_deltas.items():
        if ":" in k:
            parts = k.split(":", 1)
            transit_deltas[(parts[0], parts[1])] = v
        else:
            transit_deltas[(k, "")] = v

    cost_cfg = SyntheticCostConfig()
    if s.cost_config:
        cost_cfg = SyntheticCostConfig(
            base_shipping_cost_inr=s.cost_config.base_shipping_cost_inr,
            distance_cost_per_km_inr=s.cost_config.distance_cost_per_km_inr,
            express_premium_multiplier=s.cost_config.express_premium_multiplier,
            same_day_premium_multiplier=s.cost_config.same_day_premium_multiplier,
            handling_cost_per_unit_inr=s.cost_config.handling_cost_per_unit_inr,
            split_shipment_penalty_inr=s.cost_config.split_shipment_penalty_inr
        )

    return SimulationScenarioConfig(
        scenario_id=s.scenario_id,
        scenario_name=s.scenario_name,
        description=s.description or "",
        capacity_multiplier=s.capacity_multiplier,
        disabled_node_ids=s.disabled_node_ids,
        node_capacity_overrides=s.node_capacity_overrides,
        inventory_deltas=inv_deltas,
        disabled_carrier_ids=s.disabled_carrier_ids,
        carrier_cutoff_overrides=s.carrier_cutoff_overrides,
        transit_day_deltas=transit_deltas,
        allow_split_shipments=s.allow_split_shipments,
        order_priority_filter=s.order_priority_filter,
        date_range=s.date_range,
        order_limit=s.order_limit,
        cost_config=cost_cfg
    )


@router.get(
    "/scenarios/standard",
    response_model=ApiResponseEnvelope[List[Dict[str, Any]]],
    summary="List the 4 database-verified standard operational scenarios",
    dependencies=[Depends(verify_api_key)]
)
def list_standard_scenarios(request: Request):
    """Returns pre-configured definitions for Chennai Outage, BlueDart Cutoff, Peak Surge, and No-Split."""
    standards = get_standard_scenarios()
    data = [
        {
            "scenario_id": sc.scenario_id,
            "scenario_name": sc.scenario_name,
            "description": sc.description,
            "capacity_multiplier": sc.capacity_multiplier,
            "disabled_node_ids": sc.disabled_node_ids,
            "carrier_cutoff_overrides": sc.carrier_cutoff_overrides,
            "allow_split_shipments": sc.allow_split_shipments
        }
        for sc in standards.values()
    ]
    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(status="success", data=data, request_id=request_id)


@router.get(
    "/scenarios/standard/{scenario_id}",
    response_model=ApiResponseEnvelope[Dict[str, Any]],
    summary="Get configuration of a specific standard scenario",
    dependencies=[Depends(verify_api_key)]
)
def get_standard_scenario_detail(
    scenario_id: str,
    request: Request
):
    """Retrieves full configuration parameters for a specified standard scenario."""
    try:
        sc = get_standard_scenario(scenario_id)
    except ValueError as ex:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ex))

    data = {
        "scenario_id": sc.scenario_id,
        "scenario_name": sc.scenario_name,
        "description": sc.description,
        "capacity_multiplier": sc.capacity_multiplier,
        "disabled_node_ids": sc.disabled_node_ids,
        "node_capacity_overrides": sc.node_capacity_overrides,
        "carrier_cutoff_overrides": sc.carrier_cutoff_overrides,
        "allow_split_shipments": sc.allow_split_shipments
    }
    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(status="success", data=data, request_id=request_id)


@router.post(
    "/run",
    response_model=ApiResponseEnvelope[SimulationRunSummarySchema],
    summary="Execute a what-if simulation run (Persists to sandbox tables)",
    dependencies=[Depends(verify_api_key)]
)
def execute_simulation_run(
    payload: RunSimulationRequestSchema,
    request: Request,
    sim_engine=Depends(get_simulation_engine)
):
    """
    Executes a scenario simulation in an isolated in-memory sandbox.
    If persist=true, writes atomically to simulation_runs, simulation_orders,
    simulation_inventory_delta, and simulation_capacity_delta.
    """
    # Check for 409 Conflict if custom run_id specified and overwrite=False
    if payload.run_id and not payload.overwrite:
        with get_db_context() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM simulation_runs WHERE scenario_id = ?", (payload.run_id,))
            if cursor.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Simulation run '{payload.run_id}' already exists. Specify overwrite=true to replace."
                )

    try:
        domain_cfg = _schema_to_domain_config(payload.config)
        result = sim_engine.run_scenario(domain_cfg, run_id=payload.run_id)
        if payload.persist:
            sim_engine.persist_run(result, overwrite=payload.overwrite)
    except ValueError as ex:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ex))

    report = result.to_report_dict()
    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(
        status="success",
        data=SimulationRunSummarySchema(
            run_id=result.run_id,
            scenario_id=result.scenario_id,
            scenario_name=result.scenario_name,
            created_at=result.created_at,
            summary_kpis=report["summary_kpis"],
            node_order_counts=result.node_order_counts,
            carrier_shipment_counts=result.carrier_shipment_counts,
            total_inventory_reservations_count=len(result.inventory_reservations),
            total_capacity_deductions_count=len(result.capacity_deductions)
        ),
        request_id=request_id
    )


@router.post(
    "/compare",
    response_model=ApiResponseEnvelope[ScenarioComparisonReportSchema],
    summary="Execute simulation and compare against exact baseline cohort (Percentage-point deltas)",
    dependencies=[Depends(verify_api_key)]
)
def compare_simulation(
    payload: CompareSimulationRequestSchema,
    request: Request,
    sim_engine=Depends(get_simulation_engine),
    comparator=Depends(get_scenario_comparator)
):
    """
    Runs what-if simulation and computes comparative deltas against the exact historical cohort.
    Reports all delivery on-time, split, and unallocated rate differences in percentage points (pp).
    """
    if payload.run_id and not payload.overwrite:
        with get_db_context() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM simulation_runs WHERE scenario_id = ?", (payload.run_id,))
            if cursor.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Simulation run '{payload.run_id}' already exists. Specify overwrite=true to replace."
                )

    try:
        domain_cfg = _schema_to_domain_config(payload.config)
        result = sim_engine.run_scenario(domain_cfg, run_id=payload.run_id)
        if payload.persist:
            sim_engine.persist_run(result, overwrite=payload.overwrite)
        comparison = comparator.compare(result, cost_config=domain_cfg.cost_config)
    except ValueError as ex:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ex))

    comp_dict = comparison.to_dict()
    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(
        status="success",
        data=ScenarioComparisonReportSchema(
            scenario_id=comparison.scenario_id,
            scenario_name=comparison.scenario_name,
            run_id=comparison.run_id,
            order_cohort_size=comparison.order_cohort_size,
            rate_deltas_pp=comp_dict["rate_deltas_pp"],
            financial_deltas=comp_dict["financial_deltas"],
            volume_deltas=comp_dict["volume_deltas"],
            node_order_deltas=comp_dict["node_order_deltas"],
            carrier_shipment_deltas=comp_dict["carrier_shipment_deltas"],
            tradeoff_summary=comparison.tradeoff_summary,
            cost_disclaimer=comparison.cost_disclaimer
        ),
        request_id=request_id
    )


@router.get(
    "/history",
    response_model=ApiResponseEnvelope[List[SimulationHistoryItemSchema]],
    summary="Query simulation execution run history",
    dependencies=[Depends(verify_api_key)]
)
def get_simulation_history(request: Request):
    """Lists past simulation runs persisted in simulation_runs table."""
    with get_db_context() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT scenario_id, scenario_name, created_at, simulated_orders_count, notes
            FROM simulation_runs
            ORDER BY created_at DESC
        """)
        rows = cursor.fetchall()

    history = []
    for r in rows:
        notes_parsed = None
        if r["notes"]:
            try:
                notes_parsed = json.loads(r["notes"])
            except Exception:
                pass
        history.append(SimulationHistoryItemSchema(
            run_id=r["scenario_id"],
            scenario_name=r["scenario_name"],
            created_at=r["created_at"],
            simulated_orders_count=int(r["simulated_orders_count"]),
            notes=notes_parsed
        ))

    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(status="success", data=history, request_id=request_id)


@router.get(
    "/runs/{run_id}",
    response_model=ApiResponseEnvelope[Dict[str, Any]],
    summary="Reconstruct full scenario report from SQLite for a given run ID",
    dependencies=[Depends(verify_api_key)]
)
def get_persisted_run_report(
    run_id: str,
    request: Request,
    sim_engine=Depends(get_simulation_engine)
):
    """Reconstructs the full scenario report, summary KPIs, and delta analytics from SQLite."""
    report = sim_engine.load_persisted_run(run_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Persisted simulation report for run '{run_id}' was not found."
        )

    request_id = getattr(request.state, "request_id", None)
    return ApiResponseEnvelope(status="success", data=report, request_id=request_id)
