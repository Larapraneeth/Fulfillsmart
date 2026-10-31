r"""
FulfillSmart Anomaly Detection Evaluation Harness
Calculates TP, FP, FN, TN, Precision, Recall, and F1 score from actual detector predictions.
Performs:
1. Injected anomaly evaluation on replacement ground-truth test cases (per-category and overall).
2. Clean operational data evaluation to verify zero false positives on production datasets.
3. Explicit zero-denominator handling for all metrics.
"""
import csv
import json
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

from src.db import get_db
from src.engine.anomaly_detector import AnomalyDetector, AnomalyFinding


@dataclass
class MetricScore:
    tp: int
    fp: int
    fn: int
    tn: int
    precision: float
    recall: float
    f1_score: float
    accuracy: float
    support: int


@dataclass
class EvaluationReport:
    total_cases_evaluated: int
    overall_micro: MetricScore
    overall_macro_precision: float
    overall_macro_recall: float
    overall_macro_f1: float
    category_scores: Dict[str, MetricScore]
    clean_operational_records_evaluated: int
    clean_operational_false_positives: int


def calculate_metrics(tp: int, fp: int, fn: int, tn: int) -> MetricScore:
    """Calculates precision, recall, F1, and accuracy with explicit zero denominator handling."""
    precision = (tp / (tp + fp)) if (tp + fp) > 0 else 0.0
    recall = (tp / (tp + fn)) if (tp + fn) > 0 else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
    total = tp + fp + fn + tn
    accuracy = ((tp + tn) / total) if total > 0 else 0.0
    support = tp + fn

    return MetricScore(
        tp=tp,
        fp=fp,
        fn=fn,
        tn=tn,
        precision=round(precision, 4),
        recall=round(recall, 4),
        f1_score=round(f1, 4),
        accuracy=round(accuracy, 4),
        support=support
    )


class AnomalyEvaluationHarness:
    """
    Evaluation harness for benchmarking the AnomalyDetector against labelled cases
    and clean operational data.
    """
    AGREED_CATEGORIES = [
        "ALLOCATION_EXCEEDS_AVAILABLE_STOCK",
        "CARRIER_UNSUPPORTED_ZONE",
        "DELIVERED_BEFORE_DISPATCH",
        "INCORRECT_SPLIT_SHIPMENT_STATUS_ROLLUP",
        "PROMISE_BEFORE_ORDER",
        "WAREHOUSE_CAPACITY_EXCEEDED"
    ]

    def __init__(self, detector: Optional[AnomalyDetector] = None):
        self.detector = detector or AnomalyDetector()

    def evaluate_replacement_ground_truth(
        self,
        csv_path: Optional[Path] = None
    ) -> Dict[str, Any]:
        """
        Runs the detector over all labelled replacement test cases and calculates
        actual per-category and macro/micro precision, recall, and F1.
        Does NOT hardcode expected predictions.
        """
        if csv_path is None:
            csv_path = Path(__file__).resolve().parents[2] / "data" / "replacement_ground_truth" / "replacement_ground_truth.csv"

        if not csv_path.exists():
            raise FileNotFoundError(f"Replacement ground truth CSV not found at {csv_path}")

        # Per-category counts
        cat_counts: Dict[str, Dict[str, int]] = {
            cat: {"tp": 0, "fp": 0, "fn": 0, "tn": 0}
            for cat in self.AGREED_CATEGORIES
        }

        total_cases = 0

        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                total_cases += 1
                case_id = row["case_id"]
                labelled_type = row["anomaly_type"]
                payload = json.loads(row["scenario_payload"])

                # Run detector independently on scenario fields
                finding: Optional[AnomalyFinding] = self.detector.detect_scenario(payload, case_id=case_id)
                predicted_type = finding.anomaly_type if finding else None

                # Update confusion matrix
                if predicted_type == labelled_type:
                    cat_counts[labelled_type]["tp"] += 1
                    # For all other categories, this was correctly NOT flagged
                    for other_cat in self.AGREED_CATEGORIES:
                        if other_cat != labelled_type:
                            cat_counts[other_cat]["tn"] += 1
                elif predicted_type is None:
                    # Missed detection (False Negative)
                    cat_counts[labelled_type]["fn"] += 1
                    for other_cat in self.AGREED_CATEGORIES:
                        if other_cat != labelled_type:
                            cat_counts[other_cat]["tn"] += 1
                else:
                    # Wrong category detected
                    cat_counts[labelled_type]["fn"] += 1
                    if predicted_type in cat_counts:
                        cat_counts[predicted_type]["fp"] += 1
                    for other_cat in self.AGREED_CATEGORIES:
                        if other_cat not in (labelled_type, predicted_type):
                            cat_counts[other_cat]["tn"] += 1

        # Calculate per-category metrics
        category_metrics: Dict[str, MetricScore] = {}
        for cat in self.AGREED_CATEGORIES:
            c = cat_counts[cat]
            category_metrics[cat] = calculate_metrics(
                tp=c["tp"], fp=c["fp"], fn=c["fn"], tn=c["tn"]
            )

        # Micro-average
        total_tp = sum(cat_counts[cat]["tp"] for cat in self.AGREED_CATEGORIES)
        total_fp = sum(cat_counts[cat]["fp"] for cat in self.AGREED_CATEGORIES)
        total_fn = sum(cat_counts[cat]["fn"] for cat in self.AGREED_CATEGORIES)
        total_tn = sum(cat_counts[cat]["tn"] for cat in self.AGREED_CATEGORIES)
        overall_micro = calculate_metrics(total_tp, total_fp, total_fn, total_tn)

        # Macro-averages across all agreed categories
        macro_precision = round(
            sum(category_metrics[cat].precision for cat in self.AGREED_CATEGORIES) / len(self.AGREED_CATEGORIES),
            4
        )
        macro_recall = round(
            sum(category_metrics[cat].recall for cat in self.AGREED_CATEGORIES) / len(self.AGREED_CATEGORIES),
            4
        )
        macro_f1 = round(
            sum(category_metrics[cat].f1_score for cat in self.AGREED_CATEGORIES) / len(self.AGREED_CATEGORIES),
            4
        )

        return {
            "total_cases_evaluated": total_cases,
            "overall_micro": asdict(overall_micro),
            "overall_macro_precision": macro_precision,
            "overall_macro_recall": macro_recall,
            "overall_macro_f1": macro_f1,
            "category_scores": {cat: asdict(category_metrics[cat]) for cat in self.AGREED_CATEGORIES}
        }

    def evaluate_clean_operational_data(
        self,
        sample_limit: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Evaluates the detector on clean historical database records across all six anomaly rules
        to confirm zero false positives on production datasets.
        Scans allocations, carrier selections, shipment delivery dates, split rollups,
        delivery promises, and warehouse capacity usage.
        """
        cat_counts = {
            "ALLOCATION_EXCEEDS_AVAILABLE_STOCK": {"evaluated": 0, "false_positives": 0},
            "CARRIER_UNSUPPORTED_ZONE": {"evaluated": 0, "false_positives": 0},
            "DELIVERED_BEFORE_DISPATCH": {"evaluated": 0, "false_positives": 0},
            "INCORRECT_SPLIT_SHIPMENT_STATUS_ROLLUP": {"evaluated": 0, "false_positives": 0},
            "PROMISE_BEFORE_ORDER": {"evaluated": 0, "false_positives": 0},
            "WAREHOUSE_CAPACITY_EXCEEDED": {"evaluated": 0, "false_positives": 0},
        }

        with get_db() as conn:
            cursor = conn.cursor()

            # Rule 1: ALLOCATION_EXCEEDS_AVAILABLE_STOCK (allocations vs inventory)
            query_alloc = """
                SELECT a.order_id, a.node_id, a.sku_id, a.allocated_qty, i.available_qty
                FROM allocation_decisions a
                JOIN inventory i ON a.node_id = i.node_id AND a.sku_id = i.sku_id
            """
            if sample_limit:
                query_alloc += f" LIMIT {sample_limit}"
            cursor.execute(query_alloc)
            for r in cursor.fetchall():
                cat_counts["ALLOCATION_EXCEEDS_AVAILABLE_STOCK"]["evaluated"] += 1
                f = self.detector.inspect_allocation(
                    order_id=r["order_id"],
                    node_id=r["node_id"],
                    sku_id=r["sku_id"],
                    allocated_qty=r["allocated_qty"],
                    available_qty=r["available_qty"]
                )
                if f:
                    cat_counts["ALLOCATION_EXCEEDS_AVAILABLE_STOCK"]["false_positives"] += 1

            # Rule 2: CARRIER_UNSUPPORTED_ZONE (carrier service zone coverage)
            query_carrier = "SELECT order_id, carrier_id, delivery_zone_id, selected_service FROM carrier_selection"
            if sample_limit:
                query_carrier += f" LIMIT {sample_limit}"
            cursor.execute(query_carrier)
            for r in cursor.fetchall():
                cat_counts["CARRIER_UNSUPPORTED_ZONE"]["evaluated"] += 1
                f = self.detector.inspect_carrier_selection(
                    order_id=r["order_id"],
                    carrier_id=r["carrier_id"],
                    destination_zone_id=r["delivery_zone_id"],
                    requested_service=r["selected_service"]
                )
                if f:
                    cat_counts["CARRIER_UNSUPPORTED_ZONE"]["false_positives"] += 1

            # Rule 3: DELIVERED_BEFORE_DISPATCH (actual delivery vs dispatch date)
            query_ship = "SELECT shipment_id, dispatch_date, actual_delivery_date FROM shipments WHERE actual_delivery_date IS NOT NULL"
            if sample_limit:
                query_ship += f" LIMIT {sample_limit}"
            cursor.execute(query_ship)
            for r in cursor.fetchall():
                cat_counts["DELIVERED_BEFORE_DISPATCH"]["evaluated"] += 1
                f = self.detector.inspect_shipment_delivery(
                    shipment_id=r["shipment_id"],
                    dispatch_date=r["dispatch_date"],
                    actual_delivery_date=r["actual_delivery_date"]
                )
                if f:
                    cat_counts["DELIVERED_BEFORE_DISPATCH"]["false_positives"] += 1

            # Rule 4: INCORRECT_SPLIT_SHIPMENT_STATUS_ROLLUP (multi-shipment rollup consistency)
            query_split = """
                SELECT o.order_id, o.delivery_outcome_status, o.delivery_on_time, o.delayed_shipment_count
                FROM delivery_outcomes o
                JOIN order_allocation_summary s ON o.order_id = s.order_id
                WHERE s.allocated_node_count > 1
            """
            if sample_limit:
                query_split += f" LIMIT {sample_limit}"
            cursor.execute(query_split)
            split_orders = cursor.fetchall()
            for r in split_orders:
                cat_counts["INCORRECT_SPLIT_SHIPMENT_STATUS_ROLLUP"]["evaluated"] += 1
                cursor.execute(
                    "SELECT shipment_id, dispatch_date, promised_delivery_date, actual_delivery_date, is_delayed FROM shipments WHERE order_id = ?",
                    (r["order_id"],)
                )
                shipments = [dict(s) for s in cursor.fetchall()]
                f = self.detector.inspect_split_rollup(
                    order_id=r["order_id"],
                    shipments=shipments,
                    reported_status=r["delivery_outcome_status"],
                    reported_on_time=r["delivery_on_time"],
                    reported_delayed_count=r["delayed_shipment_count"]
                )
                if f:
                    cat_counts["INCORRECT_SPLIT_SHIPMENT_STATUS_ROLLUP"]["false_positives"] += 1

            # Rule 5: PROMISE_BEFORE_ORDER (delivery promise vs customer order date)
            query_prom = """
                SELECT p.order_id, o.order_time, p.dispatch_date, p.promised_delivery_date
                FROM delivery_promises p
                JOIN orders o ON p.order_id = o.order_id
            """
            if sample_limit:
                query_prom += f" LIMIT {sample_limit}"
            cursor.execute(query_prom)
            for r in cursor.fetchall():
                cat_counts["PROMISE_BEFORE_ORDER"]["evaluated"] += 1
                f = self.detector.inspect_delivery_promise(
                    order_id=r["order_id"],
                    order_time=r["order_time"],
                    dispatch_date=r["dispatch_date"],
                    promised_delivery_date=r["promised_delivery_date"]
                )
                if f:
                    cat_counts["PROMISE_BEFORE_ORDER"]["false_positives"] += 1

            # Rule 6: WAREHOUSE_CAPACITY_EXCEEDED (allocated capacity vs declared limits)
            query_cap = "SELECT node_id, capacity_date, max_orders, max_units, allocated_orders, allocated_units FROM capacity_usage"
            if sample_limit:
                query_cap += f" LIMIT {sample_limit}"
            cursor.execute(query_cap)
            for r in cursor.fetchall():
                cat_counts["WAREHOUSE_CAPACITY_EXCEEDED"]["evaluated"] += 1
                f = self.detector.inspect_warehouse_capacity(
                    node_id=r["node_id"],
                    capacity_date=r["capacity_date"],
                    max_orders=r["max_orders"],
                    max_units=r["max_units"],
                    allocated_orders=r["allocated_orders"],
                    allocated_units=r["allocated_units"]
                )
                if f:
                    cat_counts["WAREHOUSE_CAPACITY_EXCEEDED"]["false_positives"] += 1

        total_checked = sum(v["evaluated"] for v in cat_counts.values())
        false_positives = sum(v["false_positives"] for v in cat_counts.values())

        return {
            "records_evaluated": total_checked,
            "false_positives": false_positives,
            "false_positive_rate_pct": round((false_positives / total_checked * 100), 4) if total_checked > 0 else 0.0,
            "specificity_pct": round(((total_checked - false_positives) / total_checked * 100), 4) if total_checked > 0 else 100.0,
            "per_category_evaluations": cat_counts
        }
