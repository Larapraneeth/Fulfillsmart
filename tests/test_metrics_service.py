r"""
Focused Test Suite: Metrics Service
Verifies:
1. Exact alignment with Step 7 KPI definitions and historical kpi_summary.csv.
2. Carrier performance aggregation at shipment grain.
3. Warehouse capacity utilization calculations across active node-days.
4. Monthly delivery outcome trends.
5. Machine-readable headline summary structure.
"""
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.metrics.service import MetricsService


@pytest.fixture
def metrics_svc():
    return MetricsService()


def test_kpi_summary_values_and_count(metrics_svc):
    """Verify all operational KPIs are computed, matching Step 7 historical definitions and strict operational definitions."""
    kpi_list = metrics_svc.get_kpi_summary()
    assert len(kpi_list) == 20
    
    kpis = {k["metric"]: k["value"] for k in kpi_list}
    definitions = {k["metric"]: k["definition"] for k in kpi_list}
    
    assert kpis["total_orders"] == 50000
    assert kpis["allocated_orders"] == 50000
    assert kpis["unallocated_orders"] == 0
    assert kpis["allocation_success_rate"] == 100.0
    assert kpis["shipment_count"] == 49436
    assert kpis["split_node_orders"] == 11
    assert kpis["single_node_orders"] == 49989
    assert kpis["carrier_unavailable_orders"] == 579
    assert kpis["order_delivery_completion_rate"] == 98.842
    assert kpis["warehouse_order_capacity_utilization"] == 2.0705

    # 1. Historical compatibility KPIs (matches kpi_summary.csv verbatim)
    assert kpis["order_on_time_rate_all_orders"] == 97.744
    assert kpis["order_on_time_rate_completed"] == 98.8891
    assert "legacy Pandas astype(bool)" in definitions["order_on_time_rate_all_orders"]

    # 2. Strict operational KPIs (excluding carrier-unavailable nulls)
    assert kpis["order_on_time_rate_strict_all_orders"] == 96.586
    assert kpis["order_on_time_rate_strict_completed"] == 97.7176
    assert "excludes carrier-unavailable nulls" in definitions["order_on_time_rate_strict_all_orders"]


def test_carrier_performance_metrics(metrics_svc):
    """Verify carrier performance is computed at shipment grain for all carriers."""
    perf = metrics_svc.get_carrier_performance()
    assert len(perf) == 10  # 10 carriers in master data
    
    total_shipments = sum(c["shipment_count"] for c in perf)
    assert total_shipments == 49436
    
    for c in perf:
        assert c["shipment_count"] > 4000
        assert 0.0 <= c["on_time_rate_pct"] <= 100.0
        assert 0.0 <= c["delay_rate_pct"] <= 100.0
        assert round(c["on_time_rate_pct"] + c["delay_rate_pct"], 2) == 100.0


def test_warehouse_utilization_metrics(metrics_svc):
    """Verify warehouse utilization by node across active node-days."""
    util = metrics_svc.get_warehouse_utilization()
    assert len(util) == 20  # 20 fulfillment nodes
    
    for node in util:
        assert node["active_node_days"] > 0
        assert node["order_capacity"] > 0
        assert node["unit_capacity"] > 0
        assert 0.0 <= node["order_utilization_pct"] <= 100.0
        assert 0.0 <= node["unit_utilization_pct"] <= 100.0


def test_monthly_delivery_trends(metrics_svc):
    """Verify monthly delivery trend calculations across the calendar year."""
    trends = metrics_svc.get_monthly_delivery_trends()
    assert len(trends) == 11  # 11 distinct months (2025-12 through 2026-10) in historical dataset
    
    total_monthly_orders = sum(m["orders"] for m in trends)
    assert total_monthly_orders == 50000
    
    for m in trends:
        assert m["orders"] > 0
        if m["month"] != "2025-12":
            assert m["orders"] > 3000
        else:
            assert m["orders"] == 45
        assert 0.0 <= m["on_time_rate_all_orders_pct"] <= 100.0
        assert 0.0 <= m["completion_rate_pct"] <= 100.0


def test_headline_summary(metrics_svc):
    """Verify headline summary JSON matches expected structure."""
    headline = metrics_svc.get_headline_summary()
    assert headline["total_orders"] == 50000
    assert headline["allocated_orders"] == 50000
    assert headline["shipments"] == 49436
    assert headline["split_node_orders"] == 11
    assert "order_on_time_rate_all_orders_pct" in headline
    assert headline["order_on_time_rate_all_orders_pct"] == 97.74
    assert headline["order_on_time_rate_completed_pct"] == 98.89
    assert headline["order_on_time_rate_strict_all_orders_pct"] == 96.59
    assert headline["order_on_time_rate_strict_completed_pct"] == 97.72
    assert "warehouse_order_capacity_utilization_pct" in headline
