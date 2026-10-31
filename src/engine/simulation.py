r"""
FulfillSmart Simulation Engine Module
Executes what-if scenario simulations in an isolated in-memory sandbox.
Guarantees:
1. Strict isolation from historical database tables and CSV files.
2. Independent in-memory inventory and capacity tracking for each run.
3. Transactional atomic persistence to simulation_* sandbox tables.
4. Lossless scenario report reconstruction upon restart via structured JSON in simulation_runs.notes.
"""
from dataclasses import dataclass, field, asdict
from datetime import datetime, date, timedelta, timezone
import json
import math
from typing import Dict, List, Optional, Tuple, Set, Any
import uuid
import sqlite3

from src.db import get_db
from src.engine.allocation import (
    TransactionalAllocationState,
    FulfillmentAllocationEngine,
    OrderRequest,
    OrderLineRequest,
    AllocationOutcome,
    AllocationDecisionRecord
)
from src.engine.carrier_selection import (
    CarrierSelectionEngine,
    CarrierPromiseRequest,
    CarrierPromiseOutcome
)
from src.engine.distance import distance_service
from src.engine.simulation_config import SimulationScenarioConfig, SyntheticCostConfig
from src.engine.tracking import ShipmentTrackingEngine, ShipmentRecord, OrderDeliveryOutcome


@dataclass
class SimulationOrderOutcome:
    """Detailed simulated outcome for a single order in a what-if scenario run."""
    order_id: str
    customer_id: str
    order_time: str
    destination_zone_id: str
    requested_service: str
    order_priority: str
    order_total_inr: float
    total_units: int
    allocation_status: str              # ALLOCATED or UNALLOCATED
    allocation_type: str                # SINGLE_NODE, SPLIT_NODE, or NONE
    allocated_node_count: int
    participating_nodes: List[str]
    carrier_id: Optional[str]
    carrier_name: Optional[str]
    dispatch_date: Optional[str]
    promised_delivery_date: Optional[str]
    actual_delivery_date: Optional[str]
    delivery_outcome_status: str        # DELIVERED_ON_TIME, DELIVERED_LATE, CARRIER_UNAVAILABLE, UNALLOCATED
    delivery_completed: int             # 1 or 0
    delivery_on_time: Optional[int]     # 1, 0, or None
    estimated_synthetic_cost_inr: float
    decisions: List[Dict[str, Any]] = field(default_factory=list)
    exceptions: List[Dict[str, str]] = field(default_factory=list)


@dataclass
class SimulationRunResult:
    """Aggregated results and performance KPIs for a scenario simulation run."""
    run_id: str
    scenario_id: str
    scenario_name: str
    created_at: str
    config_snapshot: Dict[str, Any]
    
    # Order volumes
    total_orders: int
    total_units: int
    allocated_orders: int
    unallocated_orders: int
    single_node_orders: int
    split_orders: int
    completed_orders: int
    on_time_orders: int
    late_orders: int
    carrier_unavailable_orders: int
    
    # Strict Operational KPIs (Percentages)
    strict_on_time_rate_all_pct: float
    strict_on_time_rate_completed_pct: float
    split_order_rate_pct: float
    unallocated_rate_pct: float
    completion_rate_pct: float
    
    # Synthetic Cost Summary
    total_estimated_synthetic_cost_inr: float
    average_estimated_cost_per_order_inr: float
    
    # Network Shares
    node_order_counts: Dict[str, int]
    carrier_shipment_counts: Dict[str, int]
    
    # State Deltas
    inventory_reservations: Dict[Tuple[str, str], int] = field(default_factory=dict)
    capacity_deductions: Dict[Tuple[str, str], Dict[str, int]] = field(default_factory=dict)
    
    # Granular order results
    order_outcomes: List[SimulationOrderOutcome] = field(default_factory=list)

    def to_report_dict(self) -> Dict[str, Any]:
        """Convert run summary and KPIs to a JSON-serializable dictionary."""
        return {
            "run_id": self.run_id,
            "scenario_id": self.scenario_id,
            "scenario_name": self.scenario_name,
            "created_at": self.created_at,
            "config_snapshot": self.config_snapshot,
            "summary_kpis": {
                "total_orders": self.total_orders,
                "total_units": self.total_units,
                "allocated_orders": self.allocated_orders,
                "unallocated_orders": self.unallocated_orders,
                "single_node_orders": self.single_node_orders,
                "split_orders": self.split_orders,
                "completed_orders": self.completed_orders,
                "on_time_orders": self.on_time_orders,
                "late_orders": self.late_orders,
                "carrier_unavailable_orders": self.carrier_unavailable_orders,
                "strict_on_time_rate_all_pct": round(self.strict_on_time_rate_all_pct, 4),
                "strict_on_time_rate_completed_pct": round(self.strict_on_time_rate_completed_pct, 4),
                "split_order_rate_pct": round(self.split_order_rate_pct, 4),
                "unallocated_rate_pct": round(self.unallocated_rate_pct, 4),
                "completion_rate_pct": round(self.completion_rate_pct, 4),
                "total_estimated_synthetic_cost_inr": round(self.total_estimated_synthetic_cost_inr, 2),
                "average_estimated_cost_per_order_inr": round(self.average_estimated_cost_per_order_inr, 2),
            },
            "node_order_counts": self.node_order_counts,
            "carrier_shipment_counts": self.carrier_shipment_counts,
            "total_inventory_reservations_count": len(self.inventory_reservations),
            "total_capacity_deductions_count": len(self.capacity_deductions)
        }


class SimulationSandbox:
    """
    Constructs and isolates in-memory master data structures for a what-if simulation run.
    Guarantees fresh state snapshot for every execution.
    """
    def __init__(self, config: SimulationScenarioConfig):
        self.config = config
        
        # State structures
        self.inventory: Dict[Tuple[str, str], int] = {}
        self.capacity: Dict[Tuple[str, str], Dict[str, int]] = {}
        self.node_meta: Dict[str, Dict[str, str]] = {}
        self.carriers: Dict[str, Dict[str, Any]] = {}
        self.service_levels: Dict[Tuple[str, str], Dict[str, Any]] = {}
        self.service_zones: Dict[Tuple[str, str], Dict[str, bool]] = {}
        self.calendars: Dict[Tuple[str, str], Dict[str, Any]] = {}
        self.holidays: Dict[str, Dict[str, Any]] = {}
        self.zone_states: Dict[str, str] = {}
        
        self._clone_baseline_and_apply_overrides()

    def _clone_baseline_and_apply_overrides(self) -> None:
        """Load fresh baseline snapshot from SQLite and apply scenario levers."""
        with get_db() as conn:
            cursor = conn.cursor()
            
            # 1. Fulfillment Nodes
            cursor.execute("SELECT node_id, node_name, city, state, is_active FROM fulfillment_nodes WHERE is_active = 1")
            for r in cursor.fetchall():
                node_id = r["node_id"]
                is_active = (node_id not in self.config.disabled_node_ids)
                self.node_meta[node_id] = {
                    "node_name": r["node_name"],
                    "city": r["city"],
                    "state": r["state"],
                    "is_active": is_active
                }

            # 2. Inventory: available_qty = on_hand_qty - reserved_qty
            cursor.execute("SELECT node_id, sku_id, available_qty FROM inventory")
            for r in cursor.fetchall():
                key = (r["node_id"], r["sku_id"])
                self.inventory[key] = int(r["available_qty"])

            # Apply inventory deltas
            for (node_id, sku_id), delta in self.config.inventory_deltas.items():
                curr = self.inventory.get((node_id, sku_id), 0)
                self.inventory[(node_id, sku_id)] = max(0, curr + delta)

            # If node is disabled, zero out its inventory to prevent any single or split allocation
            for node_id in self.config.disabled_node_ids:
                for (n_id, sku_id) in list(self.inventory.keys()):
                    if n_id == node_id:
                        self.inventory[(n_id, sku_id)] = 0

            # 3. Warehouse Capacity
            cursor.execute("""
                SELECT node_id, capacity_date, max_orders, max_units, allocated_orders, allocated_units
                FROM warehouse_capacity
            """)
            for r in cursor.fetchall():
                node_id = r["node_id"]
                cap_date = r["capacity_date"]
                key = (node_id, cap_date)
                
                base_orders = max(0, int(r["max_orders"]) - int(r["allocated_orders"]))
                base_units = max(0, int(r["max_units"]) - int(r["allocated_units"]))
                
                # Apply capacity multiplier using conservative floor rounding
                sim_orders = self.config.apply_capacity_multiplier(base_orders)
                sim_units = self.config.apply_capacity_multiplier(base_units)
                
                # If node has specific overrides, apply them
                if node_id in self.config.node_capacity_overrides:
                    ovr = self.config.node_capacity_overrides[node_id]
                    if "orders" in ovr:
                        sim_orders = ovr["orders"]
                    if "units" in ovr:
                        sim_units = ovr["units"]
                        
                # If node is disabled, capacity is 0
                if node_id in self.config.disabled_node_ids or self.config.capacity_multiplier == 0.0:
                    sim_orders = 0
                    sim_units = 0
                    
                self.capacity[key] = {
                    "orders_rem": sim_orders,
                    "units_rem": sim_units
                }

            # 4. Carriers
            cursor.execute("SELECT carrier_id, carrier_name, carrier_type, supports_reverse_logistics FROM carriers WHERE is_active = 1")
            for r in cursor.fetchall():
                cid = r["carrier_id"]
                is_active = (cid not in self.config.disabled_carrier_ids)
                self.carriers[cid] = {
                    "carrier_name": r["carrier_name"],
                    "carrier_type": r["carrier_type"],
                    "supports_reverse_logistics": bool(r["supports_reverse_logistics"]),
                    "is_active": is_active
                }

            # 5. Service Levels
            cursor.execute("""
                SELECT service_level_id, carrier_id, service_code, service_name, nominal_transit_days, priority_rank, max_weight_kg
                FROM service_levels WHERE is_active = 1
            """)
            for r in cursor.fetchall():
                cid = r["carrier_id"]
                scode = r["service_code"].upper()
                key = (cid, scode)
                nominal_days = int(r["nominal_transit_days"])
                
                # Apply transit day deltas
                if key in self.config.transit_day_deltas:
                    nominal_days = max(0, nominal_days + self.config.transit_day_deltas[key])
                    
                self.service_levels[key] = {
                    "service_level_id": r["service_level_id"],
                    "service_name": r["service_name"],
                    "nominal_transit_days": nominal_days,
                    "priority_rank": int(r["priority_rank"]),
                    "max_weight_kg": float(r["max_weight_kg"])
                }

            # 6. Carrier Service Zones
            cursor.execute("""
                SELECT carrier_id, delivery_zone_id, standard_available, express_available, same_day_available
                FROM carrier_service_zones
            """)
            for r in cursor.fetchall():
                cid = r["carrier_id"]
                zid = r["delivery_zone_id"]
                key = (cid, zid)
                
                # If carrier disabled, services unavailable
                if cid in self.config.disabled_carrier_ids:
                    self.service_zones[key] = {"STANDARD": False, "EXPRESS": False, "SAME_DAY": False}
                else:
                    self.service_zones[key] = {
                        "STANDARD": bool(r["standard_available"]),
                        "EXPRESS": bool(r["express_available"]),
                        "SAME_DAY": bool(r["same_day_available"])
                    }

            # 7. Carrier Calendars
            cursor.execute("""
                SELECT carrier_id, calendar_date, is_operating_day, pickup_cutoff_time, dispatch_window_start, dispatch_window_end
                FROM carrier_calendar
            """)
            for r in cursor.fetchall():
                cid = r["carrier_id"]
                cdate = r["calendar_date"]
                key = (cid, cdate)
                cutoff = r["pickup_cutoff_time"]
                
                # Apply cutoff override if configured
                if cid in self.config.carrier_cutoff_overrides:
                    cutoff = self.config.carrier_cutoff_overrides[cid]
                    
                self.calendars[key] = {
                    "is_operating_day": bool(r["is_operating_day"]) and (cid not in self.config.disabled_carrier_ids),
                    "pickup_cutoff_time": cutoff,
                    "dispatch_window_start": r["dispatch_window_start"],
                    "dispatch_window_end": r["dispatch_window_end"]
                }

            # 8. Holidays & Delivery Zone States
            cursor.execute("SELECT holiday_date, holiday_name, state_scope, is_working_day FROM holidays")
            for r in cursor.fetchall():
                self.holidays[r["holiday_date"]] = {
                    "holiday_name": r["holiday_name"],
                    "state_scope": r["state_scope"],
                    "is_working_day": bool(r["is_working_day"])
                }

            cursor.execute("SELECT delivery_zone_id, state FROM delivery_zones")
            for r in cursor.fetchall():
                self.zone_states[r["delivery_zone_id"]] = r["state"]

    @property
    def carrier_engine_data(self) -> Dict[str, Any]:
        """Bundle sandboxed structures to initialize CarrierSelectionEngine."""
        return {
            "carriers": self.carriers,
            "service_levels": self.service_levels,
            "service_zones": self.service_zones,
            "calendars": self.calendars,
            "holidays": self.holidays,
            "zone_states": self.zone_states
        }


class SimulationEngine:
    """
    Core Deterministic Simulation Engine.
    Executes what-if scenario simulations with full transactional state isolation
    and atomic sandbox persistence.
    """
    def __init__(self):
        self.tracking_engine = ShipmentTrackingEngine()

    def run_scenario(
        self,
        config: SimulationScenarioConfig,
        run_id: Optional[str] = None
    ) -> SimulationRunResult:
        """
        Executes a full simulation run for the given scenario configuration.
        """
        # 1. Validate configuration
        with get_db() as conn:
            c = conn.cursor()
            c.execute("SELECT node_id FROM fulfillment_nodes")
            valid_nodes = {r["node_id"] for r in c.fetchall()}
            c.execute("SELECT carrier_id FROM carriers")
            valid_carriers = {r["carrier_id"] for r in c.fetchall()}
            c.execute("SELECT node_id, sku_id, available_qty FROM inventory")
            curr_inv = {(r["node_id"], r["sku_id"]): int(r["available_qty"]) for r in c.fetchall()}

        config.validate(valid_node_ids=valid_nodes, valid_carrier_ids=valid_carriers, current_inventory=curr_inv)

        now_str = datetime.now(timezone.utc).isoformat()
        active_run_id = run_id or f"{config.scenario_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"

        # 2. Build Sandbox
        sandbox = SimulationSandbox(config)
        
        # Clone initial states for tracking net reservations and deductions
        initial_inv_copy = dict(sandbox.inventory)
        initial_cap_copy = {k: dict(v) for k, v in sandbox.capacity.items()}

        # 3. Initialize Sandboxed Engines
        alloc_state = TransactionalAllocationState(
            simulation_mode=True,
            scenario_id=active_run_id,
            initial_inventory=sandbox.inventory,
            initial_capacity=sandbox.capacity,
            initial_node_meta=sandbox.node_meta
        )
        allocation_engine = FulfillmentAllocationEngine(
            state=alloc_state,
            allow_splits=config.allow_split_shipments
        )
        carrier_engine = CarrierSelectionEngine(initial_data=sandbox.carrier_engine_data)

        # 4. Load Candidate Orders
        orders = self._load_orders(config)

        # 5. Execute Simulation Loop
        order_outcomes: List[SimulationOrderOutcome] = []
        node_order_counts: Dict[str, int] = {}
        carrier_shipment_counts: Dict[str, int] = {}
        total_synthetic_cost = 0.0

        for order_req, order_total_inr in orders:
            # Step A: Fulfillment Allocation
            alloc_outcome = allocation_engine.allocate_order(order_req)
            
            if alloc_outcome.status != "ALLOCATED":
                # Order failed allocation
                order_outcomes.append(SimulationOrderOutcome(
                    order_id=order_req.order_id,
                    customer_id=order_req.customer_id,
                    order_time=order_req.order_time,
                    destination_zone_id=order_req.destination_zone_id,
                    requested_service=order_req.requested_service,
                    order_priority=order_req.order_priority,
                    order_total_inr=order_total_inr,
                    total_units=order_req.total_units,
                    allocation_status="UNALLOCATED",
                    allocation_type="NONE",
                    allocated_node_count=0,
                    participating_nodes=[],
                    carrier_id=None,
                    carrier_name=None,
                    dispatch_date=None,
                    promised_delivery_date=None,
                    actual_delivery_date=None,
                    delivery_outcome_status="UNALLOCATED",
                    delivery_completed=0,
                    delivery_on_time=None,
                    estimated_synthetic_cost_inr=0.0,
                    decisions=[],
                    exceptions=alloc_outcome.exceptions
                ))
                continue

            # Step B: Group allocation decisions by node for carrier assignment
            nodes_used = sorted(list({d.node_id for d in alloc_outcome.decisions}))
            for n in nodes_used:
                node_order_counts[n] = node_order_counts.get(n, 0) + 1

            sim_shipments: List[ShipmentRecord] = []
            selected_carrier_ids: List[str] = []
            selected_carrier_names: List[str] = []
            order_cost = 0.0
            order_exceptions: List[Dict[str, str]] = []

            for node_id in nodes_used:
                node_decisions = [d for d in alloc_outcome.decisions if d.node_id == node_id]
                node_units = sum(d.allocated_qty for d in node_decisions)
                node_lines = len(node_decisions)
                alloc_date = node_decisions[0].allocation_date

                carrier_req = CarrierPromiseRequest(
                    order_id=order_req.order_id,
                    node_id=node_id,
                    delivery_zone_id=order_req.destination_zone_id,
                    requested_service=order_req.requested_service,
                    allocation_date=alloc_date,
                    order_time=order_req.order_time,
                    allocated_line_count=node_lines,
                    allocated_unit_count=node_units
                )
                
                carrier_res = carrier_engine.select_carrier_and_promise(carrier_req)
                
                if not carrier_res.is_success:
                    order_exceptions.append({
                        "node_id": node_id,
                        "exception_code": carrier_res.exception_code or "CARRIER_SELECTION_FAILED",
                        "exception_detail": carrier_res.exception_detail or "No carrier could fulfill requested service."
                    })
                    continue

                selected_carrier_ids.append(carrier_res.carrier_id)
                selected_carrier_names.append(carrier_res.carrier_name)
                carrier_shipment_counts[carrier_res.carrier_id] = carrier_shipment_counts.get(carrier_res.carrier_id, 0) + 1

                # Simulate delivery date:
                # Under normal operations without carrier breakdown, parcel arrives on promise date
                sim_delivery_date = carrier_res.promised_delivery_date
                
                shipment_id = f"SIM-SHP-{order_req.order_id}-{node_id}"
                sim_shipments.append(ShipmentRecord(
                    shipment_id=shipment_id,
                    order_id=order_req.order_id,
                    node_id=node_id,
                    carrier_id=carrier_res.carrier_id,
                    service_level_id=carrier_res.service_level_id,
                    delivery_promise_id=carrier_res.delivery_promise_id,
                    dispatch_date=carrier_res.dispatch_date,
                    promised_delivery_date=carrier_res.promised_delivery_date,
                    actual_delivery_date=sim_delivery_date,
                    shipment_status="DELIVERED",
                    is_delayed=0,
                    delay_days=0,
                    package_line_count=node_lines,
                    package_unit_count=node_units
                ))

                # Compute synthetic cost for this shipment parcel
                dist_km = distance_service.get_distance_km(node_id, order_req.destination_zone_id)
                svc_multiplier = 1.0
                if order_req.requested_service.upper() == "EXPRESS":
                    svc_multiplier = config.cost_config.express_premium_multiplier
                elif order_req.requested_service.upper() == "SAME_DAY":
                    svc_multiplier = config.cost_config.same_day_premium_multiplier

                shipment_cost = (
                    config.cost_config.base_shipping_cost_inr +
                    (dist_km * config.cost_config.distance_cost_per_km_inr * svc_multiplier) +
                    (node_units * config.cost_config.handling_cost_per_unit_inr)
                )
                order_cost += shipment_cost

            # Multi-shipment split penalty
            if len(sim_shipments) > 1:
                order_cost += (len(sim_shipments) - 1) * config.cost_config.split_shipment_penalty_inr

            total_synthetic_cost += order_cost

            # Step C: Shipment Rollup
            rollup = self.tracking_engine.calculate_order_rollup(
                order_id=order_req.order_id,
                order_time=order_req.order_time,
                requested_service=order_req.requested_service,
                allocated_node_groups=len(nodes_used),
                shipments=sim_shipments
            )

            primary_carrier_id = selected_carrier_ids[0] if selected_carrier_ids else None
            primary_carrier_name = ", ".join(selected_carrier_names) if selected_carrier_names else None
            primary_dispatch = min((s.dispatch_date for s in sim_shipments), default=None)
            primary_promise = max((s.promised_delivery_date for s in sim_shipments), default=None)
            primary_actual = max((s.actual_delivery_date for s in sim_shipments), default=None)

            order_outcomes.append(SimulationOrderOutcome(
                order_id=order_req.order_id,
                customer_id=order_req.customer_id,
                order_time=order_req.order_time,
                destination_zone_id=order_req.destination_zone_id,
                requested_service=order_req.requested_service,
                order_priority=order_req.order_priority,
                order_total_inr=order_total_inr,
                total_units=order_req.total_units,
                allocation_status="ALLOCATED",
                allocation_type=alloc_outcome.allocation_type,
                allocated_node_count=len(nodes_used),
                participating_nodes=nodes_used,
                carrier_id=primary_carrier_id,
                carrier_name=primary_carrier_name,
                dispatch_date=primary_dispatch,
                promised_delivery_date=primary_promise,
                actual_delivery_date=primary_actual,
                delivery_outcome_status=rollup.delivery_outcome_status,
                delivery_completed=rollup.delivery_completed,
                delivery_on_time=rollup.delivery_on_time,
                estimated_synthetic_cost_inr=round(order_cost, 2),
                decisions=[asdict(d) for d in alloc_outcome.decisions],
                exceptions=order_exceptions
            ))

        # 6. Calculate Net State Deltas
        inventory_reservations: Dict[Tuple[str, str], int] = {}
        for key, init_qty in initial_inv_copy.items():
            final_qty = alloc_state._inventory.get(key, 0)
            diff = init_qty - final_qty
            if diff > 0:
                inventory_reservations[key] = diff

        capacity_deductions: Dict[Tuple[str, str], Dict[str, int]] = {}
        for key, init_cap in initial_cap_copy.items():
            final_cap = alloc_state._capacity.get(key, {"orders_rem": 0, "units_rem": 0})
            orders_diff = init_cap["orders_rem"] - final_cap["orders_rem"]
            units_diff = init_cap["units_rem"] - final_cap["units_rem"]
            if orders_diff > 0 or units_diff > 0:
                capacity_deductions[key] = {"orders": orders_diff, "units": units_diff}

        # 7. Aggregate Summary Metrics
        total_count = len(order_outcomes)
        allocated_count = sum(1 for o in order_outcomes if o.allocation_status == "ALLOCATED")
        unallocated_count = sum(1 for o in order_outcomes if o.allocation_status == "UNALLOCATED")
        single_count = sum(1 for o in order_outcomes if o.allocation_type == "SINGLE_NODE")
        split_count = sum(1 for o in order_outcomes if o.allocation_type == "SPLIT_NODE")
        completed_count = sum(1 for o in order_outcomes if o.delivery_completed == 1)
        on_time_count = sum(1 for o in order_outcomes if o.delivery_on_time == 1)
        late_count = sum(1 for o in order_outcomes if o.delivery_on_time == 0 and o.delivery_completed == 1)
        carrier_unavail_count = sum(1 for o in order_outcomes if o.delivery_outcome_status == "CARRIER_UNAVAILABLE")
        total_units = sum(o.total_units for o in order_outcomes)

        strict_on_time_all_pct = (on_time_count / total_count * 100.0) if total_count > 0 else 0.0
        strict_on_time_completed_pct = (on_time_count / completed_count * 100.0) if completed_count > 0 else 0.0
        split_rate_pct = (split_count / total_count * 100.0) if total_count > 0 else 0.0
        unallocated_rate_pct = (unallocated_count / total_count * 100.0) if total_count > 0 else 0.0
        completion_rate_pct = (completed_count / total_count * 100.0) if total_count > 0 else 0.0
        avg_cost = (total_synthetic_cost / total_count) if total_count > 0 else 0.0

        return SimulationRunResult(
            run_id=active_run_id,
            scenario_id=config.scenario_id,
            scenario_name=config.scenario_name,
            created_at=now_str,
            config_snapshot=asdict(config),
            total_orders=total_count,
            total_units=total_units,
            allocated_orders=allocated_count,
            unallocated_orders=unallocated_count,
            single_node_orders=single_count,
            split_orders=split_count,
            completed_orders=completed_count,
            on_time_orders=on_time_count,
            late_orders=late_count,
            carrier_unavailable_orders=carrier_unavail_count,
            strict_on_time_rate_all_pct=strict_on_time_all_pct,
            strict_on_time_rate_completed_pct=strict_on_time_completed_pct,
            split_order_rate_pct=split_rate_pct,
            unallocated_rate_pct=unallocated_rate_pct,
            completion_rate_pct=completion_rate_pct,
            total_estimated_synthetic_cost_inr=total_synthetic_cost,
            average_estimated_cost_per_order_inr=avg_cost,
            node_order_counts=node_order_counts,
            carrier_shipment_counts=carrier_shipment_counts,
            inventory_reservations=inventory_reservations,
            capacity_deductions=capacity_deductions,
            order_outcomes=order_outcomes
        )

    def persist_run(self, result: SimulationRunResult, overwrite: bool = True) -> None:
        """
        Persists simulation results atomically to simulation_* tables in SQLite.
        Guarantees zero mutation to historical operational tables.
        """
        report_json = json.dumps(result.to_report_dict(), default=str)
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Atomic replace: clean previous child and parent rows for this run_id
            if overwrite:
                cursor.execute("DELETE FROM simulation_orders WHERE scenario_id = ?", (result.run_id,))
                cursor.execute("DELETE FROM simulation_inventory_delta WHERE scenario_id = ?", (result.run_id,))
                cursor.execute("DELETE FROM simulation_capacity_delta WHERE scenario_id = ?", (result.run_id,))
                cursor.execute("DELETE FROM simulation_runs WHERE scenario_id = ?", (result.run_id,))
                
            # 1. Insert simulation_runs
            cursor.execute("""
                INSERT INTO simulation_runs (scenario_id, scenario_name, created_at, notes, simulated_orders_count)
                VALUES (?, ?, ?, ?, ?)
            """, (
                result.run_id,
                result.scenario_name,
                result.created_at,
                report_json,
                result.total_orders
            ))

            # 2. Insert simulation_orders
            orders_payload = [
                (
                    result.run_id,
                    o.order_id,
                    o.customer_id,
                    o.order_time,
                    o.destination_zone_id,
                    o.requested_service,
                    o.order_priority,
                    o.delivery_outcome_status,
                    o.order_total_inr
                )
                for o in result.order_outcomes
            ]
            cursor.executemany("""
                INSERT INTO simulation_orders (
                    scenario_id, order_id, customer_id, order_time, destination_zone_id,
                    requested_service, order_priority, order_status, order_total_inr
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, orders_payload)

            # 3. Insert simulation_inventory_delta
            inv_payload = [
                (result.run_id, node_id, sku_id, delta)
                for (node_id, sku_id), delta in result.inventory_reservations.items()
                if delta > 0
            ]
            cursor.executemany("""
                INSERT INTO simulation_inventory_delta (scenario_id, node_id, sku_id, reserved_delta)
                VALUES (?, ?, ?, ?)
            """, inv_payload)

            # 4. Insert simulation_capacity_delta
            cap_payload = [
                (result.run_id, node_id, cap_date, d["orders"], d["units"])
                for (node_id, cap_date), d in result.capacity_deductions.items()
                if d["orders"] > 0 or d["units"] > 0
            ]
            cursor.executemany("""
                INSERT INTO simulation_capacity_delta (scenario_id, node_id, capacity_date, orders_delta, units_delta)
                VALUES (?, ?, ?, ?, ?)
            """, cap_payload)

            conn.commit()

    def load_persisted_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        """
        Reconstructs the full scenario report and summary from SQLite after application restart.
        """
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT notes FROM simulation_runs WHERE scenario_id = ?", (run_id,))
            row = cursor.fetchone()
            if not row or not row["notes"]:
                return None
            return json.loads(row["notes"])

    def _load_orders(self, config: SimulationScenarioConfig) -> List[Tuple[OrderRequest, float]]:
        """Loads and sorts candidate orders strictly adhering to filters."""
        query = """
            SELECT o.order_id, o.customer_id, o.order_time, o.destination_zone_id,
                   o.requested_service, o.order_priority, o.order_total_inr
            FROM orders o
            WHERE 1=1
        """
        params = []

        if config.date_range:
            start_date, end_date = config.date_range
            query += " AND DATE(o.order_time) >= ? AND DATE(o.order_time) <= ?"
            params.extend([start_date, end_date])

        if config.order_priority_filter:
            placeholders = ",".join("?" for _ in config.order_priority_filter)
            query += f" AND o.order_priority IN ({placeholders})"
            params.extend(config.order_priority_filter)

        query += " ORDER BY o.order_time ASC"

        if config.order_limit:
            query += " LIMIT ?"
            params.append(config.order_limit)

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            order_rows = cursor.fetchall()

            if not order_rows:
                return []

            order_ids = [r["order_id"] for r in order_rows]

            # Fetch all order lines in safe batches to avoid SQLite variable limit (~999).
            CHUNK_SIZE = 500
            lines_by_order: Dict[str, List[OrderLineRequest]] = {}
            for i in range(0, len(order_ids), CHUNK_SIZE):
                chunk = order_ids[i : i + CHUNK_SIZE]
                placeholders = ",".join("?" for _ in chunk)
                cursor.execute(f"""
                    SELECT order_line_id, order_id, sku_id, quantity
                    FROM order_lines
                    WHERE order_id IN ({placeholders})
                    ORDER BY order_line_id ASC
                """, chunk)
                for lr in cursor.fetchall():
                    oid = lr["order_id"]
                    if oid not in lines_by_order:
                        lines_by_order[oid] = []
                    lines_by_order[oid].append(OrderLineRequest(
                        order_line_id=lr["order_line_id"],
                        sku_id=lr["sku_id"],
                        quantity=int(lr["quantity"])
                    ))


        result: List[Tuple[OrderRequest, float]] = []
        for r in order_rows:
            oid = r["order_id"]
            lines = lines_by_order.get(oid, [])
            req = OrderRequest(
                order_id=oid,
                customer_id=r["customer_id"],
                order_time=r["order_time"],
                destination_zone_id=r["destination_zone_id"],
                requested_service=r["requested_service"],
                order_priority=r["order_priority"],
                lines=lines
            )
            result.append((req, float(r["order_total_inr"])))

        return result
