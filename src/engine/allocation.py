r"""
FulfillSmart Fulfillment Node Allocation Engine
Selects the optimal warehouse node(s) for customer orders based on:
1. Available inventory (available_qty = on_hand - reserved).
2. Daily warehouse order and unit capacity.
3. Nearest feasible warehouse using approximate straight-line Haversine distance.
4. Transactional split-shipment fallback when no single node can fulfill the order.
5. Chronological primary ordering with deterministic priority tie-breaking.
6. Sunday operating shift to Monday (warehouse Sunday capacity is zero).
7. Strict simulation state isolation (zero mutation of historical records).
"""
from dataclasses import dataclass, field
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional, Tuple, Set, Any
import sqlite3

from src.config import settings
from src.db import get_db
from src.engine.distance import distance_service


@dataclass
class OrderLineRequest:
    order_line_id: str
    sku_id: str
    quantity: int


@dataclass
class OrderRequest:
    order_id: str
    customer_id: str
    order_time: str
    destination_zone_id: str
    requested_service: str
    order_priority: str
    lines: List[OrderLineRequest] = field(default_factory=list)

    @property
    def total_units(self) -> int:
        return sum(line.quantity for line in self.lines)

    @property
    def parsed_datetime(self) -> datetime:
        # Handles ISO format with offset e.g. 2026-06-16T01:54:27+05:30
        return datetime.fromisoformat(self.order_time)


@dataclass
class AllocationDecisionRecord:
    allocation_id: str
    order_id: str
    order_line_id: str
    node_id: str
    sku_id: str
    allocated_qty: int
    allocation_date: str
    allocation_type: str  # SINGLE_NODE or SPLIT_NODE


@dataclass
class AllocationOutcome:
    order_id: str
    status: str  # ALLOCATED or UNALLOCATED
    allocation_type: str  # SINGLE_NODE, SPLIT_NODE, or NONE
    allocated_node_count: int
    total_units: int
    decisions: List[AllocationDecisionRecord]
    explanation: str
    exceptions: List[Dict[str, str]] = field(default_factory=list)


class TransactionalAllocationState:
    """
    Maintains inventory and warehouse capacity state with full support for:
    - Transactional staging (stage -> commit or discard to prevent partial reservations)
    - Isolated simulation state without modifying historical database records.
    """
    def __init__(
        self,
        simulation_mode: bool = False,
        scenario_id: Optional[str] = None,
        initial_inventory: Optional[Dict[Tuple[str, str], int]] = None,
        initial_capacity: Optional[Dict[Tuple[str, str], Dict[str, int]]] = None,
        initial_node_meta: Optional[Dict[str, Dict[str, str]]] = None
    ):
        self.simulation_mode = simulation_mode
        self.scenario_id = scenario_id or "default_simulation"
        
        # In-memory working state
        # (node_id, sku_id) -> available_qty
        self._inventory: Dict[Tuple[str, str], int] = {}
        # (node_id, date_str) -> {"orders_rem": int, "units_rem": int}
        self._capacity: Dict[Tuple[str, str], Dict[str, int]] = {}
        # Metadata: node names and cities
        self._node_meta: Dict[str, Dict[str, str]] = {}
        
        # Transaction staging buffer
        self._staged_inventory_deltas: Dict[Tuple[str, str], int] = {}
        self._staged_capacity_deltas: Dict[Tuple[str, str], Dict[str, int]] = {}
        
        if initial_inventory is not None:
            self._inventory = dict(initial_inventory)
            self._capacity = {k: dict(v) for k, v in (initial_capacity or {}).items()}
            self._node_meta = {k: dict(v) for k, v in (initial_node_meta or {}).items()}
        else:
            self._load_baseline_state()

    def _load_baseline_state(self) -> None:
        """Load active inventory and warehouse capacity from SQLite database."""
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Nodes metadata
            cursor.execute("SELECT node_id, node_name, city, state FROM fulfillment_nodes WHERE is_active = 1")
            for r in cursor.fetchall():
                self._node_meta[r["node_id"]] = {
                    "node_name": r["node_name"],
                    "city": r["city"],
                    "state": r["state"]
                }
                
            # Inventory: available_qty = on_hand_qty - reserved_qty
            cursor.execute("SELECT node_id, sku_id, available_qty FROM inventory")
            for r in cursor.fetchall():
                self._inventory[(r["node_id"], r["sku_id"])] = int(r["available_qty"])
                
            # Warehouse capacity: remaining orders & units
            cursor.execute("""
                SELECT node_id, capacity_date, max_orders, max_units, allocated_orders, allocated_units
                FROM warehouse_capacity
            """)
            for r in cursor.fetchall():
                key = (r["node_id"], r["capacity_date"])
                max_orders = int(r["max_orders"])
                max_units = int(r["max_units"])
                alloc_orders = int(r["allocated_orders"])
                alloc_units = int(r["allocated_units"])
                self._capacity[key] = {
                    "orders_rem": max(0, max_orders - alloc_orders),
                    "units_rem": max(0, max_units - alloc_units)
                }

    def get_node_name(self, node_id: str) -> str:
        return self._node_meta.get(node_id, {}).get("node_name", node_id)

    def get_available_stock(self, node_id: str, sku_id: str) -> int:
        base_stock = self._inventory.get((node_id, sku_id), 0)
        staged_deduction = self._staged_inventory_deltas.get((node_id, sku_id), 0)
        return max(0, base_stock - staged_deduction)

    def get_remaining_capacity(self, node_id: str, alloc_date: str) -> Tuple[int, int]:
        key = (node_id, alloc_date)
        base = self._capacity.get(key, {"orders_rem": 0, "units_rem": 0})
        staged = self._staged_capacity_deltas.get(key, {"orders": 0, "units": 0})
        return (
            max(0, base["orders_rem"] - staged["orders"]),
            max(0, base["units_rem"] - staged["units"])
        )

    def stage_inventory_deduction(self, node_id: str, sku_id: str, qty: int) -> None:
        key = (node_id, sku_id)
        self._staged_inventory_deltas[key] = self._staged_inventory_deltas.get(key, 0) + qty

    def stage_capacity_deduction(self, node_id: str, alloc_date: str, orders: int, units: int) -> None:
        key = (node_id, alloc_date)
        if key not in self._staged_capacity_deltas:
            self._staged_capacity_deltas[key] = {"orders": 0, "units": 0}
        self._staged_capacity_deltas[key]["orders"] += orders
        self._staged_capacity_deltas[key]["units"] += units

    def commit_transaction(self) -> None:
        """Atomically commit staged inventory and capacity changes into active state."""
        for (node_id, sku_id), delta in self._staged_inventory_deltas.items():
            self._inventory[(node_id, sku_id)] = self._inventory.get((node_id, sku_id), 0) - delta
            
        for (node_id, alloc_date), delta in self._staged_capacity_deltas.items():
            cap = self._capacity.get((node_id, alloc_date))
            if cap:
                cap["orders_rem"] = max(0, cap["orders_rem"] - delta["orders"])
                cap["units_rem"] = max(0, cap["units_rem"] - delta["units"])
                
        self.clear_staged()

    def discard_transaction(self) -> None:
        """Rollback all staged deductions, leaving zero partial reservations."""
        self.clear_staged()

    def clear_staged(self) -> None:
        self._staged_inventory_deltas.clear()
        self._staged_capacity_deltas.clear()


class FulfillmentAllocationEngine:
    """
    Core Deterministic Fulfillment Node Selection Engine.
    Evaluates order lines against inventory, warehouse capacity, and proximity.
    """
    def __init__(self, state: Optional[TransactionalAllocationState] = None, allow_splits: bool = True):
        self.state = state or TransactionalAllocationState()
        self.allow_splits = allow_splits
        self._alloc_id_counter = 1

    def determine_processing_date(self, order_time: datetime) -> str:
        """
        Determine warehouse allocation and processing date.
        If order is placed on a Sunday (weekday == 6), processing date shifts to Monday
        because warehouse operating capacity is 0 on Sundays.
        """
        order_date = order_time.date()
        if order_time.weekday() == 6:  # Sunday
            order_date = order_date + timedelta(days=1)  # Shift to Monday
        return order_date.isoformat()

    def allocate_order(self, order: OrderRequest, allow_splits: Optional[bool] = None) -> AllocationOutcome:
        """
        Allocate a single order using greedy single-node preference and transactional split fallback.
        Guarantees that failed allocations leave zero partial inventory or capacity reservations.
        """
        effective_allow_splits = self.allow_splits if allow_splits is None else allow_splits
        self.state.clear_staged()
        dt = order.parsed_datetime
        alloc_date = self.determine_processing_date(dt)
        was_shifted = (dt.weekday() == 6)
        
        ranked_nodes = distance_service.get_ranked_nodes(order.destination_zone_id)
        if not ranked_nodes:
            return AllocationOutcome(
                order_id=order.order_id,
                status="UNALLOCATED",
                allocation_type="NONE",
                allocated_node_count=0,
                total_units=order.total_units,
                decisions=[],
                explanation="No candidate fulfillment nodes mapped to destination zone.",
                exceptions=[{"exception_code": "NO_CANDIDATE_NODES", "exception_detail": f"Zone {order.destination_zone_id} has no candidate nodes."}]
            )

        # -------------------------------------------------------------
        # STEP 1: GREEDY SINGLE-NODE ALLOCATION PASS
        # -------------------------------------------------------------
        rejection_reasons = []
        for node_id, approx_dist_km in ranked_nodes:
            rem_orders, rem_units = self.state.get_remaining_capacity(node_id, alloc_date)
            
            # Check warehouse order and unit capacity
            if rem_orders < 1:
                rejection_reasons.append(f"{node_id}: Order capacity exhausted ({rem_orders} remaining)")
                continue
            if rem_units < order.total_units:
                rejection_reasons.append(f"{node_id}: Unit capacity insufficient ({rem_units} < {order.total_units})")
                continue
                
            # Check inventory availability across all order lines
            has_all_stock = True
            missing_skus = []
            for line in order.lines:
                avail = self.state.get_available_stock(node_id, line.sku_id)
                if avail < line.quantity:
                    has_all_stock = False
                    missing_skus.append(f"{line.sku_id} (avail: {avail}, need: {line.quantity})")
                    break
                    
            if not has_all_stock:
                rejection_reasons.append(f"{node_id}: Insufficient stock for {', '.join(missing_skus)}")
                continue

            # Feasible Single Node Found! Stage changes transactionally.
            for line in order.lines:
                self.state.stage_inventory_deduction(node_id, line.sku_id, line.quantity)
            self.state.stage_capacity_deduction(node_id, alloc_date, orders=1, units=order.total_units)
            
            # Commit staged transaction
            self.state.commit_transaction()
            
            node_name = self.state.get_node_name(node_id)
            decisions = []
            for line in order.lines:
                alloc_id = f"ALC-{self._alloc_id_counter:09d}"
                self._alloc_id_counter += 1
                decisions.append(AllocationDecisionRecord(
                    allocation_id=alloc_id,
                    order_id=order.order_id,
                    order_line_id=line.order_line_id,
                    node_id=node_id,
                    sku_id=line.sku_id,
                    allocated_qty=line.quantity,
                    allocation_date=alloc_date,
                    allocation_type="SINGLE_NODE"
                ))

            shift_note = " (Shifted from Sunday to Monday processing)" if was_shifted else ""
            explanation = (
                f"Allocated to nearest feasible node {node_name} ({node_id}) at straight-line distance "
                f"{approx_dist_km:.1f} km with complete stock and capacity on {alloc_date}{shift_note}."
            )
            
            return AllocationOutcome(
                order_id=order.order_id,
                status="ALLOCATED",
                allocation_type="SINGLE_NODE",
                allocated_node_count=1,
                total_units=order.total_units,
                decisions=decisions,
                explanation=explanation
            )

        # Check if split allocations are permitted
        if not effective_allow_splits:
            self.state.clear_staged()
            return AllocationOutcome(
                order_id=order.order_id,
                status="UNALLOCATED",
                allocation_type="NONE",
                allocated_node_count=0,
                total_units=order.total_units,
                decisions=[],
                explanation="No single fulfillment node has sufficient inventory and capacity, and split allocations are disabled by policy.",
                exceptions=[{"exception_code": "SPLIT_ALLOCATION_DISABLED", "exception_detail": "Order requires multi-node split, but allow_splits is False."}]
            )

        # -------------------------------------------------------------
        # STEP 2: TRANSACTIONAL MULTI-NODE SPLIT FALLBACK
        # -------------------------------------------------------------
        self.state.clear_staged()
        staged_decisions = []
        assigned_units_per_node: Dict[str, int] = {}
        participating_nodes: Set[str] = set()

        for line in order.lines:
            unassigned_qty = line.quantity
            
            # Prioritize nodes already participating in this order to minimize parcel count
            candidate_node_order = list(participating_nodes) + [n for n, _ in ranked_nodes if n not in participating_nodes]
            
            for candidate_node in candidate_node_order:
                if unassigned_qty <= 0:
                    break
                    
                avail = self.state.get_available_stock(candidate_node, line.sku_id)
                if avail <= 0:
                    continue
                    
                qty_to_assign = min(unassigned_qty, avail)
                
                # Check remaining capacity at this candidate node
                rem_orders, rem_units = self.state.get_remaining_capacity(candidate_node, alloc_date)
                needed_order_cap = 0 if candidate_node in participating_nodes else 1
                
                if rem_orders < needed_order_cap or rem_units < qty_to_assign:
                    continue
                    
                # Stage line slice at this node
                self.state.stage_inventory_deduction(candidate_node, line.sku_id, qty_to_assign)
                self.state.stage_capacity_deduction(candidate_node, alloc_date, orders=needed_order_cap, units=qty_to_assign)
                
                participating_nodes.add(candidate_node)
                assigned_units_per_node[candidate_node] = assigned_units_per_node.get(candidate_node, 0) + qty_to_assign
                unassigned_qty -= qty_to_assign
                
                alloc_id = f"ALC-{self._alloc_id_counter:09d}"
                self._alloc_id_counter += 1
                staged_decisions.append(AllocationDecisionRecord(
                    allocation_id=alloc_id,
                    order_id=order.order_id,
                    order_line_id=line.order_line_id,
                    node_id=candidate_node,
                    sku_id=line.sku_id,
                    allocated_qty=qty_to_assign,
                    allocation_date=alloc_date,
                    allocation_type="SPLIT_NODE"
                ))

            if unassigned_qty > 0:
                # Line item could not be fully satisfied across the network: ROLLBACK!
                self.state.discard_transaction()
                return AllocationOutcome(
                    order_id=order.order_id,
                    status="UNALLOCATED",
                    allocation_type="NONE",
                    allocated_node_count=0,
                    total_units=order.total_units,
                    decisions=[],
                    explanation=f"Network stock exhausted for SKU {line.sku_id} ({unassigned_qty} unallocated units). Allocation discarded.",
                    exceptions=[{"exception_code": "OUT_OF_STOCK", "exception_detail": f"SKU {line.sku_id} has insufficient stock across all feasible nodes."}]
                )

        # Order lines fully covered across participating nodes: COMMIT!
        self.state.commit_transaction()
        
        node_names = [f"{self.state.get_node_name(n)} ({n})" for n in sorted(participating_nodes)]
        shift_note = " (Shifted from Sunday to Monday processing)" if was_shifted else ""
        explanation = (
            f"Order split across {len(participating_nodes)} nodes: {', '.join(node_names)} because no single "
            f"warehouse had sufficient stock/capacity. Allocation date: {alloc_date}{shift_note}."
        )

        return AllocationOutcome(
            order_id=order.order_id,
            status="ALLOCATED",
            allocation_type="SPLIT_NODE",
            allocated_node_count=len(participating_nodes),
            total_units=order.total_units,
            decisions=staged_decisions,
            explanation=explanation
        )

    def allocate_batch(self, orders: List[OrderRequest], allow_splits: Optional[bool] = None) -> List[AllocationOutcome]:
        """
        Allocate a batch of orders in strict chronological order (order_time ascending).
        If order_time matches, order_priority acts as a deterministic tie-breaker.
        """
        priority_ranks = settings.priority_ranks
        
        # Sort key: primary order_time ascending, secondary priority rank ascending (1 = CRITICAL is first)
        def sort_key(o: OrderRequest):
            rank = priority_ranks.get(o.order_priority.upper(), 99)
            return (o.order_time, rank)
            
        sorted_orders = sorted(orders, key=sort_key)
        
        results = []
        for order in sorted_orders:
            outcome = self.allocate_order(order, allow_splits=allow_splits)
            results.append(outcome)
            
        return results
