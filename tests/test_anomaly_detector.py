r"""
Focused Test Suite: Anomaly Detector & Evaluation Harness
Verifies:
1. Individual detection logic across all six business invariant rules.
2. Evaluation harness calculation of TP, FP, FN, TN, Precision, Recall, and F1.
3. Performance against 976 replacement synthetic test cases.
4. Clean operational data evaluation confirming zero false positives.
"""
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.engine.anomaly_detector import AnomalyDetector
from src.engine.anomaly_harness import AnomalyEvaluationHarness, calculate_metrics


@pytest.fixture
def detector():
    return AnomalyDetector(load_coverage_matrix=True)


@pytest.fixture
def harness(detector):
    return AnomalyEvaluationHarness(detector=detector)


def test_rule_1_allocation_exceeds_available_stock(detector):
    """Verify allocated_qty > available_qty is detected."""
    # Positive case (Violation)
    finding = detector.inspect_allocation(
        order_id="ORD-T1", node_id="FUL-01", sku_id="SKU-01",
        allocated_qty=15, available_qty=10
    )
    assert finding is not None
    assert finding.anomaly_type == "ALLOCATION_EXCEEDS_AVAILABLE_STOCK"
    assert finding.severity == "CRITICAL"

    # Negative case (Valid)
    no_finding = detector.inspect_allocation(
        order_id="ORD-T1", node_id="FUL-01", sku_id="SKU-01",
        allocated_qty=10, available_qty=10
    )
    assert no_finding is None


def test_rule_2_carrier_unsupported_zone(detector):
    """Verify carrier assigning unsupported zone/service is detected."""
    # Positive case (Violation: coverage is False)
    finding = detector.inspect_carrier_selection(
        order_id="ORD-T2", carrier_id="CAR-001", destination_zone_id="DZ-999",
        requested_service="SAME_DAY", is_zone_covered=False
    )
    assert finding is not None
    assert finding.anomaly_type == "CARRIER_UNSUPPORTED_ZONE"
    assert finding.severity == "HIGH"

    # Negative case (Valid: coverage is True)
    no_finding = detector.inspect_carrier_selection(
        order_id="ORD-T2", carrier_id="CAR-001", destination_zone_id="DZ-001",
        requested_service="STANDARD", is_zone_covered=True
    )
    assert no_finding is None


def test_rule_3_delivered_before_dispatch(detector):
    """Verify actual_delivery_date < dispatch_date is detected."""
    # Positive case (Violation: delivered April 5, dispatched April 7)
    finding = detector.inspect_shipment_delivery(
        shipment_id="SHP-T3", dispatch_date="2026-04-07", actual_delivery_date="2026-04-05"
    )
    assert finding is not None
    assert finding.anomaly_type == "DELIVERED_BEFORE_DISPATCH"
    assert finding.severity == "CRITICAL"

    # Negative case (Valid: delivered April 9, dispatched April 7)
    no_finding = detector.inspect_shipment_delivery(
        shipment_id="SHP-T3", dispatch_date="2026-04-07", actual_delivery_date="2026-04-09"
    )
    assert no_finding is None


def test_rule_4_incorrect_split_shipment_status_rollup(detector):
    """Verify split shipment marked DELIVERED_ON_TIME despite delayed shipment is detected."""
    shipments = [
        {"shipment_id": "S1", "promised": "2026-05-10", "actual": "2026-05-10", "is_delayed": 0},
        {"shipment_id": "S2", "promised": "2026-05-10", "actual": "2026-05-12", "is_delayed": 1}
    ]
    # Positive case (Violation: reported DELIVERED_ON_TIME despite S2 being late)
    finding = detector.inspect_split_rollup(
        order_id="ORD-T4", shipments=shipments,
        reported_status="DELIVERED_ON_TIME", reported_on_time=1
    )
    assert finding is not None
    assert finding.anomaly_type == "INCORRECT_SPLIT_SHIPMENT_STATUS_ROLLUP"
    assert finding.severity == "HIGH"

    # Negative case (Valid: reported DELIVERED_LATE when S2 is late)
    no_finding = detector.inspect_split_rollup(
        order_id="ORD-T4", shipments=shipments,
        reported_status="DELIVERED_LATE", reported_on_time=0
    )
    assert no_finding is None


def test_rule_5_promise_before_order(detector):
    """Verify promised_delivery_date < order_date is detected."""
    # Positive case (Violation: order placed June 10, promise is June 8)
    finding = detector.inspect_delivery_promise(
        order_id="ORD-T5", order_time="2026-06-10T10:00:00+05:30",
        dispatch_date="2026-06-08", promised_delivery_date="2026-06-08"
    )
    assert finding is not None
    assert finding.anomaly_type == "PROMISE_BEFORE_ORDER"
    assert finding.severity == "HIGH"

    # Negative case (Valid: order June 10, promise June 14)
    no_finding = detector.inspect_delivery_promise(
        order_id="ORD-T5", order_time="2026-06-10T10:00:00+05:30",
        dispatch_date="2026-06-10", promised_delivery_date="2026-06-14"
    )
    assert no_finding is None


def test_rule_6_warehouse_capacity_exceeded(detector):
    """Verify allocated_orders > max_orders or allocated_units > max_units is detected."""
    # Positive case (Violation: 120 allocated > 100 max)
    finding = detector.inspect_warehouse_capacity(
        node_id="FUL-01", capacity_date="2026-07-01",
        max_orders=100, max_units=500, allocated_orders=120, allocated_units=400
    )
    assert finding is not None
    assert finding.anomaly_type == "WAREHOUSE_CAPACITY_EXCEEDED"
    assert finding.severity == "CRITICAL"

    # Negative case (Valid: 90 <= 100, 450 <= 500)
    no_finding = detector.inspect_warehouse_capacity(
        node_id="FUL-01", capacity_date="2026-07-01",
        max_orders=100, max_units=500, allocated_orders=90, allocated_units=450
    )
    assert no_finding is None


def test_calculate_metrics_zero_denominators():
    """Verify calculate_metrics handles zero denominators without error."""
    score = calculate_metrics(tp=0, fp=0, fn=0, tn=0)
    assert score.precision == 0.0
    assert score.recall == 0.0
    assert score.f1_score == 0.0
    assert score.accuracy == 0.0
    assert score.support == 0


def test_evaluation_harness_on_replacement_ground_truth(harness):
    """
    Evaluate harness over all 976 replacement synthetic test cases.
    Verifies actual predictions against ground-truth labels and computes Precision, Recall, and F1.
    Confirms confusion-matrix consistency (TP + FP + FN + TN == 976 for each category)
    and verifies both micro and macro averages.
    """
    report = harness.evaluate_replacement_ground_truth()
    assert report["total_cases_evaluated"] == 976
    
    # Expected case counts per category
    expected_support = {
        "ALLOCATION_EXCEEDS_AVAILABLE_STOCK": 200,
        "CARRIER_UNSUPPORTED_ZONE": 165,
        "DELIVERED_BEFORE_DISPATCH": 200,
        "INCORRECT_SPLIT_SHIPMENT_STATUS_ROLLUP": 11,
        "PROMISE_BEFORE_ORDER": 200,
        "WAREHOUSE_CAPACITY_EXCEEDED": 200
    }

    # Check each category's one-vs-rest confusion matrix consistency
    assert len(report["category_scores"]) == 6
    for cat_name, metrics in report["category_scores"].items():
        assert metrics["support"] == expected_support[cat_name]
        assert metrics["tp"] == expected_support[cat_name]
        assert metrics["fp"] == 0
        assert metrics["fn"] == 0
        assert metrics["tn"] == 976 - expected_support[cat_name]
        # Invariant: TP + FP + FN + TN == Total cases (976)
        assert metrics["tp"] + metrics["fp"] + metrics["fn"] + metrics["tn"] == 976
        assert metrics["precision"] == 1.0
        assert metrics["recall"] == 1.0
        assert metrics["f1_score"] == 1.0

    # Macro averages across all 6 categories
    assert report["overall_macro_precision"] == 1.0
    assert report["overall_macro_recall"] == 1.0
    assert report["overall_macro_f1"] == 1.0

    # Micro average
    assert report["overall_micro"]["precision"] == 1.0
    assert report["overall_micro"]["recall"] == 1.0
    assert report["overall_micro"]["f1_score"] == 1.0
    assert report["overall_micro"]["tp"] == 976
    assert report["overall_micro"]["fp"] == 0
    assert report["overall_micro"]["fn"] == 0


def test_evaluation_harness_clean_operational_data_zero_false_positives(harness):
    """
    Evaluate harness on clean historical operational database records across ALL six rules.
    Verifies exact 247,061 rule evaluations and confirms 0 false positives per category.
    """
    clean_eval = harness.evaluate_clean_operational_data()
    assert clean_eval["records_evaluated"] == 247061
    assert clean_eval["false_positives"] == 0
    assert clean_eval["false_positive_rate_pct"] == 0.0
    assert clean_eval["specificity_pct"] == 100.0

    per_cat = clean_eval["per_category_evaluations"]
    assert len(per_cat) == 6

    # Verify per-category counts and 0 false positives
    assert per_cat["ALLOCATION_EXCEEDS_AVAILABLE_STOCK"]["evaluated"] == 93558
    assert per_cat["ALLOCATION_EXCEEDS_AVAILABLE_STOCK"]["false_positives"] == 0

    assert per_cat["CARRIER_UNSUPPORTED_ZONE"]["evaluated"] == 49436
    assert per_cat["CARRIER_UNSUPPORTED_ZONE"]["false_positives"] == 0

    assert per_cat["DELIVERED_BEFORE_DISPATCH"]["evaluated"] == 49436
    assert per_cat["DELIVERED_BEFORE_DISPATCH"]["false_positives"] == 0

    assert per_cat["INCORRECT_SPLIT_SHIPMENT_STATUS_ROLLUP"]["evaluated"] == 11
    assert per_cat["INCORRECT_SPLIT_SHIPMENT_STATUS_ROLLUP"]["false_positives"] == 0

    assert per_cat["PROMISE_BEFORE_ORDER"]["evaluated"] == 49436
    assert per_cat["PROMISE_BEFORE_ORDER"]["false_positives"] == 0

    assert per_cat["WAREHOUSE_CAPACITY_EXCEEDED"]["evaluated"] == 5184
    assert per_cat["WAREHOUSE_CAPACITY_EXCEEDED"]["false_positives"] == 0
