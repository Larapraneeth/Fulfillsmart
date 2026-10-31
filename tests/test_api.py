"""
Comprehensive Integration Test Suite for FulfillSmart FastAPI REST API (Stage 5)
Verifies:
1. Public liveness (/health) and readiness (/ready) probes.
2. Constant-time API key security (401 Unauthorized for missing/invalid keys).
3. Request ID sanitization & bounding, process timing, and security headers.
4. Genuine RFC 7807 Problem Details error formatting.
5. Request-scoped stateless fulfillment allocation (zero state leakage across requests).
6. Carrier selection, delivery promise calculation, and historical lookups.
7. Shipment tracking lifecycle validation, order rollup, and historical tracking lookups.
8. Anomaly detection and POST heavy-computation audits (976 ground-truth & 247,061 clean checks).
9. Operational metrics endpoints (all 20 KPIs, carrier scorecard, warehouse utilization, monthly trends).
10. What-if simulation endpoints: standard scenarios, run execution, 409 Conflict handling, and delta comparisons.
11. Data immutability: zero mutation to historical SQLite tables or the 29 original CSV files.
"""
from datetime import datetime
import hashlib
import os
from pathlib import Path
import sys
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Configure test environment variable before app import
os.environ["FULFILLSMART_API_KEY"] = "test-secret-key-2026"

from src.db import get_db
from src.api.main import create_app

app = create_app()
client = TestClient(app)

TEST_API_KEY = "test-secret-key-2026"
AUTH_HEADER = {"X-API-Key": TEST_API_KEY}


@pytest.fixture(autouse=True)
def clean_simulation_tables():
    """Ensure simulation sandbox tables are restored to empty baseline state after tests."""
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
# 1. Health, Readiness & System Diagnostics
# =====================================================================
def test_liveness_probe_health():
    """GET /health returns 200 without authentication."""
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["service"] == "FulfillSmart"
    assert "timestamp" in data


def test_readiness_probe_ready():
    """GET /ready returns 200 and confirms database connectivity."""
    resp = client.get("/ready")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ready"
    assert data["database"] == "connected"
    assert data["table_count"] >= 30


def test_system_info_protected():
    """GET /api/v1/system/info requires authentication and returns configuration."""
    # Unauthorized without header
    unauth_resp = client.get("/api/v1/system/info")
    assert unauth_resp.status_code == 401

    # Authorized
    resp = client.get("/api/v1/system/info", headers=AUTH_HEADER)
    assert resp.status_code == 200
    data = resp.json()
    assert data["app_name"] == "FulfillSmart"
    assert "allocation_policy" in data
    assert "carrier_policy" in data


# =====================================================================
# 2. Authentication, Request ID & RFC 7807 Error Handling
# =====================================================================
def test_authentication_rejects_missing_and_invalid_keys():
    """Verify constant-time authentication rejects missing and invalid X-API-Key."""
    # Missing key
    resp_missing = client.get("/api/v1/metrics/headline")
    assert resp_missing.status_code == 401
    assert resp_missing.headers["content-type"] == "application/problem+json"
    err = resp_missing.json()
    assert err["status"] == 401
    assert err["error_code"] == "UNAUTHORIZED"

    # Invalid key
    resp_bad = client.get("/api/v1/metrics/headline", headers={"X-API-Key": "wrong-key"})
    assert resp_bad.status_code == 401
    assert resp_bad.json()["error_code"] == "UNAUTHORIZED"


def test_request_id_sanitization_and_process_timing():
    """Verify request ID is echoed/sanitized and X-Process-Time-Ms is attached."""
    # Valid custom request ID
    custom_id = "req-custom-trace-12345"
    resp = client.get("/health", headers={"X-Request-ID": custom_id})
    assert resp.headers.get("X-Request-ID") == custom_id
    assert "X-Process-Time-Ms" in resp.headers

    # Malformed/oversized request ID gets replaced with a clean generated ID
    bad_id = "bad$id@" * 20  # > 64 chars and invalid chars
    resp_bad = client.get("/health", headers={"X-Request-ID": bad_id})
    assigned_id = resp_bad.headers.get("X-Request-ID")
    assert assigned_id != bad_id
    assert assigned_id.startswith("req-")


def test_validation_error_returns_rfc7807_422():
    """Verify Pydantic validation error returns RFC 7807 Problem Details with invalid_params."""
    bad_payload = {
        "order_id": "ORD-TEST-BAD",
        "customer_id": "CUST-001",
        "order_time": "2026-06-16T10:00:00+05:30",
        "destination_zone_id": "DZ-001",
        "requested_service": "STANDARD",
        "order_priority": "NORMAL",
        "lines": [
            {"order_line_id": "L1", "sku_id": "SKU-001", "quantity": 0}  # Invalid: quantity must be > 0
        ]
    }
    resp = client.post("/api/v1/allocation/order", json=bad_payload, headers=AUTH_HEADER)
    assert resp.status_code == 422
    assert resp.headers["content-type"] == "application/problem+json"
    data = resp.json()
    assert data["status"] == 422
    assert data["error_code"] == "VALIDATION_ERROR"
    assert len(data["invalid_params"]) > 0


# =====================================================================
# 3. Allocation Router & Stateless Isolation
# =====================================================================
def test_allocation_order_stateless_and_isolated():
    """Verify allocation order evaluation succeeds and never leaks reservations across requests."""
    payload = {
        "order_id": "ORD-API-TEST-001",
        "customer_id": "CUST-001",
        "order_time": "2026-06-16T10:00:00+05:30",
        "destination_zone_id": "DZ-001",
        "requested_service": "STANDARD",
        "order_priority": "HIGH",
        "allow_splits": True,
        "lines": [
            {"order_line_id": "L1", "sku_id": "SKU-000001", "quantity": 1}
        ]
    }
    
    # Request 1
    resp1 = client.post("/api/v1/allocation/order", json=payload, headers=AUTH_HEADER)
    assert resp1.status_code == 200
    data1 = resp1.json()["data"]
    assert data1["order_id"] == "ORD-API-TEST-001"
    assert data1["status"] == "ALLOCATED"
    assert len(data1["decisions"]) == 1

    # Request 2 (Identical order) - must see identical starting inventory (zero state leakage)
    resp2 = client.post("/api/v1/allocation/order", json=payload, headers=AUTH_HEADER)
    assert resp2.status_code == 200
    data2 = resp2.json()["data"]
    assert data2["status"] == "ALLOCATED"
    assert data2["decisions"][0]["node_id"] == data1["decisions"][0]["node_id"]


def test_allocation_concurrent_requests_state_isolation():
    """
    Verify genuine concurrent API requests cannot leak, share, or mutate allocation state.
    Spawns 10 simultaneous concurrent worker threads all requesting 10 units of SKU-000001
    (which has 14 units at FUL-2026-000001). If state were shared or leaked, subsequent requests
    would fail or split due to stock depletion. Under request-scoped isolation, all 10 succeed identically.
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed

    payload = {
        "order_id": "ORD-CONCURRENT-TEST",
        "customer_id": "CUST-CONC",
        "order_time": "2026-06-16T10:00:00+05:30",
        "destination_zone_id": "DZ-001",
        "requested_service": "STANDARD",
        "order_priority": "HIGH",
        "allow_splits": False,
        "lines": [
            {"order_line_id": "L1", "sku_id": "SKU-000001", "quantity": 10}
        ]
    }

    def send_order(req_idx: int):
        req_payload = dict(payload)
        req_payload["order_id"] = f"ORD-CONC-{req_idx:03d}"
        headers = dict(AUTH_HEADER)
        headers["X-Request-ID"] = f"req-conc-{req_idx:03d}"
        return client.post("/api/v1/allocation/order", json=req_payload, headers=headers)

    concurrency = 10
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(send_order, i) for i in range(concurrency)]
        responses = [f.result() for f in as_completed(futures)]

    assert len(responses) == concurrency
    for resp in responses:
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "success"
        outcome = body["data"]
        assert outcome["status"] == "ALLOCATED"
        assert outcome["total_units"] == 10
        assert len(outcome["decisions"]) == 1
        assert outcome["decisions"][0]["allocated_qty"] == 10
        assert outcome["decisions"][0]["node_id"] == "FUL-2026-000001"



def test_allocation_batch():
    """Verify batch order allocation succeeds."""
    payload = {
        "orders": [
            {
                "order_id": "ORD-BATCH-01",
                "customer_id": "CUST-001",
                "order_time": "2026-06-16T10:00:00+05:30",
                "destination_zone_id": "DZ-001",
                "requested_service": "STANDARD",
                "order_priority": "HIGH",
                "lines": [{"order_line_id": "L1", "sku_id": "SKU-000001", "quantity": 1}]
            },
            {
                "order_id": "ORD-BATCH-02",
                "customer_id": "CUST-002",
                "order_time": "2026-06-16T10:05:00+05:30",
                "destination_zone_id": "DZ-002",
                "requested_service": "STANDARD",
                "order_priority": "NORMAL",
                "lines": [{"order_line_id": "L2", "sku_id": "SKU-000002", "quantity": 1}]
            }
        ]
    }
    resp = client.post("/api/v1/allocation/batch", json=payload, headers=AUTH_HEADER)
    assert resp.status_code == 200
    outcomes = resp.json()["data"]
    assert len(outcomes) == 2
    assert outcomes[0]["status"] == "ALLOCATED"
    assert outcomes[1]["status"] == "ALLOCATED"


def test_allocation_history_lookup():
    """Verify historical allocation summary lookup for baseline order."""
    resp = client.get("/api/v1/allocation/history/ORD-2026-000001", headers=AUTH_HEADER)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["summary"]["order_id"] == "ORD-2026-000001"
    assert len(data["decisions"]) >= 1

    # Unknown order returns 404
    resp_404 = client.get("/api/v1/allocation/history/ORD-UNKNOWN-9999", headers=AUTH_HEADER)
    assert resp_404.status_code == 404


def test_allocation_overview():
    """Verify aggregate historical allocation overview, 11 split orders, and 20 node distribution."""
    resp = client.get("/api/v1/allocation/overview", headers=AUTH_HEADER)
    assert resp.status_code == 200
    data = resp.json()["data"]

    # Verify Summary KPIs
    summary = data["summary"]
    assert summary["total_orders"] == 50000
    assert summary["allocated_orders"] == 50000
    assert summary["allocation_success_rate_pct"] == 100.0
    assert summary["single_node_orders"] == 49989
    assert summary["split_node_orders"] == 11
    assert summary["total_units_allocated"] == 233565
    assert summary["single_node_units"] == 233457
    assert summary["split_node_units"] == 108
    assert summary["allocation_decisions_count"] == 93558
    assert summary["sunday_orders_shifted"] == 7011

    # Verify All 11 Split Orders
    split_orders = data["split_orders"]
    assert len(split_orders) == 11
    for so in split_orders:
        assert so["order_id"].startswith("ORD-2026-")
        assert so["allocated_node_count"] in (2, 3)
        assert len(so["participating_nodes"]) == so["allocated_node_count"]
        assert len(so["decisions"]) >= 2
        assert so["total_units"] > 0
        assert so["order_total_inr"] > 0

    # Verify All 20 Fulfillment Nodes
    nodes = data["node_distribution"]
    assert len(nodes) == 20
    total_units_sum = sum(n["allocated_units"] for n in nodes)
    assert total_units_sum == 233565
    # Verify sorted descending by allocated_units
    units = [n["allocated_units"] for n in nodes]
    assert units == sorted(units, reverse=True)



# =====================================================================
# 4. Carrier Selection & Delivery Promise Router
# =====================================================================
def test_carrier_selection_and_promise():
    """Verify carrier selection and promise calculation endpoints."""
    payload = {
        "order_id": "ORD-CARRIER-TEST",
        "node_id": "FUL-2026-000001",
        "delivery_zone_id": "DZ-001",
        "requested_service": "STANDARD",
        "allocation_date": "2026-06-16",
        "order_time": "2026-06-16T10:00:00+05:30",
        "allocated_line_count": 1,
        "allocated_unit_count": 2
    }
    resp = client.post("/api/v1/carrier/select", json=payload, headers=AUTH_HEADER)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["is_success"] is True
    assert data["carrier_id"] in ["CAR-001", "CAR-002", "CAR-003"]
    assert data["promised_delivery_date"] > data["dispatch_date"]


def test_calculate_promise_date_endpoint():
    """Verify POST /api/v1/carrier/calculate-promise computes delivery promise date."""
    payload = {
        "dispatch_date": "2026-06-16",  # Tuesday
        "nominal_days": 4,
        "dest_state": "Telangana"
    }
    resp = client.post("/api/v1/carrier/calculate-promise", json=payload, headers=AUTH_HEADER)
    assert resp.status_code == 200
    data = resp.json()["data"]
    # 2026-06-16 (Tue) + 4 days -> Wed 17, Thu 18, Fri 19, Sat 20 -> 2026-06-20
    assert data["promised_delivery_date"] == "2026-06-20"


def test_carrier_history_lookup():
    """Verify historical carrier selection lookup."""
    resp = client.get("/api/v1/carrier/history/ORD-2026-000001", headers=AUTH_HEADER)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data["carrier_selections"]) >= 1
    assert len(data["delivery_promises"]) >= 1


# =====================================================================
# 5. Tracking & Rollup Router
# =====================================================================
def test_tracking_validate_events_and_rollup():
    """Verify tracking lifecycle validation and order rollup endpoints."""
    # Validation
    val_payload = {
        "shipment_id": "SHP-TEST-01",
        "events": [
            {
                "tracking_event_id": "EV-01",
                "shipment_id": "SHP-TEST-01",
                "order_id": "ORD-01",
                "event_sequence": 1,
                "event_type": "PICKED_UP",
                "event_timestamp": "2026-06-16T11:00:00+05:30",
                "event_location": "Hyderabad",
                "event_description": "Parcel picked up"
            },
            {
                "tracking_event_id": "EV-02",
                "shipment_id": "SHP-TEST-01",
                "order_id": "ORD-01",
                "event_sequence": 2,
                "event_type": "DELIVERED",
                "event_timestamp": "2026-06-18T15:00:00+05:30",
                "event_location": "Hyderabad Hub",
                "event_description": "Parcel delivered"
            }
        ]
    }
    resp_val = client.post("/api/v1/tracking/validate-events", json=val_payload, headers=AUTH_HEADER)
    assert resp_val.status_code == 200
    val_data = resp_val.json()["data"]
    assert val_data["is_valid"] is True
    assert val_data["terminal_status"] == "DELIVERED"

    # Rollup
    rollup_payload = {
        "order_id": "ORD-01",
        "order_time": "2026-06-16T10:00:00+05:30",
        "requested_service": "STANDARD",
        "allocated_node_groups": 1,
        "shipments": [
            {
                "shipment_id": "SHP-TEST-01",
                "order_id": "ORD-01",
                "node_id": "FUL-2026-000001",
                "carrier_id": "CAR-001",
                "service_level_id": "SL-01",
                "delivery_promise_id": "DP-01",
                "dispatch_date": "2026-06-16",
                "promised_delivery_date": "2026-06-20",
                "actual_delivery_date": "2026-06-19",
                "shipment_status": "DELIVERED",
                "is_delayed": 0,
                "delay_days": 0
            }
        ]
    }
    resp_roll = client.post("/api/v1/tracking/rollup", json=rollup_payload, headers=AUTH_HEADER)
    assert resp_roll.status_code == 200
    roll_data = resp_roll.json()["data"]
    assert roll_data["delivery_outcome_status"] == "DELIVERED_ON_TIME"
    assert roll_data["delivery_on_time"] == 1


def test_tracking_history_lookup():
    """Verify historical tracking history lookup."""
    resp = client.get("/api/v1/tracking/history/ORD-2026-000001", headers=AUTH_HEADER)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["order_id"] == "ORD-2026-000001"
    assert data["delivery_outcome"]["delivery_outcome_status"] == "DELIVERED_ON_TIME"


# =====================================================================
# 6. Anomaly Detection & POST Heavy Audits
# =====================================================================
def test_anomaly_detection_endpoints():
    """Verify anomaly detection on scenario record."""
    # Stock violation record
    bad_record = {
        "order_id": "ORD-TEST-ANOMALY",
        "node_id": "FUL-2026-000001",
        "sku_id": "SKU-000001",
        "allocated_qty": 100,
        "available_qty": 20
    }
    resp = client.post("/api/v1/anomalies/detect", json={"scenario": bad_record}, headers=AUTH_HEADER)
    assert resp.status_code == 200
    violations = resp.json()["data"]
    assert len(violations) == 1
    assert violations[0]["anomaly_type"] == "ALLOCATION_EXCEEDS_AVAILABLE_STOCK"
    assert violations[0]["severity"] == "CRITICAL"


def test_anomaly_ground_truth_and_clean_audit_post():
    """Verify POST heavy computation endpoints execute and return expected metrics."""
    # 1. Ground truth evaluation (POST)
    resp_gt = client.post("/api/v1/anomalies/evaluate/ground-truth", headers=AUTH_HEADER)
    assert resp_gt.status_code == 200
    gt_data = resp_gt.json()["data"]
    assert gt_data["total_cases_evaluated"] == 976
    assert gt_data["overall_macro_precision"] == 1.0
    assert gt_data["overall_macro_recall"] == 1.0
    assert gt_data["overall_macro_f1"] == 1.0

    # 2. Clean operational data audit (POST)
    resp_clean = client.post("/api/v1/anomalies/evaluate/clean-audit", headers=AUTH_HEADER)
    assert resp_clean.status_code == 200
    clean_data = resp_clean.json()["data"]
    assert clean_data["records_evaluated"] == 247061
    assert clean_data["false_positives"] == 0


def test_anomalies_overview_endpoint():
    """Verify GET /api/v1/anomalies/overview metrics, distributions, and baseline disclosures."""
    resp = client.get("/api/v1/anomalies/overview", headers=AUTH_HEADER)
    assert resp.status_code == 200
    data = resp.json()["data"]

    # Invariants
    assert data["total_anomalies"] == 1718
    assert data["total_orders_evaluated"] == 50000
    assert data["total_shipments_evaluated"] == 49436
    assert data["clean_records_audit_evaluated"] == 247061
    assert data["clean_records_false_positives"] == 0
    assert data["synthetic_benchmark_cases"] == 976
    assert data["synthetic_benchmark_f1"] == 1.0

    # Categories breakdown
    cat_map = {c["category"]: c for c in data["categories"]}
    assert cat_map["CARRIER_UNAVAILABLE"]["count"] == 579
    assert cat_map["DELIVERY_DELAY"]["count"] == 1128
    assert cat_map["SPLIT_ORDER_COMPLEXITY"]["count"] == 11
    assert cat_map["ALLOCATION_EXCEPTION"]["count"] == 0
    assert cat_map["TRACKING_IRREGULARITY"]["count"] == 0

    # Severity breakdown (579 + 376 + 387 + 376 = 1718)
    sev_map = {s["severity"]: s for s in data["severities"]}
    assert sev_map["CRITICAL"]["count"] == 579
    assert sev_map["HIGH"]["count"] == 376
    assert sev_map["MEDIUM"]["count"] == 387
    assert sev_map["LOW"]["count"] == 376

    # Status breakdown (1138 + 580 = 1718)
    stat_map = {s["status"]: s for s in data["statuses"]}
    assert stat_map["DELIVERED_HISTORICAL"]["count"] == 1138
    assert stat_map["UNRESOLVED"]["count"] == 580

    # Monthly trends (10 months, total 1718)
    assert len(data["monthly_trends"]) == 10
    total_from_trends = sum(m["total_count"] for m in data["monthly_trends"])
    assert total_from_trends == 1718


def test_anomalies_paginated_and_filters():
    """Verify GET /api/v1/anomalies pagination, search, category, severity, and status filtering."""
    # 1. Default page 1, size 25
    resp = client.get("/api/v1/anomalies?page=1&page_size=25", headers=AUTH_HEADER)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total_count"] == 1718
    assert len(data["items"]) == 25
    assert data["page"] == 1
    assert data["total_pages"] == (1718 + 25 - 1) // 25
    assert data["has_next"] is True
    assert data["has_previous"] is False

    # 2. Filter by category: CARRIER_UNAVAILABLE
    resp_carrier = client.get("/api/v1/anomalies?category=CARRIER_UNAVAILABLE&page_size=10", headers=AUTH_HEADER)
    assert resp_carrier.status_code == 200
    carrier_data = resp_carrier.json()["data"]
    assert carrier_data["total_count"] == 579
    assert all(item["category"] == "CARRIER_UNAVAILABLE" for item in carrier_data["items"])

    # 3. Filter by category: DELIVERY_DELAY
    resp_delay = client.get("/api/v1/anomalies?category=DELIVERY_DELAY&page_size=10", headers=AUTH_HEADER)
    assert resp_delay.status_code == 200
    delay_data = resp_delay.json()["data"]
    assert delay_data["total_count"] == 1128
    assert all(item["category"] == "DELIVERY_DELAY" for item in delay_data["items"])

    # 4. Filter by category: SPLIT_ORDER_COMPLEXITY
    resp_split = client.get("/api/v1/anomalies?category=SPLIT_ORDER_COMPLEXITY", headers=AUTH_HEADER)
    assert resp_split.status_code == 200
    split_data = resp_split.json()["data"]
    assert split_data["total_count"] == 11
    assert all(item["category"] == "SPLIT_ORDER_COMPLEXITY" for item in split_data["items"])

    # 5. Filter by severity: CRITICAL
    resp_crit = client.get("/api/v1/anomalies?severity=CRITICAL", headers=AUTH_HEADER)
    assert resp_crit.status_code == 200
    assert resp_crit.json()["data"]["total_count"] == 579

    # 6. Search by order ID
    resp_search = client.get("/api/v1/anomalies?search=ORD-2026-000065", headers=AUTH_HEADER)
    assert resp_search.status_code == 200
    search_data = resp_search.json()["data"]
    assert search_data["total_count"] >= 1
    assert any(item["order_id"] == "ORD-2026-000065" for item in search_data["items"])


def test_anomalies_detail_and_edge_cases():
    """Verify GET /api/v1/anomalies/{anomaly_id} detail forensic evidence and 404 handling."""
    # 1. Carrier unavailable detail
    resp1 = client.get("/api/v1/anomalies/ANOM-CARRIER-ORD-2026-000065", headers=AUTH_HEADER)
    assert resp1.status_code == 200
    d1 = resp1.json()["data"]
    assert d1["category"] == "CARRIER_UNAVAILABLE"
    assert d1["severity"] == "CRITICAL"
    assert d1["status"] == "UNRESOLVED"
    assert d1["order_id"] == "ORD-2026-000065"
    assert "exception_code" in d1["evidence"]
    assert d1["evidence"]["exception_code"] == "NO_ELIGIBLE_CARRIER_OR_CUTOFF_MISSED"

    # 2. Delayed shipment detail with tracking events
    resp2 = client.get("/api/v1/anomalies/ANOM-DELAY-SHP-00000001", headers=AUTH_HEADER)
    assert resp2.status_code == 200
    d2 = resp2.json()["data"]
    assert d2["category"] == "DELIVERY_DELAY"
    assert d2["severity"] == "MEDIUM"  # 2 days delay
    assert d2["status"] == "DELIVERED_HISTORICAL"
    assert d2["shipment_id"] == "SHP-00000001"
    assert d2["evidence"]["delay_days"] == 2
    assert "tracking_events" in d2["related_entities"]
    events = d2["related_entities"]["tracking_events"]
    assert len(events) == 3
    assert [e["event_type"] for e in events] == ["PICKED_UP", "DELAYED", "DELIVERED"]

    # 3. Split-order complexity detail
    resp3 = client.get("/api/v1/anomalies/ANOM-SPLIT-ORD-2026-019142", headers=AUTH_HEADER)
    assert resp3.status_code == 200
    d3 = resp3.json()["data"]
    assert d3["category"] == "SPLIT_ORDER_COMPLEXITY"
    assert d3["evidence"]["allocated_node_count"] == 3
    assert len(d3["related_entities"]["shipments"]) == 3

    # 4. Benchmark synthetic case detail
    resp4 = client.get("/api/v1/anomalies/RGT-0001", headers=AUTH_HEADER)
    assert resp4.status_code == 200
    d4 = resp4.json()["data"]
    assert d4["category"] == "ALLOCATION_EXCEEDS_AVAILABLE_STOCK"
    assert d4["severity"] == "CRITICAL"
    assert d4["verification_type"] == "SYNTHETIC_BENCHMARK_CASE"

    # 5. Non-existent anomaly ID -> 404 Problem Details
    resp_404 = client.get("/api/v1/anomalies/ANOM-NON-EXISTENT-99999", headers=AUTH_HEADER)
    assert resp_404.status_code == 404
    assert resp_404.headers["content-type"] == "application/problem+json"
    err = resp_404.json()
    assert err["status"] == 404
    assert "not found" in err["detail"].lower()


# =====================================================================
# 7. Metrics & Analytics Router
# =====================================================================
def test_metrics_endpoints():
    """Verify KPI summary, carrier performance, warehouse utilization, and headline endpoints."""
    # KPI Summary (20 KPIs)
    resp_kpi = client.get("/api/v1/metrics/kpi-summary", headers=AUTH_HEADER)
    assert resp_kpi.status_code == 200
    kpis = resp_kpi.json()["data"]
    assert len(kpis) == 20

    # Headline Summary
    resp_head = client.get("/api/v1/metrics/headline", headers=AUTH_HEADER)
    assert resp_head.status_code == 200
    head = resp_head.json()["data"]
    assert head["total_orders"] == 50000
    assert head["allocated_orders"] == 50000
    assert head["order_on_time_rate_strict_all_orders_pct"] == 96.59


    # Carrier Scorecard
    resp_carrier = client.get("/api/v1/metrics/carrier-performance", headers=AUTH_HEADER)
    assert resp_carrier.status_code == 200
    assert len(resp_carrier.json()["data"]) == 10

    # Warehouse Utilization
    resp_util = client.get("/api/v1/metrics/warehouse-utilization", headers=AUTH_HEADER)
    assert resp_util.status_code == 200
    assert len(resp_util.json()["data"]) == 20

    # Monthly Trends
    resp_trends = client.get("/api/v1/metrics/monthly-trends", headers=AUTH_HEADER)
    assert resp_trends.status_code == 200
    assert len(resp_trends.json()["data"]) == 11


# =====================================================================
# 8. What-If Simulation & Conflict Handling
# =====================================================================
def test_simulation_endpoints_and_409_conflict():
    """Verify simulation standard scenarios, run execution, and 409 conflict handling."""
    # Standard Scenarios
    resp_std = client.get("/api/v1/simulation/scenarios/standard", headers=AUTH_HEADER)
    assert resp_std.status_code == 200
    assert len(resp_std.json()["data"]) == 4

    # Run Simulation
    run_payload = {
        "config": {
            "scenario_id": "SCEN-API-TEST",
            "scenario_name": "API Test Run",
            "capacity_multiplier": 1.10,
            "order_limit": 10,
            "date_range": ["2026-01-01", "2026-01-01"]
        },
        "persist": True,
        "overwrite": False,
        "run_id": "RUN-API-TEST-001"
    }
    resp_run = client.post("/api/v1/simulation/run", json=run_payload, headers=AUTH_HEADER)
    assert resp_run.status_code == 200
    run_data = resp_run.json()["data"]
    assert run_data["run_id"] == "RUN-API-TEST-001"

    # Attempting to re-run with same run_id and overwrite=false triggers 409 Conflict
    resp_conflict = client.post("/api/v1/simulation/run", json=run_payload, headers=AUTH_HEADER)
    assert resp_conflict.status_code == 409
    assert resp_conflict.headers["content-type"] == "application/problem+json"
    err = resp_conflict.json()
    assert err["status"] == 409
    assert err["error_code"] == "STATE_CONFLICT"

    # Retrieve Run Report
    resp_get = client.get("/api/v1/simulation/runs/RUN-API-TEST-001", headers=AUTH_HEADER)
    assert resp_get.status_code == 200
    assert resp_get.json()["data"]["run_id"] == "RUN-API-TEST-001"

    # List History
    resp_hist = client.get("/api/v1/simulation/history", headers=AUTH_HEADER)
    assert resp_hist.status_code == 200
    assert len(resp_hist.json()["data"]) >= 1


def test_simulation_compare_endpoint():
    """Verify POST /api/v1/simulation/compare calculates percentage-point deltas."""
    compare_payload = {
        "config": {
            "scenario_id": "SCEN-API-COMPARE",
            "scenario_name": "API Compare Test",
            "capacity_multiplier": 1.20,
            "order_limit": 15,
            "date_range": ["2026-01-01", "2026-01-01"]
        },
        "persist": False
    }
    resp = client.post("/api/v1/simulation/compare", json=compare_payload, headers=AUTH_HEADER)
    assert resp.status_code == 200
    comp_data = resp.json()["data"]
    assert "rate_deltas_pp" in comp_data
    assert "financial_deltas" in comp_data
    assert "synthetic estimates" in comp_data["cost_disclaimer"].lower()


# =====================================================================
# 9. Read-Only Query Extensions (Stage 6 Phase 1)
# =====================================================================
def test_orders_paginated_explorer_and_search():
    """Verify GET /api/v1/orders returns paginated orders with multi-field search and filters."""
    # 1. Base pagination (page 1, page_size 20)
    resp = client.get("/api/v1/orders?page=1&page_size=20", headers=AUTH_HEADER)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total_count"] == 50000
    assert data["total_pages"] == 2500
    assert data["page"] == 1
    assert data["page_size"] == 20
    assert data["has_next"] is True
    assert data["has_previous"] is False
    assert len(data["items"]) == 20

    # First item validation
    item = data["items"][0]
    assert item["order_id"].startswith("ORD-")
    assert item["line_count"] >= 1
    assert item["total_units"] >= 1
    assert "allocated_nodes" in item

    # 2. Search by order ID
    resp_search = client.get("/api/v1/orders?search=ORD-2026-000001", headers=AUTH_HEADER)
    assert resp_search.status_code == 200
    search_data = resp_search.json()["data"]
    assert search_data["total_count"] == 1
    found = search_data["items"][0]
    assert found["order_id"] == "ORD-2026-000001"
    assert found["destination_zone_id"] == "DZ-010"
    assert found["primary_carrier_id"] == "CAR-001"
    assert "FUL-2026-000004" in found["allocated_nodes"]

    # 3. Verify split-order uniqueness & carrier preservation (M-1 resolution)
    # ORD-2026-019142 has 3 shipments with 3 distinct carriers: CAR-007, CAR-009, CAR-010
    # Consignments: SHP-00023092 (CAR-010, 9 units), SHP-00023091 (CAR-009, 2 units), SHP-00023090 (CAR-007, 1 unit)
    # Dominant volume rule deterministically selects CAR-010 (Professional Couriers) as primary carrier.
    resp_split = client.get("/api/v1/orders?search=ORD-2026-019142", headers=AUTH_HEADER)
    assert resp_split.status_code == 200
    split_data = resp_split.json()["data"]
    assert split_data["total_count"] == 1
    assert len(split_data["items"]) == 1
    split_item = split_data["items"][0]
    assert split_item["order_id"] == "ORD-2026-019142"
    assert split_item["is_split"] is True
    assert len(split_item["allocated_nodes"]) == 3
    assert split_item["total_units"] == 12
    # Verify deterministic primary carrier selection
    assert split_item["primary_carrier_id"] == "CAR-010"
    assert split_item["carrier_name"] == "Professional Couriers"
    # Verify deterministic sorted aggregation
    assert split_item["carrier_ids"] == ["CAR-007", "CAR-009", "CAR-010"]
    assert split_item["carrier_names"] == ["Amazon Shipping", "Professional Couriers", "Shadowfax"]

    # Test all other historical split orders to verify exactly 1 result per order
    all_split_orders = [
        "ORD-2026-018321", "ORD-2026-040246", "ORD-2026-005610", "ORD-2026-047493",
        "ORD-2026-007544", "ORD-2026-015370", "ORD-2026-024848", "ORD-2026-003784",
        "ORD-2026-007669", "ORD-2026-024923"
    ]
    for split_id in all_split_orders:
        res_s = client.get(f"/api/v1/orders?search={split_id}", headers=AUTH_HEADER)
        assert res_s.status_code == 200
        d_s = res_s.json()["data"]
        assert d_s["total_count"] == 1
        assert len(d_s["items"]) == 1
        assert d_s["items"][0]["order_id"] == split_id
        assert d_s["items"][0]["is_split"] is True

    # Test carrier filter without 1-to-N join multiplication
    resp_car = client.get("/api/v1/orders?carrier_id=CAR-007&page_size=15", headers=AUTH_HEADER)
    assert resp_car.status_code == 200
    car_data = resp_car.json()["data"]
    assert car_data["total_count"] > 0
    for it in car_data["items"]:
        assert "CAR-007" in it["carrier_ids"]

    # Verify pagination produces disjoint, unique order IDs across consecutive pages
    page1 = client.get("/api/v1/orders?page=1&page_size=25", headers=AUTH_HEADER).json()["data"]["items"]
    page2 = client.get("/api/v1/orders?page=2&page_size=25", headers=AUTH_HEADER).json()["data"]["items"]
    p1_ids = {it["order_id"] for it in page1}
    p2_ids = {it["order_id"] for it in page2}
    assert len(p1_ids) == 25
    assert len(p2_ids) == 25
    assert p1_ids.isdisjoint(p2_ids)

    # 4. Filter by delivery zone and status
    resp_filter = client.get("/api/v1/orders?destination_zone_id=DZ-010&status=DELIVERED_ON_TIME&page_size=10", headers=AUTH_HEADER)
    assert resp_filter.status_code == 200
    filter_data = resp_filter.json()["data"]
    assert filter_data["total_count"] > 0
    for it in filter_data["items"]:
        assert it["destination_zone_id"] == "DZ-010"
        assert it["delivery_outcome_status"] == "DELIVERED_ON_TIME"


def test_split_order_deterministic_primary_carrier_stability():
    """
    Verify that repeated endpoint calls for multi-shipment split orders produce
    100% deterministic, stable results for primary_carrier_id, carrier_name,
    and sorted carrier_ids / carrier_names.
    """
    # 1. ORD-2026-019142 (3 shipments, carriers CAR-007, CAR-009, CAR-010; dominant CAR-010 with 9 units)
    baseline_payload = None
    for iteration in range(20):
        resp = client.get("/api/v1/orders?search=ORD-2026-019142", headers=AUTH_HEADER)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["total_count"] == 1
        item = data["items"][0]
        
        # Invariant checks
        assert item["primary_carrier_id"] == "CAR-010"
        assert item["carrier_name"] == "Professional Couriers"
        assert item["carrier_ids"] == ["CAR-007", "CAR-009", "CAR-010"]
        assert item["carrier_names"] == ["Amazon Shipping", "Professional Couriers", "Shadowfax"]
        
        if baseline_payload is None:
            baseline_payload = item
        else:
            assert item == baseline_payload, f"Drift detected at iteration {iteration}!"

    # 2. ORD-2026-005610 (2 shipments: CAR-010 with 3 units, CAR-004 with 7 units; dominant CAR-004)
    for iteration in range(10):
        resp2 = client.get("/api/v1/orders?search=ORD-2026-005610", headers=AUTH_HEADER)
        assert resp2.status_code == 200
        item2 = resp2.json()["data"]["items"][0]
        assert item2["primary_carrier_id"] == "CAR-004"
        assert item2["carrier_name"] == "Ecom Express"
        assert item2["carrier_ids"] == ["CAR-004", "CAR-010"]
        assert item2["carrier_names"] == ["Ecom Express", "Professional Couriers"]


def test_network_topology_endpoint():
    """Verify GET /api/v1/network/topology returns 20 nodes with DB coords, 50 zones, and corridors."""
    resp = client.get("/api/v1/network/topology", headers=AUTH_HEADER)
    assert resp.status_code == 200
    topo = resp.json()["data"]

    # 20 Fulfillment Nodes (exact DB coordinates)
    nodes = topo["nodes"]
    assert len(nodes) == 20
    for node in nodes:
        assert node["node_id"].startswith("FUL-")
        assert node["is_exact_coordinate"] is True
        assert node["coordinate_provenance"] == "DATABASE_FULFILLMENT_NODES"
        assert 8.0 <= node["latitude"] <= 35.0
        assert 68.0 <= node["longitude"] <= 95.0
        assert node["daily_order_capacity"] > 0
        assert node["total_period_order_capacity"] >= node["daily_order_capacity"]
        assert node["daily_unit_capacity"] > 0
        assert node["total_period_unit_capacity"] >= node["daily_unit_capacity"]


    # 50 Delivery Zones (documented city centroids)
    zones = topo["delivery_zones"]
    assert len(zones) == 50
    for zone in zones:
        assert zone["delivery_zone_id"].startswith("DZ-")
        assert zone["is_exact_coordinate"] is False
        assert zone["coordinate_provenance"] == "APPROXIMATE_URBAN_CITY_CENTROID"
        assert 8.0 <= zone["latitude"] <= 35.0
        assert 68.0 <= zone["longitude"] <= 95.0
        assert zone["total_orders_received"] > 0

    # Historical Route Corridors with Haversine Distance
    corridors = topo["historical_corridors"]
    assert len(corridors) >= 10
    first_corridor = corridors[0]
    assert first_corridor["haversine_distance_km"] > 0
    assert first_corridor["distance_type"] == "STRAIGHT_LINE_HAVERSINE_KM"
    assert "road distance" in first_corridor["distance_disclosure"].lower()


def test_carrier_service_zones_endpoint():
    """Verify GET /api/v1/carrier/service-zones returns master carrier-zone coverage matrix."""
    # Full matrix
    resp = client.get("/api/v1/carrier/service-zones", headers=AUTH_HEADER)
    assert resp.status_code == 200
    matrix = resp.json()["data"]
    assert matrix["total_matrix_entries"] == 335
    assert len(matrix["carriers"]) == 10
    assert len(matrix["coverage"]) == 335

    # Filtered by carrier
    resp_carrier = client.get("/api/v1/carrier/service-zones?carrier_id=CAR-001", headers=AUTH_HEADER)
    assert resp_carrier.status_code == 200
    carrier_data = resp_carrier.json()["data"]
    assert carrier_data["total_matrix_entries"] > 0
    for item in carrier_data["coverage"]:
        assert item["carrier_id"] == "CAR-001"
        assert item["carrier_name"] == "BlueDart"


# =====================================================================
# 10. Data Immutability Check
# =====================================================================
def test_api_execution_maintains_zero_drift():
    """Verify all 29 original CSV files and historical database tables remain untouched."""

    ROOT_DIR = Path(__file__).resolve().parents[1]
    
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT relative_path, sha256_hash FROM ingestion_metadata")
        stored_hashes = dict(c.fetchall())
        
        # Verify row counts
        assert c.execute("SELECT COUNT(*) FROM orders").fetchone()[0] == 50000
        assert c.execute("SELECT COUNT(*) FROM order_lines").fetchone()[0] == 93552
        assert c.execute("SELECT COUNT(*) FROM inventory").fetchone()[0] == 20000
        assert c.execute("SELECT COUNT(*) FROM shipments").fetchone()[0] == 49436

    assert len(stored_hashes) == 29
    for rel_path, expected_hash in stored_hashes.items():
        actual_hash = hashlib.sha256((ROOT_DIR / rel_path).read_bytes()).hexdigest()
        assert actual_hash == expected_hash, f"Drift detected in {rel_path}!"


def test_carrier_overview_endpoint():
    """Verify GET /api/v1/carrier/overview returns verified baseline metrics and all 10 carriers."""
    resp = client.get("/api/v1/carrier/overview", headers=AUTH_HEADER)
    assert resp.status_code == 200
    data = resp.json()["data"]

    # Verify Summary KPIs
    summary = data["summary"]
    assert summary["total_orders"] == 50000
    assert summary["total_shipments"] == 49436
    assert summary["delivered_on_time_shipments"] == 48308
    assert summary["delayed_shipments"] == 1128
    assert summary["shipment_on_time_rate_pct"] == 97.72
    assert summary["shipment_delay_rate_pct"] == 2.28
    assert summary["carrier_unavailable_orders"] == 579
    assert summary["carrier_unavailable_rate_pct"] == 1.158
    assert summary["total_carriers"] == 10
    assert summary["active_carriers"] == 10
    assert summary["total_service_levels"] == 30
    assert summary["total_service_zone_routes"] == 335
    assert summary["carrier_promise_coverage_rate_pct"] == 98.84
    assert summary["strict_on_time_order_rate_pct"] == 96.586

    # Verify All 10 Carriers
    carriers = data["carriers"]
    assert len(carriers) == 10
    carrier_ids = {c["carrier_id"] for c in carriers}
    assert carrier_ids == {f"CAR-{i:03d}" for i in range(1, 11)}
    
    # Check carrier fields
    for c in carriers:
        assert c["carrier_type"] == "THIRD_PARTY"
        assert c["is_active"] is True
        assert c["shipment_count"] > 0
        assert c["on_time_rate_pct"] > 90.0
        assert c["covered_zones_count"] > 0
        assert len(c["service_distribution"]) >= 1

    # Verify All 30 Service Levels
    sls = data["service_levels"]
    assert len(sls) == 30
    for sl in sls:
        assert sl["carrier_id"].startswith("CAR-")
        assert sl["service_code"] in ["STANDARD", "EXPRESS", "SAME_DAY"]
        assert sl["nominal_transit_days"] >= 0
        assert sl["max_weight_kg"] > 0

    # Verify Monthly Trends
    trends = data["monthly_trends"]
    assert len(trends) > 0
    # Every trend entry has valid month (2026-01 to 2026-10) and carrier
    for t in trends:
        assert t["month"].startswith("2026-")
        assert t["shipment_count"] > 0


def test_carrier_detail_endpoint():
    """Verify GET /api/v1/carrier/{carrier_id} returns detailed carrier profile, coverage, and shipments."""
    # Test valid carrier CAR-001 (BlueDart)
    resp = client.get("/api/v1/carrier/CAR-001", headers=AUTH_HEADER)
    assert resp.status_code == 200
    data = resp.json()["data"]

    carrier = data["carrier"]
    assert carrier["carrier_id"] == "CAR-001"
    assert carrier["carrier_name"] == "BlueDart"
    assert carrier["supports_reverse_logistics"] is True
    assert carrier["pickup_cutoff_time"] == "12:00"
    assert carrier["dispatch_window_start"] == "09:00"
    assert carrier["dispatch_window_end"] == "18:00"
    assert carrier["shipment_count"] == 5054
    assert carrier["delayed_shipments"] == 115
    assert carrier["covered_zones_count"] == 31

    # Service levels for BlueDart
    assert len(data["service_levels"]) == 3
    for sl in data["service_levels"]:
        assert sl["carrier_id"] == "CAR-001"

    # Covered zones
    assert len(data["covered_zones"]) == 31
    for z in data["covered_zones"]:
        assert z["delivery_zone_id"].startswith("DZ-")
        assert "city" in z
        assert "state" in z

    # Recent shipments (limit 50)
    recent = data["recent_shipments"]
    assert len(recent) == 50
    for s in recent:
        assert s["shipment_id"].startswith("SHP-")
        assert s["order_id"].startswith("ORD-")
        assert s["node_id"].startswith("FUL-")
        assert s["destination_city"] != ""

    # Test unknown carrier returns 404
    resp_404 = client.get("/api/v1/carrier/CAR-UNKNOWN", headers=AUTH_HEADER)
    assert resp_404.status_code == 404
    assert resp_404.headers["content-type"] == "application/problem+json"


def test_tracking_overview_endpoint():
    """Verify GET /api/v1/tracking/overview returns verified baseline tracking KPIs and distributions."""
    resp = client.get("/api/v1/tracking/overview", headers=AUTH_HEADER)
    assert resp.status_code == 200
    data = resp.json()["data"]

    # Verify Summary
    summary = data["summary"]
    assert summary["total_orders"] == 50000
    assert summary["assigned_orders"] == 49421
    assert summary["carrier_unavailable_orders"] == 579
    assert summary["carrier_unavailable_rate_pct"] == 1.158
    assert summary["total_shipments"] == 49436
    assert summary["delivered_shipments"] == 49436
    assert summary["in_transit_shipments"] == 0
    assert summary["on_time_shipments"] == 48308
    assert summary["delayed_shipments"] == 1128
    assert summary["shipment_on_time_rate_pct"] == 97.72
    assert summary["shipment_delay_rate_pct"] == 2.28
    assert summary["total_tracking_events"] == 100000
    assert summary["picked_up_events"] == 49436
    assert summary["delay_events"] == 1128
    assert summary["delivered_events"] == 49436

    # Verify Delay Distribution (Exactly 376 for 1, 2, and 3 days)
    delays = data["delay_distribution"]
    assert len(delays) == 3
    delay_map = {d["delay_days"]: d["count"] for d in delays}
    assert delay_map == {1: 376, 2: 376, 3: 376}

    # Verify Carrier Delivery Performance (All 10 carriers)
    carriers = data["carrier_performance"]
    assert len(carriers) == 10
    total_carrier_shipments = sum(c["shipment_count"] for c in carriers)
    assert total_carrier_shipments == 49436

    # Verify Node Delivery Performance (All 20 nodes)
    nodes = data["node_performance"]
    assert len(nodes) == 20
    total_node_shipments = sum(n["shipment_count"] for n in nodes)
    assert total_node_shipments == 49436


def test_shipments_explorer_paginated_and_filters():
    """Verify GET /api/v1/tracking/shipments returns paginated shipments with filters."""
    # 1. Base pagination
    resp = client.get("/api/v1/tracking/shipments?page=1&page_size=20", headers=AUTH_HEADER)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total_count"] == 49436
    assert data["total_pages"] == 2472
    assert data["page"] == 1
    assert len(data["items"]) == 20
    assert data["has_next"] is True
    assert data["has_previous"] is False

    # 2. Search by shipment ID
    resp_search = client.get("/api/v1/tracking/shipments?search=SHP-00000001", headers=AUTH_HEADER)
    assert resp_search.status_code == 200
    search_data = resp_search.json()["data"]
    assert search_data["total_count"] == 1
    found = search_data["items"][0]
    assert found["shipment_id"] == "SHP-00000001"
    assert found["order_id"] == "ORD-2026-000680"
    assert found["is_delayed"] == 1
    assert found["delay_days"] == 2
    assert found["events_count"] == 3

    # 3. Filter by delayed status
    resp_delayed = client.get("/api/v1/tracking/shipments?is_delayed=1&page_size=10", headers=AUTH_HEADER)
    assert resp_delayed.status_code == 200
    assert resp_delayed.json()["data"]["total_count"] == 1128

    resp_ontime = client.get("/api/v1/tracking/shipments?is_delayed=0&page_size=10", headers=AUTH_HEADER)
    assert resp_ontime.status_code == 200
    assert resp_ontime.json()["data"]["total_count"] == 48308

    # 4. Filter by carrier
    resp_car = client.get("/api/v1/tracking/shipments?carrier_id=CAR-001&page_size=15", headers=AUTH_HEADER)
    assert resp_car.status_code == 200
    assert resp_car.json()["data"]["total_count"] == 5054


def test_shipment_detail_endpoint():
    """Verify GET /api/v1/tracking/shipment/{shipment_id} returns events timeline, order context, and siblings."""
    # 1. Delayed shipment with 3 events
    resp = client.get("/api/v1/tracking/shipment/SHP-00000001", headers=AUTH_HEADER)
    assert resp.status_code == 200
    data = resp.json()["data"]

    shipment = data["shipment"]
    assert shipment["shipment_id"] == "SHP-00000001"
    assert shipment["order_id"] == "ORD-2026-000680"
    assert shipment["is_delayed"] == 1
    assert shipment["delay_days"] == 2

    # Tracking events
    events = data["tracking_events"]
    assert len(events) == 3
    assert [e["event_type"] for e in events] == ["PICKED_UP", "DELAYED", "DELIVERED"]
    assert events[0]["event_sequence"] == 1
    assert events[1]["event_sequence"] == 2
    assert events[2]["event_sequence"] == 3

    # Parent order
    assert data["parent_order"] is not None
    assert data["parent_order"]["order_id"] == "ORD-2026-000680"

    # 2. Split order multi-shipment context
    # ORD-2026-019142 has 3 shipments: SHP-00023090, SHP-00023091, SHP-00023092
    resp_split = client.get("/api/v1/tracking/shipment/SHP-00023090", headers=AUTH_HEADER)
    assert resp_split.status_code == 200
    split_data = resp_split.json()["data"]
    assert split_data["shipment"]["is_split"] is True
    assert len(split_data["sibling_shipments"]) == 2
    sibling_ids = {s["shipment_id"] for s in split_data["sibling_shipments"]}
    assert sibling_ids == {"SHP-00023091", "SHP-00023092"}

    # 3. Unknown shipment returns 404
    resp_404 = client.get("/api/v1/tracking/shipment/SHP-UNKNOWN", headers=AUTH_HEADER)
    assert resp_404.status_code == 404
    assert resp_404.headers["content-type"] == "application/problem+json"


