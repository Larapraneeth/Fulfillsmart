r"""
FulfillSmart Scenario Comparator Module
Computes comparative baseline vs. scenario delta analytics using strict operational KPIs.
Reports all percentage rate differences in percentage points (pp) against the exact order cohort.
"""
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Tuple, Any
import sqlite3

from src.db import get_db
from src.engine.distance import distance_service
from src.engine.simulation import SimulationRunResult
from src.engine.simulation_config import SyntheticCostConfig


@dataclass
class BaselineCohortMetrics:
    """Strict operational metrics calculated on the exact baseline order cohort."""
    total_orders: int
    allocated_orders: int
    unallocated_orders: int
    single_node_orders: int
    split_orders: int
    completed_orders: int
    on_time_orders: int
    late_orders: int
    carrier_unavailable_orders: int
    
    strict_on_time_rate_all_pct: float
    strict_on_time_rate_completed_pct: float
    split_order_rate_pct: float
    unallocated_rate_pct: float
    completion_rate_pct: float
    
    total_estimated_synthetic_cost_inr: float
    average_estimated_cost_per_order_inr: float
    
    node_order_counts: Dict[str, int]
    carrier_shipment_counts: Dict[str, int]


@dataclass
class ScenarioComparisonReport:
    """Comprehensive comparative evaluation of a simulation run vs. baseline cohort."""
    scenario_id: str
    scenario_name: str
    run_id: str
    order_cohort_size: int
    
    # Baseline Metrics
    baseline: BaselineCohortMetrics
    
    # Simulated Metrics
    simulated: Dict[str, Any]
    
    # Percentage-Point Rate Deltas (pp = simulated - baseline)
    delta_on_time_rate_all_pp: float
    delta_on_time_rate_completed_pp: float
    delta_split_order_rate_pp: float
    delta_unallocated_rate_pp: float
    delta_completion_rate_pp: float
    
    # Financial & Absolute Deltas
    delta_total_synthetic_cost_inr: float
    delta_avg_cost_per_order_inr: float
    delta_on_time_orders_count: int
    delta_unallocated_orders_count: int
    delta_split_orders_count: int
    
    # Node & Carrier Redistribution
    node_order_deltas: Dict[str, Dict[str, int]]  # node_id -> {"baseline": int, "simulated": int, "delta": int}
    carrier_shipment_deltas: Dict[str, Dict[str, int]]  # carrier_id -> {"baseline": int, "simulated": int, "delta": int}

    # Operational trade-off commentary
    tradeoff_summary: str
    cost_disclaimer: str = (
        "IMPORTANT: Cost metrics are synthetic estimates for scenario trade-off comparison "
        "and must not be interpreted as contractual carrier rate card savings."
    )

    def to_dict(self) -> Dict[str, Any]:
        """Convert comparison report to a structured dictionary."""
        return {
            "scenario_id": self.scenario_id,
            "scenario_name": self.scenario_name,
            "run_id": self.run_id,
            "order_cohort_size": self.order_cohort_size,
            "rate_deltas_pp": {
                "on_time_rate_all_pp": round(self.delta_on_time_rate_all_pp, 4),
                "on_time_rate_completed_pp": round(self.delta_on_time_rate_completed_pp, 4),
                "split_order_rate_pp": round(self.delta_split_order_rate_pp, 4),
                "unallocated_rate_pp": round(self.delta_unallocated_rate_pp, 4),
                "completion_rate_pp": round(self.delta_completion_rate_pp, 4)
            },
            "financial_deltas": {
                "delta_total_synthetic_cost_inr": round(self.delta_total_synthetic_cost_inr, 2),
                "delta_avg_cost_per_order_inr": round(self.delta_avg_cost_per_order_inr, 2)
            },
            "volume_deltas": {
                "delta_on_time_orders_count": self.delta_on_time_orders_count,
                "delta_unallocated_orders_count": self.delta_unallocated_orders_count,
                "delta_split_orders_count": self.delta_split_orders_count
            },
            "node_order_deltas": self.node_order_deltas,
            "carrier_shipment_deltas": self.carrier_shipment_deltas,
            "tradeoff_summary": self.tradeoff_summary,
            "cost_disclaimer": self.cost_disclaimer
        }


class ScenarioComparator:
    """
    Evaluates scenario simulation outcomes against exact historical baseline cohorts.
    Guarantees strict operational KPI calculations, percentage-point precision,
    and fair synthetic cost baseline matching.
    """
    def compare(
        self,
        sim_result: SimulationRunResult,
        cost_config: Optional[SyntheticCostConfig] = None
    ) -> ScenarioComparisonReport:
        """
        Generates a comparative baseline vs. scenario evaluation for the simulation run.
        """
        active_cost_config = cost_config or SyntheticCostConfig()
        cohort_order_ids = [o.order_id for o in sim_result.order_outcomes]
        
        # 1. Compute exact baseline metrics on the same cohort
        baseline = self._compute_baseline_cohort(cohort_order_ids, active_cost_config)

        # 2. Compute percentage-point deltas
        delta_on_time_all = sim_result.strict_on_time_rate_all_pct - baseline.strict_on_time_rate_all_pct
        delta_on_time_comp = sim_result.strict_on_time_rate_completed_pct - baseline.strict_on_time_rate_completed_pct
        delta_split = sim_result.split_order_rate_pct - baseline.split_order_rate_pct
        delta_unalloc = sim_result.unallocated_rate_pct - baseline.unallocated_rate_pct
        delta_comp = sim_result.completion_rate_pct - baseline.completion_rate_pct
        
        delta_cost = sim_result.total_estimated_synthetic_cost_inr - baseline.total_estimated_synthetic_cost_inr
        delta_avg_cost = sim_result.average_estimated_cost_per_order_inr - baseline.average_estimated_cost_per_order_inr
        delta_on_time_count = sim_result.on_time_orders - baseline.on_time_orders
        delta_unalloc_count = sim_result.unallocated_orders - baseline.unallocated_orders
        delta_split_count = sim_result.split_orders - baseline.split_orders

        # 3. Compute Node Redistribution
        all_nodes = set(baseline.node_order_counts.keys()).union(set(sim_result.node_order_counts.keys()))
        node_deltas = {}
        for nid in sorted(all_nodes):
            b_cnt = baseline.node_order_counts.get(nid, 0)
            s_cnt = sim_result.node_order_counts.get(nid, 0)
            node_deltas[nid] = {
                "baseline": b_cnt,
                "simulated": s_cnt,
                "delta": s_cnt - b_cnt
            }

        # 4. Compute Carrier Redistribution
        all_carriers = set(baseline.carrier_shipment_counts.keys()).union(set(sim_result.carrier_shipment_counts.keys()))
        carrier_deltas = {}
        for cid in sorted(all_carriers):
            b_cnt = baseline.carrier_shipment_counts.get(cid, 0)
            s_cnt = sim_result.carrier_shipment_counts.get(cid, 0)
            carrier_deltas[cid] = {
                "baseline": b_cnt,
                "simulated": s_cnt,
                "delta": s_cnt - b_cnt
            }

        # 5. Formulate Operational Trade-off Summary
        summary_points = []
        if abs(delta_on_time_all) >= 0.01:
            direction = "improved" if delta_on_time_all > 0 else "degraded"
            summary_points.append(f"On-time delivery {direction} by {abs(delta_on_time_all):.2f} pp")
        if abs(delta_split) >= 0.01:
            summary_points.append(f"split shipments shifted by {delta_split:+.2f} pp")
        if abs(delta_unalloc) >= 0.01:
            summary_points.append(f"unallocated orders shifted by {delta_unalloc:+.2f} pp")
        if abs(delta_cost) >= 1.0:
            summary_points.append(f"estimated synthetic cost shifted by {delta_cost:+,.2f} INR")
            
        tradeoff_summary = (
            f"Scenario '{sim_result.scenario_name}' on cohort of {len(cohort_order_ids)} orders: " +
            ("; ".join(summary_points) if summary_points else "operations remained identical to baseline.")
        )

        return ScenarioComparisonReport(
            scenario_id=sim_result.scenario_id,
            scenario_name=sim_result.scenario_name,
            run_id=sim_result.run_id,
            order_cohort_size=len(cohort_order_ids),
            baseline=baseline,
            simulated=sim_result.to_report_dict()["summary_kpis"],
            delta_on_time_rate_all_pp=round(delta_on_time_all, 4),
            delta_on_time_rate_completed_pp=round(delta_on_time_comp, 4),
            delta_split_order_rate_pp=round(delta_split, 4),
            delta_unallocated_rate_pp=round(delta_unalloc, 4),
            delta_completion_rate_pp=round(delta_comp, 4),
            delta_total_synthetic_cost_inr=round(delta_cost, 2),
            delta_avg_cost_per_order_inr=round(delta_avg_cost, 2),
            delta_on_time_orders_count=delta_on_time_count,
            delta_unallocated_orders_count=delta_unalloc_count,
            delta_split_orders_count=delta_split_count,
            node_order_deltas=node_deltas,
            carrier_shipment_deltas=carrier_deltas,
            tradeoff_summary=tradeoff_summary
        )

    def _compute_baseline_cohort(
        self,
        order_ids: List[str],
        cost_config: SyntheticCostConfig
    ) -> BaselineCohortMetrics:
        """
        Computes strict baseline operational KPIs across the given order IDs.
        """
        if not order_ids:
            return BaselineCohortMetrics(
                total_orders=0, allocated_orders=0, unallocated_orders=0,
                single_node_orders=0, split_orders=0, completed_orders=0,
                on_time_orders=0, late_orders=0, carrier_unavailable_orders=0,
                strict_on_time_rate_all_pct=0.0, strict_on_time_rate_completed_pct=0.0,
                split_order_rate_pct=0.0, unallocated_rate_pct=0.0, completion_rate_pct=0.0,
                total_estimated_synthetic_cost_inr=0.0, average_estimated_cost_per_order_inr=0.0,
                node_order_counts={}, carrier_shipment_counts={}
            )

        with get_db() as conn:
            cursor = conn.cursor()
            placeholders = ",".join("?" for _ in order_ids)

            # 1. Allocation status & type
            cursor.execute(f"""
                SELECT order_id, allocation_status, allocation_type, allocated_node_count, total_units
                FROM order_allocation_summary
                WHERE order_id IN ({placeholders})
            """, order_ids)
            alloc_rows = cursor.fetchall()

            # 2. Delivery outcomes
            cursor.execute(f"""
                SELECT order_id, delivery_outcome_status, delivery_completed, delivery_on_time
                FROM delivery_outcomes
                WHERE order_id IN ({placeholders})
            """, order_ids)
            outcome_rows = cursor.fetchall()

            # 3. Shipments for cost and network volume calculation
            cursor.execute(f"""
                SELECT s.order_id, s.node_id, s.carrier_id, s.package_unit_count, o.destination_zone_id, o.requested_service
                FROM shipments s
                JOIN orders o ON s.order_id = o.order_id
                WHERE s.order_id IN ({placeholders})
            """, order_ids)
            shipment_rows = cursor.fetchall()

        total_orders = len(order_ids)
        allocated_orders = sum(1 for r in alloc_rows if r["allocation_status"] == "ALLOCATED")
        unallocated_orders = total_orders - allocated_orders
        single_orders = sum(1 for r in alloc_rows if r["allocation_type"] == "SINGLE_NODE")
        split_orders = sum(1 for r in alloc_rows if r["allocation_type"] == "SPLIT_NODE")

        # Map outcomes
        outcomes_by_order = {r["order_id"]: r for r in outcome_rows}
        completed_orders = sum(1 for r in outcome_rows if int(r["delivery_completed"]) == 1)
        # Strict on-time operational definition: delivery_on_time == 1
        on_time_orders = sum(1 for r in outcome_rows if r["delivery_on_time"] == 1)
        late_orders = sum(1 for r in outcome_rows if r["delivery_outcome_status"] == "DELIVERED_LATE")
        carrier_unavail = sum(1 for r in outcome_rows if r["delivery_outcome_status"] == "CARRIER_UNAVAILABLE")

        # Synthetic cost computation on baseline shipments
        node_order_counts: Dict[str, Set[str]] = {}
        carrier_shipment_counts: Dict[str, int] = {}
        total_baseline_cost = 0.0

        shipments_by_order: Dict[str, List[Any]] = {}
        for s in shipment_rows:
            oid = s["order_id"]
            if oid not in shipments_by_order:
                shipments_by_order[oid] = []
            shipments_by_order[oid].append(s)

            nid = s["node_id"]
            if nid not in node_order_counts:
                node_order_counts[nid] = set()
            node_order_counts[nid].add(oid)

            cid = s["carrier_id"]
            carrier_shipment_counts[cid] = carrier_shipment_counts.get(cid, 0) + 1

        for oid, shps in shipments_by_order.items():
            order_cost = 0.0
            for s in shps:
                dist = distance_service.get_distance_km(s["node_id"], s["destination_zone_id"])
                mult = 1.0
                svc = s["requested_service"].upper()
                if svc == "EXPRESS":
                    mult = cost_config.express_premium_multiplier
                elif svc == "SAME_DAY":
                    mult = cost_config.same_day_premium_multiplier

                ship_cost = (
                    cost_config.base_shipping_cost_inr +
                    (dist * cost_config.distance_cost_per_km_inr * mult) +
                    (int(s["package_unit_count"]) * cost_config.handling_cost_per_unit_inr)
                )
                order_cost += ship_cost

            if len(shps) > 1:
                order_cost += (len(shps) - 1) * cost_config.split_shipment_penalty_inr
            total_baseline_cost += order_cost

        # Convert node set counts to integer counts
        final_node_counts = {k: len(v) for k, v in node_order_counts.items()}

        strict_on_time_all = (on_time_orders / total_orders * 100.0) if total_orders > 0 else 0.0
        strict_on_time_comp = (on_time_orders / completed_orders * 100.0) if completed_orders > 0 else 0.0
        split_rate = (split_orders / total_orders * 100.0) if total_orders > 0 else 0.0
        unalloc_rate = (unallocated_orders / total_orders * 100.0) if total_orders > 0 else 0.0
        comp_rate = (completed_orders / total_orders * 100.0) if total_orders > 0 else 0.0
        avg_cost = (total_baseline_cost / total_orders) if total_orders > 0 else 0.0

        return BaselineCohortMetrics(
            total_orders=total_orders,
            allocated_orders=allocated_orders,
            unallocated_orders=unallocated_orders,
            single_node_orders=single_orders,
            split_orders=split_orders,
            completed_orders=completed_orders,
            on_time_orders=on_time_orders,
            late_orders=late_orders,
            carrier_unavailable_orders=carrier_unavail,
            strict_on_time_rate_all_pct=strict_on_time_all,
            strict_on_time_rate_completed_pct=strict_on_time_comp,
            split_order_rate_pct=split_rate,
            unallocated_rate_pct=unalloc_rate,
            completion_rate_pct=comp_rate,
            total_estimated_synthetic_cost_inr=total_baseline_cost,
            average_estimated_cost_per_order_inr=avg_cost,
            node_order_counts=final_node_counts,
            carrier_shipment_counts=carrier_shipment_counts
        )
