r"""
Unit & Integration Tests for FulfillSmart Simulation & What-If Engine (Stage 4)
Validates:
1. Scenario configuration validation and conflict prevention.
2. Capacity multiplier floor rounding and 0.0 network shutdown edge case.
3. Warehouse outage and rerouting (SCEN-OUTAGE-CHENNAI).
4. Carrier cutoff extension same-day dispatch (SCEN-CUTOFF-BLUEDART).
5. Capacity expansion surge (SCEN-PEAK-SURGE).
6. Strict no-split allocation policy (SCEN-NO-SPLIT).
7. Inventory injection and shortage handling.
8. Independent isolated execution of two scenarios.
9. Deterministic repeated execution.
10. Historical database and CSV immutability.
11. Transactional rollback on failed persistence.
12. Scenario comparator mathematical correctness (percentage-point deltas).
13. Atomic persistence and report retrieval.
"""
from datetime import datetime, date
import hashlib
import math
from pathlib import Path
import sys
import pytest
import sqlite3

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.db import get_db, DB_PATH
from src.engine.allocation import (
    TransactionalAllocationState,
    FulfillmentAllocationEngine,
    OrderRequest,
    OrderLineRequest
)
from src.engine.carrier_selection import (
    CarrierSelectionEngine,
    CarrierPromiseRequest
)
from src.engine.scenario_comparator import ScenarioComparator
from src.engine.simulation import SimulationEngine, SimulationSandbox
from src.engine.simulation_config import SimulationScenarioConfig, SyntheticCostConfig
from src.engine.standard_scenarios import (
    get_southern_hub_outage_scenario,
    get_carrier_cutoff_extension_scenario,
    get_peak_surge_scenario,
    get_strict_single_node_scenario,
    get_standard_scenarios
)


@pytest.fixture(autouse=True)
def clean_simulation_tables():
    """Ensure simulation sandbox tables are restored to empty state after tests."""
    with get_db() as conn:
        c = conn.cursor()
        c.execute("DELETE FROM simulation_orders")
        c.execute("DELETE FROM simulation_inventory_delta")
        c.execute("DELETE FROM simulation_capacity_delta")
        c.execute("DELETE FROM simulation_runs")
        conn.commit()
    yield
    with get_db() as conn:
        c = conn.cursor()
        c.execute("DELETE FROM simulation_orders")
        c.execute("DELETE FROM simulation_inventory_delta")
        c.execute("DELETE FROM simulation_capacity_delta")
        c.execute("DELETE FROM simulation_runs")
        conn.commit()


# =====================================================================
# 1. Configuration Validation & Constraints
# =====================================================================
def test_simulation_config_validation_rules():
    """Verify strict validation of scenario configuration parameters."""
    # Valid configuration passes
    cfg = SimulationScenarioConfig(
        scenario_id="SCEN-TEST-VALID",
        scenario_name="Valid Test Scenario"
    )
    cfg.validate()

    # Negative capacity multiplier rejected
    with pytest.raises(ValueError, match="Capacity multiplier cannot be negative"):
        bad_cap = SimulationScenarioConfig(scenario_id="SCEN-BAD", scenario_name="Bad", capacity_multiplier=-0.5)
        bad_cap.validate()

    # Unknown disabled node rejected
    with pytest.raises(ValueError, match="Unknown disabled node_id"):
        bad_node = SimulationScenarioConfig(
            scenario_id="SCEN-BAD", scenario_name="Bad", disabled_node_ids=["FUL-UNKNOWN-99"]
        )
        bad_node.validate(valid_node_ids={"FUL-2026-000001", "FUL-2026-000002"})

    # Unknown carrier rejected
    with pytest.raises(ValueError, match="Unknown disabled carrier_id"):
        bad_carrier = SimulationScenarioConfig(
            scenario_id="SCEN-BAD", scenario_name="Bad", disabled_carrier_ids=["CAR-999"]
        )
        bad_carrier.validate(valid_carrier_ids={"CAR-001", "CAR-002"})

    # Invalid cutoff format rejected
    with pytest.raises(ValueError, match="is not a valid 24-hour time"):
        bad_cutoff = SimulationScenarioConfig(
            scenario_id="SCEN-BAD", scenario_name="Bad", carrier_cutoff_overrides={"CAR-001": "25:00"}
        )
        bad_cutoff.validate()

    # Inverted date range rejected
    with pytest.raises(ValueError, match="start_date '2026-06-30' is after end_date '2026-06-01'"):
        bad_dates = SimulationScenarioConfig(
            scenario_id="SCEN-BAD", scenario_name="Bad", date_range=("2026-06-30", "2026-06-01")
        )
        bad_dates.validate()

    # Conflicting node override (disabled and assigned capacity) rejected
    with pytest.raises(ValueError, match="Conflicting overrides"):
        conflict_node = SimulationScenarioConfig(
            scenario_id="SCEN-BAD", scenario_name="Bad",
            disabled_node_ids=["FUL-2026-000001"],
            node_capacity_overrides={"FUL-2026-000001": {"orders": 50, "units": 100}}
        )
        conflict_node.validate()

    # Conflicting carrier override (disabled and assigned cutoff) rejected
    with pytest.raises(ValueError, match="Conflicting overrides"):
        conflict_carrier = SimulationScenarioConfig(
            scenario_id="SCEN-BAD", scenario_name="Bad",
            disabled_carrier_ids=["CAR-001"],
            carrier_cutoff_overrides={"CAR-001": "16:00"}
        )
        conflict_carrier.validate()

    # Negative resulting inventory rejected
    with pytest.raises(ValueError, match="results in negative available stock"):
        bad_inv = SimulationScenarioConfig(
            scenario_id="SCEN-BAD", scenario_name="Bad",
            inventory_deltas={("FUL-2026-000001", "SKU-001"): -100}
        )
        bad_inv.validate(current_inventory={("FUL-2026-000001", "SKU-001"): 50})


# =====================================================================
# 2. Capacity Rounding & Outage Mechanics
# =====================================================================
def test_capacity_multiplier_floor_rounding_and_full_outage():
    """Verify conservative floor rounding and capacity_multiplier = 0.0 network shutdown."""
    cfg = SimulationScenarioConfig(
        scenario_id="SCEN-ROUNDING",
        scenario_name="Rounding Test",
        capacity_multiplier=1.15
    )
    # 50 * 1.15 = 57.5 -> 57 (conservative floor rounding)
    assert cfg.apply_capacity_multiplier(50) == 57
    # 125 * 1.15 = 143.75 -> 143
    assert cfg.apply_capacity_multiplier(125) == 143
    # 1 * 0.5 = 0.5 -> 0
    cfg_half = SimulationScenarioConfig(scenario_id="SCEN-HALF", scenario_name="Half", capacity_multiplier=0.5)
    assert cfg_half.apply_capacity_multiplier(1) == 0

    # capacity_multiplier = 0.0 (Full Network Outage Stress Test)
    shutdown_cfg = SimulationScenarioConfig(
        scenario_id="SCEN-SHUTDOWN",
        scenario_name="Network Shutdown",
        capacity_multiplier=0.0,
        order_limit=10,
        date_range=("2026-01-01", "2026-01-01")
    )
    engine = SimulationEngine()
    result = engine.run_scenario(shutdown_cfg)
    
    assert result.total_orders == 10
    assert result.allocated_orders == 0
    assert result.unallocated_orders == 10
    assert result.unallocated_rate_pct == 100.0
    # Zero inventory reservations or capacity deductions
    assert len(result.inventory_reservations) == 0
    assert len(result.capacity_deductions) == 0


# =====================================================================
# 3. Warehouse Outage & Rerouting
# =====================================================================
def test_southern_hub_outage_rerouting():
    """Verify SCEN-OUTAGE-CHENNAI disables FUL-2026-000005 with 0 allocations and volume reroutes."""
    outage_cfg = get_southern_hub_outage_scenario()
    outage_cfg.order_limit = 50
    outage_cfg.date_range = ("2026-01-01", "2026-01-01")

    engine = SimulationEngine()
    result = engine.run_scenario(outage_cfg)

    # Node FUL-2026-000005 (Chennai) must receive exactly 0 allocations
    assert result.node_order_counts.get("FUL-2026-000005", 0) == 0
    
    for outcome in result.order_outcomes:
        assert "FUL-2026-000005" not in outcome.participating_nodes
        for d in outcome.decisions:
            assert d["node_id"] != "FUL-2026-000005"


# =====================================================================
# 4. Carrier Cutoff Extension
# =====================================================================
def test_carrier_cutoff_extension_same_day_dispatch():
    """Verify SCEN-CUTOFF-BLUEDART (12:00 -> 16:00) enables same-day dispatch for 14:00 order."""
    # Test order placed at 14:00 on a weekday
    req = CarrierPromiseRequest(
        order_id="ORD-TEST-CUTOFF",
        node_id="FUL-2026-000001",
        delivery_zone_id="DZ-001",
        requested_service="STANDARD",
        allocation_date="2026-06-16",  # Tuesday
        order_time="2026-06-16T14:00:00+05:30",
        allocated_line_count=1,
        allocated_unit_count=1,
        preferred_carrier_id="CAR-001"
    )

    # 1. Standard Carrier Engine (Baseline cutoff 12:00)
    baseline_engine = CarrierSelectionEngine()
    baseline_res = baseline_engine.select_carrier_and_promise(req)
    # Order at 14:00 is after 12:00 cutoff -> dispatches next day (2026-06-17)
    assert baseline_res.carrier_id == "CAR-001"
    assert baseline_res.dispatch_date == "2026-06-17"

    # 2. Carrier Engine with Extended Cutoff (16:00)
    cutoff_cfg = get_carrier_cutoff_extension_scenario()
    sandbox = SimulationSandbox(cutoff_cfg)
    extended_engine = CarrierSelectionEngine(initial_data=sandbox.carrier_engine_data)
    extended_res = extended_engine.select_carrier_and_promise(req)
    # Order at 14:00 is before 16:00 cutoff -> dispatches same day (2026-06-16)
    assert extended_res.carrier_id == "CAR-001"
    assert extended_res.dispatch_date == "2026-06-16"


# =====================================================================
# 5. Peak Surge Capacity Expansion
# =====================================================================
def test_peak_surge_capacity_expansion():
    """Verify SCEN-PEAK-SURGE (+30%) expands warehouse capacities in the sandbox."""
    surge_cfg = get_peak_surge_scenario()
    sandbox = SimulationSandbox(surge_cfg)

    # Check that sandboxed capacity reflects the +30% multiplier over baseline remaining
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT node_id, capacity_date, max_orders, allocated_orders FROM warehouse_capacity WHERE max_orders > 0 LIMIT 1")
        row = c.fetchone()
        nid = row["node_id"]
        cdate = row["capacity_date"]
        base_rem = max(0, int(row["max_orders"]) - int(row["allocated_orders"]))

    expected_orders = int(math.floor(base_rem * 1.30))
    sandboxed_orders = sandbox.capacity[(nid, cdate)]["orders_rem"]
    assert sandboxed_orders == expected_orders


# =====================================================================
# 6. Strict No-Split Allocation Policy
# =====================================================================
def test_strict_no_split_allocation_policy():
    """Verify SCEN-NO-SPLIT disallows multi-node splits, failing cleanly without partial reservations."""
    no_split_cfg = get_strict_single_node_scenario()
    
    # Construct a state where node 1 has SKU A only and node 2 has SKU B only
    state = TransactionalAllocationState(
        simulation_mode=True,
        scenario_id="TEST-SPLIT",
        initial_inventory={
            ("FUL-2026-000001", "SKU-001"): 10,
            ("FUL-2026-000001", "SKU-002"): 0,
            ("FUL-2026-000002", "SKU-001"): 0,
            ("FUL-2026-000002", "SKU-002"): 10,
        },
        initial_capacity={
            ("FUL-2026-000001", "2026-06-16"): {"orders_rem": 10, "units_rem": 100},
            ("FUL-2026-000002", "2026-06-16"): {"orders_rem": 10, "units_rem": 100},
        },
        initial_node_meta={
            "FUL-2026-000001": {"node_name": "Node 1", "city": "City 1", "state": "State 1"},
            "FUL-2026-000002": {"node_name": "Node 2", "city": "City 2", "state": "State 2"},
        }
    )

    order = OrderRequest(
        order_id="ORD-MULTI-LINE",
        customer_id="CUST-001",
        order_time="2026-06-16T10:00:00+05:30",
        destination_zone_id="DZ-001",
        requested_service="STANDARD",
        order_priority="MEDIUM",
        lines=[
            OrderLineRequest(order_line_id="L-1", sku_id="SKU-001", quantity=2),
            OrderLineRequest(order_line_id="L-2", sku_id="SKU-002", quantity=2),
        ]
    )

    # 1. When splits allowed: succeeds with SPLIT_NODE
    engine_allow = FulfillmentAllocationEngine(state=state, allow_splits=True)
    res_allow = engine_allow.allocate_order(order)
    assert res_allow.status == "ALLOCATED"
    assert res_allow.allocation_type == "SPLIT_NODE"
    assert res_allow.allocated_node_count == 2

    # Reset state
    state._inventory[("FUL-2026-000001", "SKU-001")] = 10
    state._inventory[("FUL-2026-000002", "SKU-002")] = 10
    state.clear_staged()

    # 2. When splits disallowed: returns UNALLOCATED with SPLIT_ALLOCATION_DISABLED exception
    engine_no_split = FulfillmentAllocationEngine(state=state, allow_splits=False)
    res_no_split = engine_no_split.allocate_order(order)
    assert res_no_split.status == "UNALLOCATED"
    assert res_no_split.allocation_type == "NONE"
    assert res_no_split.allocated_node_count == 0
    assert any(e["exception_code"] == "SPLIT_ALLOCATION_DISABLED" for e in res_no_split.exceptions)
    
    # Verify zero partial reservations
    assert state.get_available_stock("FUL-2026-000001", "SKU-001") == 10
    assert state.get_available_stock("FUL-2026-000002", "SKU-002") == 10


# =====================================================================
# 7. Inventory Injection & Shortage
# =====================================================================
def test_inventory_injection_and_shortage():
    """Verify inventory deltas correctly inject stock or induce stockouts in the sandbox."""
    # Stock injection
    inject_cfg = SimulationScenarioConfig(
        scenario_id="SCEN-INJECT",
        scenario_name="Inventory Injection",
        inventory_deltas={("FUL-2026-000001", "SKU-TEST-INJECT"): 500}
    )
    sandbox = SimulationSandbox(inject_cfg)
    assert sandbox.inventory[("FUL-2026-000001", "SKU-TEST-INJECT")] == 500

    # Stock reduction to zero
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT node_id, sku_id, available_qty FROM inventory WHERE available_qty > 10 LIMIT 1")
        row = c.fetchone()
        nid, sid, qty = row["node_id"], row["sku_id"], int(row["available_qty"])

    reduce_cfg = SimulationScenarioConfig(
        scenario_id="SCEN-REDUCE",
        scenario_name="Inventory Shortage",
        inventory_deltas={(nid, sid): -qty}
    )
    sandbox_reduce = SimulationSandbox(reduce_cfg)
    assert sandbox_reduce.inventory[(nid, sid)] == 0


# =====================================================================
# 8. Independent Isolated Scenario Execution
# =====================================================================
def test_independent_execution_of_two_scenarios():
    """Verify running Scenario A and Scenario B sequentially leaves each run completely isolated."""
    engine = SimulationEngine()

    cfg_a = SimulationScenarioConfig(
        scenario_id="SCEN-ISO-A",
        scenario_name="Scenario A (Disable Node 1)",
        disabled_node_ids=["FUL-2026-000001"],
        order_limit=20,
        date_range=("2026-01-01", "2026-01-01")
    )
    cfg_b = SimulationScenarioConfig(
        scenario_id="SCEN-ISO-B",
        scenario_name="Scenario B (Disable Node 2)",
        disabled_node_ids=["FUL-2026-000002"],
        order_limit=20,
        date_range=("2026-01-01", "2026-01-01")
    )

    res_a = engine.run_scenario(cfg_a)
    res_b = engine.run_scenario(cfg_b)

    assert res_a.node_order_counts.get("FUL-2026-000001", 0) == 0
    assert res_b.node_order_counts.get("FUL-2026-000002", 0) == 0
    # Scenario B was allowed to use Node 1
    assert res_b.node_order_counts.get("FUL-2026-000001", 0) > 0


# =====================================================================
# 9. Deterministic Repeated Runs
# =====================================================================
def test_deterministic_repeated_runs():
    """Verify running the identical scenario twice produces bit-for-bit identical outputs."""
    cfg = SimulationScenarioConfig(
        scenario_id="SCEN-DETERMINISTIC",
        scenario_name="Deterministic Test",
        capacity_multiplier=1.10,
        order_limit=25,
        date_range=("2026-01-01", "2026-01-01")
    )
    engine = SimulationEngine()
    run1 = engine.run_scenario(cfg, run_id="RUN-DET-1")
    run2 = engine.run_scenario(cfg, run_id="RUN-DET-2")

    assert run1.total_orders == run2.total_orders
    assert run1.allocated_orders == run2.allocated_orders
    assert run1.on_time_orders == run2.on_time_orders
    assert run1.strict_on_time_rate_all_pct == run2.strict_on_time_rate_all_pct
    assert run1.total_estimated_synthetic_cost_inr == run2.total_estimated_synthetic_cost_inr
    assert run1.node_order_counts == run2.node_order_counts
    assert run1.carrier_shipment_counts == run2.carrier_shipment_counts


# =====================================================================
# 10. Historical Database & CSV Immutability
# =====================================================================
def test_historical_database_and_csv_immutability():
    """Verify historical tables and original CSVs remain 100% untouched after simulation runs."""
    ROOT_DIR = Path(__file__).resolve().parents[1]
    tables_to_check = [
        "orders", "order_lines", "inventory", "warehouse_capacity",
        "carriers", "service_levels", "delivery_promises", "shipments", "delivery_outcomes"
    ]
    
    with get_db() as conn:
        c = conn.cursor()
        counts_before = {t: c.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in tables_to_check}
        c.execute("SELECT relative_path, sha256_hash FROM ingestion_metadata")
        stored_hashes = {r["relative_path"]: r["sha256_hash"] for r in c.fetchall()}

    # Run and persist a simulation
    engine = SimulationEngine()
    cfg = SimulationScenarioConfig(
        scenario_id="SCEN-IMMUTABILITY",
        scenario_name="Immutability Check",
        order_limit=20,
        date_range=("2026-01-01", "2026-01-01")
    )
    res = engine.run_scenario(cfg)
    engine.persist_run(res)

    # Check counts and hashes after
    with get_db() as conn:
        c = conn.cursor()
        counts_after = {t: c.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in tables_to_check}

    assert counts_before == counts_after, f"Historical table row counts mutated: {counts_before} vs {counts_after}"

    # Verify SHA-256 for all 29 original CSVs
    assert len(stored_hashes) == 29
    for rel_path, expected_hash in stored_hashes.items():
        actual_hash = hashlib.sha256((ROOT_DIR / rel_path).read_bytes()).hexdigest()
        assert actual_hash == expected_hash, f"Drift detected in original file {rel_path}!"


# =====================================================================
# 11. Transactional Rollback on Failed Persistence
# =====================================================================
def test_failed_simulation_transactional_rollback():
    """Verify that an error during persistence triggers atomic rollback with zero orphan records."""
    engine = SimulationEngine()
    cfg = SimulationScenarioConfig(
        scenario_id="SCEN-FAIL-ROLLBACK",
        scenario_name="Rollback Test",
        order_limit=10,
        date_range=("2026-01-01", "2026-01-01")
    )
    res = engine.run_scenario(cfg, run_id="RUN-ROLLBACK-TEST")

    # Corrupt one outcome to cause a database constraint error during insert
    bad_res = res
    bad_res.order_outcomes[0].order_id = None  # NOT NULL constraint violation on simulation_orders.order_id

    with pytest.raises(sqlite3.IntegrityError):
        engine.persist_run(bad_res)

    # Verify atomic rollback left zero records in simulation tables for this run_id
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM simulation_runs WHERE scenario_id = 'RUN-ROLLBACK-TEST'")
        assert c.fetchone()[0] == 0
        c.execute("SELECT COUNT(*) FROM simulation_orders WHERE scenario_id = 'RUN-ROLLBACK-TEST'")
        assert c.fetchone()[0] == 0
        c.execute("SELECT COUNT(*) FROM simulation_inventory_delta WHERE scenario_id = 'RUN-ROLLBACK-TEST'")
        assert c.fetchone()[0] == 0


# =====================================================================
# 12. Scenario Comparator Mathematical Correctness
# =====================================================================
def test_scenario_comparator_mathematical_correctness():
    """Verify ScenarioComparator computes exact percentage-point differences and synthetic cost deltas."""
    engine = SimulationEngine()
    cfg = SimulationScenarioConfig(
        scenario_id="SCEN-COMPARE-MATH",
        scenario_name="Comparator Math Test",
        order_limit=30,
        date_range=("2026-01-01", "2026-01-01")
    )
    sim_res = engine.run_scenario(cfg)

    comparator = ScenarioComparator()
    report = comparator.compare(sim_res)

    assert report.order_cohort_size == 30
    assert report.baseline.total_orders == 30

    # Rate deltas in percentage points (pp)
    expected_on_time_pp = sim_res.strict_on_time_rate_all_pct - report.baseline.strict_on_time_rate_all_pct
    assert abs(report.delta_on_time_rate_all_pp - expected_on_time_pp) < 1e-4

    expected_split_pp = sim_res.split_order_rate_pct - report.baseline.split_order_rate_pct
    assert abs(report.delta_split_order_rate_pp - expected_split_pp) < 1e-4

    expected_unalloc_pp = sim_res.unallocated_rate_pct - report.baseline.unallocated_rate_pct
    assert abs(report.delta_unallocated_rate_pp - expected_unalloc_pp) < 1e-4

    # Financial delta
    expected_cost_delta = sim_res.total_estimated_synthetic_cost_inr - report.baseline.total_estimated_synthetic_cost_inr
    assert abs(report.delta_total_synthetic_cost_inr - expected_cost_delta) < 1e-2

    # Check synthetic cost notice is present
    assert "synthetic estimates" in report.cost_disclaimer.lower()


# =====================================================================
# 13. Persistence & Lossless Report Reconstruction
# =====================================================================
def test_simulation_persistence_and_reconstruction():
    """Verify persisting a simulation run and reconstructing the report from SQLite."""
    engine = SimulationEngine()
    cfg = SimulationScenarioConfig(
        scenario_id="SCEN-RECONSTRUCT",
        scenario_name="Reconstruct Test",
        order_limit=15,
        date_range=("2026-01-01", "2026-01-01")
    )
    run_id = "RUN-RECONSTRUCT-001"
    sim_res = engine.run_scenario(cfg, run_id=run_id)
    engine.persist_run(sim_res, overwrite=True)

    # 1. Verify rows written to database
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM simulation_runs WHERE scenario_id = ?", (run_id,))
        assert c.fetchone()[0] == 1
        c.execute("SELECT COUNT(*) FROM simulation_orders WHERE scenario_id = ?", (run_id,))
        assert c.fetchone()[0] == 15
        c.execute("SELECT COUNT(*) FROM simulation_inventory_delta WHERE scenario_id = ?", (run_id,))
        assert c.fetchone()[0] > 0
        c.execute("SELECT COUNT(*) FROM simulation_capacity_delta WHERE scenario_id = ?", (run_id,))
        assert c.fetchone()[0] > 0

    # 2. Reconstruct from JSON in simulation_runs.notes
    loaded = engine.load_persisted_run(run_id)
    assert loaded is not None
    assert loaded["run_id"] == run_id
    assert loaded["scenario_id"] == "SCEN-RECONSTRUCT"
    assert loaded["summary_kpis"]["total_orders"] == 15
    assert loaded["summary_kpis"]["strict_on_time_rate_all_pct"] == round(sim_res.strict_on_time_rate_all_pct, 4)


# =====================================================================
# 14. Unique Run IDs & No Overwrite Within Same Second
# =====================================================================
def test_unique_run_ids_within_same_second_do_not_overwrite():
    """Verify that multiple auto-generated runs within the same second produce distinct run IDs and both persist."""
    engine = SimulationEngine()
    cfg = SimulationScenarioConfig(
        scenario_id="SCEN-UNIQUE-TEST",
        scenario_name="Unique ID Test",
        order_limit=5,
        date_range=("2026-01-01", "2026-01-01")
    )
    
    # Run twice immediately without passing explicit run_id
    run1 = engine.run_scenario(cfg)
    run2 = engine.run_scenario(cfg)
    
    # Assert distinct IDs with UUID suffix
    assert run1.run_id != run2.run_id
    assert run1.run_id.startswith("SCEN-UNIQUE-TEST_")
    assert run2.run_id.startswith("SCEN-UNIQUE-TEST_")
    
    # Persist both runs without overwriting
    engine.persist_run(run1, overwrite=False)
    engine.persist_run(run2, overwrite=False)
    
    # Verify both records exist in simulation_runs
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT scenario_id FROM simulation_runs WHERE scenario_id IN (?, ?)", (run1.run_id, run2.run_id))
        persisted_ids = {r[0] for r in c.fetchall()}
        assert len(persisted_ids) == 2
        assert run1.run_id in persisted_ids
        assert run2.run_id in persisted_ids
