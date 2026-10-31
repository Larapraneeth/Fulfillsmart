r"""
FulfillSmart Reusable Metrics Service
Implements the Step 7 performance metrics and KPI calculation methodology
without modifying or rewriting generate_step7.py.

Provides clean APIs for:
1. Headline operational KPIs (18 standard metrics matching kpi_summary.csv).
2. Carrier-level shipment performance (delay counts, on-time rates, average delay).
3. Warehouse capacity utilization (order/unit utilization by node).
4. Monthly order delivery trends.
5. Anomaly detection performance evaluation metrics.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any
import sqlite3
import pandas as pd

from src.db import get_db_connection, get_db_context
from src.engine.anomaly_harness import AnomalyEvaluationHarness


class MetricsService:
    """
    Reusable metrics service computing operational KPIs and evaluation metrics
    from SQLite database records or DataFrames.
    """
    def __init__(self):
        """Initialize MetricsService with evaluation harness."""
        self._harness = AnomalyEvaluationHarness()

    def get_kpi_summary(self) -> List[Dict[str, Any]]:
        """
        Calculates the 18 standard operational KPIs matching Step 7 definitions exactly.
        """
        with get_db_context() as conn:
            cursor = conn.cursor()

            # Orders & Allocation
            cursor.execute("SELECT COUNT(*) FROM orders")
            total_orders = cursor.fetchone()[0]

            cursor.execute(
                "SELECT COUNT(*) FROM order_allocation_summary WHERE allocation_status = 'ALLOCATED'"
            )
            allocated_orders = cursor.fetchone()[0]

            cursor.execute(
                "SELECT COUNT(*) FROM order_allocation_summary WHERE allocated_node_count > 1"
            )
            split_orders = cursor.fetchone()[0]

            single_node_orders = allocated_orders - split_orders
            unallocated_orders = total_orders - allocated_orders

            # Carrier Selections
            cursor.execute("SELECT COUNT(*) FROM carrier_selection")
            carrier_selections = cursor.fetchone()[0]

            # Shipments
            cursor.execute("SELECT COUNT(*), SUM(is_delayed) FROM shipments")
            s_row = cursor.fetchone()
            shipment_count = s_row[0] or 0
            shipment_late = s_row[1] or 0

            # Delivery Outcomes
            cursor.execute(
                """
                SELECT
                    SUM(delivery_completed),
                    SUM(delivery_on_time),
                    SUM(CASE WHEN delivery_outcome_status = 'DELIVERED_LATE' THEN 1 ELSE 0 END),
                    SUM(CASE WHEN delivery_outcome_status = 'CARRIER_UNAVAILABLE' THEN 1 ELSE 0 END)
                FROM delivery_outcomes
                """
            )
            o_row = cursor.fetchone()
            completed = o_row[0] or 0
            on_time_strict = o_row[1] or 0
            late = o_row[2] or 0
            carrier_unavailable = o_row[3] or 0
            # Historical Step 7 compatibility: Pandas astype(bool) coerced carrier-unavailable NaNs to True
            on_time_historical = on_time_strict + carrier_unavailable

            # Warehouse Capacity Usage
            cursor.execute(
                "SELECT SUM(max_orders), SUM(allocated_orders), SUM(max_units), SUM(allocated_units) FROM capacity_usage"
            )
            c_row = cursor.fetchone()
            cap_orders = c_row[0] or 0
            used_orders = c_row[1] or 0
            cap_units = c_row[2] or 0
            used_units = c_row[3] or 0

            # Compile KPIs
            kpis = [
                {"metric": "total_orders", "value": total_orders, "unit": "orders", "definition": "All synthetic orders in orders.csv"},
                {"metric": "allocation_success_rate", "value": round(allocated_orders / total_orders * 100, 4) if total_orders else 0.0, "unit": "percent", "definition": "Allocated orders / total orders"},
                {"metric": "allocated_orders", "value": allocated_orders, "unit": "orders", "definition": "Orders with ALLOCATED status"},
                {"metric": "unallocated_orders", "value": unallocated_orders, "unit": "orders", "definition": "Total orders minus allocated orders"},
                {"metric": "carrier_promise_coverage_rate", "value": round(carrier_selections / total_orders * 100, 4) if total_orders else 0.0, "unit": "percent", "definition": "Orders with a carrier selection / all orders; split orders can have multiple selections"},
                {"metric": "shipment_count", "value": shipment_count, "unit": "shipments", "definition": "Rows in shipments.csv"},
                {"metric": "shipment_on_time_rate", "value": round((shipment_count - shipment_late) / shipment_count * 100, 4) if shipment_count else 0.0, "unit": "percent", "definition": "Shipments not flagged delayed / all shipments"},
                {"metric": "shipment_delay_rate", "value": round(shipment_late / shipment_count * 100, 4) if shipment_count else 0.0, "unit": "percent", "definition": "Shipments flagged delayed / all shipments"},
                {"metric": "order_delivery_completion_rate", "value": round(completed / total_orders * 100, 4) if total_orders else 0.0, "unit": "percent", "definition": "Orders with completed delivery / all orders"},
                {"metric": "order_on_time_rate_all_orders", "value": round(on_time_historical / total_orders * 100, 4) if total_orders else 0.0, "unit": "percent", "definition": "Historical Step 7 definition: on-time delivered orders / all orders (reproduces legacy Pandas astype(bool) artifact where carrier-unavailable NaNs were counted as True)"},
                {"metric": "order_on_time_rate_completed", "value": round(on_time_historical / completed * 100, 4) if completed else 0.0, "unit": "percent", "definition": "Historical Step 7 definition: on-time delivered orders / completed orders (reproduces legacy Pandas astype(bool) artifact where carrier-unavailable NaNs were counted as True)"},
                {"metric": "order_on_time_rate_strict_all_orders", "value": round(on_time_strict / total_orders * 100, 4) if total_orders else 0.0, "unit": "percent", "definition": "Strict operational definition: genuine on-time delivered orders / all orders (excludes carrier-unavailable nulls from numerator)"},
                {"metric": "order_on_time_rate_strict_completed", "value": round(on_time_strict / completed * 100, 4) if completed else 0.0, "unit": "percent", "definition": "Strict operational definition: genuine on-time delivered orders / completed orders (excludes carrier-unavailable nulls from numerator)"},
                {"metric": "late_orders", "value": late, "unit": "orders", "definition": "Order outcome DELIVERED_LATE"},
                {"metric": "carrier_unavailable_orders", "value": carrier_unavailable, "unit": "orders", "definition": "Order outcome CARRIER_UNAVAILABLE"},
                {"metric": "split_shipment_order_rate", "value": round(split_orders / allocated_orders * 100, 4) if allocated_orders else 0.0, "unit": "percent", "definition": "Allocated orders assigned to more than one node / allocated orders"},
                {"metric": "single_node_orders", "value": single_node_orders, "unit": "orders", "definition": "Allocated orders assigned to exactly one node"},
                {"metric": "split_node_orders", "value": split_orders, "unit": "orders", "definition": "Allocated orders assigned to multiple nodes"},
                {"metric": "warehouse_order_capacity_utilization", "value": round(used_orders / cap_orders * 100, 4) if cap_orders else 0.0, "unit": "percent", "definition": "Sum allocated order capacity / sum capacity across used node-days"},
                {"metric": "warehouse_unit_capacity_utilization", "value": round(used_units / cap_units * 100, 4) if cap_units else 0.0, "unit": "percent", "definition": "Sum allocated unit capacity / sum capacity across used node-days"},
            ]
            return kpis

    def get_carrier_performance(self) -> List[Dict[str, Any]]:
        """
        Calculates shipment-level carrier performance metrics matching carrier_performance.csv.
        """
        conn = get_db_connection()
        df_shipments = pd.read_sql_query("SELECT shipment_id, carrier_id, is_delayed, delay_days FROM shipments", conn)
        df_carriers = pd.read_sql_query("SELECT carrier_id, carrier_name FROM carriers", conn)

        merged = df_shipments.merge(df_carriers, on="carrier_id", how="left")
        agg = merged.groupby(["carrier_id", "carrier_name"], dropna=False).agg(
            shipment_count=("shipment_id", "count"),
            delayed_shipments=("is_delayed", lambda x: int(x.astype(bool).sum())),
            average_delay_days=("delay_days", "mean"),
            median_delay_days=("delay_days", "median")
        ).reset_index()

        agg["on_time_rate_pct"] = (1 - agg["delayed_shipments"] / agg["shipment_count"]) * 100
        agg["delay_rate_pct"] = (agg["delayed_shipments"] / agg["shipment_count"]) * 100
        return agg.to_dict(orient="records")

    def get_warehouse_utilization(self) -> List[Dict[str, Any]]:
        """
        Calculates node utilization matching warehouse_utilization.csv.
        """
        with get_db_context() as conn:
            df_capacity = pd.read_sql_query("SELECT node_id, capacity_date, allocated_orders, allocated_units, max_orders, max_units FROM capacity_usage", conn)
            df_nodes = pd.read_sql_query("SELECT node_id, node_name, city, state FROM fulfillment_nodes", conn)

        node_perf = df_capacity.groupby("node_id").agg(
            active_node_days=("capacity_date", "nunique"),
            allocated_orders=("allocated_orders", "sum"),
            allocated_units=("allocated_units", "sum"),
            order_capacity=("max_orders", "sum"),
            unit_capacity=("max_units", "sum")
        ).reset_index().merge(df_nodes, on="node_id", how="left")

        node_perf["order_utilization_pct"] = (node_perf["allocated_orders"] / node_perf["order_capacity"]) * 100
        node_perf["unit_utilization_pct"] = (node_perf["allocated_units"] / node_perf["unit_capacity"]) * 100
        return node_perf.to_dict(orient="records")

    def get_monthly_delivery_trends(self) -> List[Dict[str, Any]]:
        """
        Calculates monthly order outcome trends matching monthly_delivery_trend.csv.
        """
        with get_db_context() as conn:
            df_outcomes = pd.read_sql_query("SELECT order_id, order_time, delivery_outcome_status, delivery_completed, delivery_on_time FROM delivery_outcomes", conn)

        df_outcomes["month"] = pd.to_datetime(df_outcomes["order_time"], utc=True).dt.strftime("%Y-%m")
        monthly = df_outcomes.groupby("month").agg(
            orders=("order_id", "count"),
            on_time_orders=("delivery_on_time", lambda x: int(x.astype(bool).sum())),
            completed_orders=("delivery_completed", lambda x: int(x.astype(bool).sum())),
            late_orders=("delivery_outcome_status", lambda x: int((x == "DELIVERED_LATE").sum())),
            carrier_unavailable_orders=("delivery_outcome_status", lambda x: int((x == "CARRIER_UNAVAILABLE").sum()))
        ).reset_index()

        monthly["on_time_rate_all_orders_pct"] = (monthly["on_time_orders"] / monthly["orders"]) * 100
        monthly["completion_rate_pct"] = (monthly["completed_orders"] / monthly["orders"]) * 100
        return monthly.to_dict(orient="records")

    def get_headline_summary(self) -> Dict[str, Any]:
        """
        Returns machine-readable headline metrics dictionary matching step7_metrics_summary.json.
        """
        kpis = {k["metric"]: k["value"] for k in self.get_kpi_summary()}
        return {
            "total_orders": kpis["total_orders"],
            "allocated_orders": kpis["allocated_orders"],
            "allocation_success_rate_pct": round(kpis["allocation_success_rate"], 2),
            "shipments": kpis["shipment_count"],
            "order_on_time_rate_all_orders_pct": round(kpis["order_on_time_rate_all_orders"], 2),
            "order_on_time_rate_completed_pct": round(kpis["order_on_time_rate_completed"], 2),
            "order_on_time_rate_strict_all_orders_pct": round(kpis["order_on_time_rate_strict_all_orders"], 2),
            "order_on_time_rate_strict_completed_pct": round(kpis["order_on_time_rate_strict_completed"], 2),
            "carrier_unavailable_orders": kpis["carrier_unavailable_orders"],
            "split_node_orders": kpis["split_node_orders"],
            "warehouse_order_capacity_utilization_pct": round(kpis["warehouse_order_capacity_utilization"], 2),
            "warehouse_unit_capacity_utilization_pct": round(kpis["warehouse_unit_capacity_utilization"], 2)
        }

    def evaluate_anomaly_detection(self) -> Dict[str, Any]:
        """
        Runs evaluation harness against replacement ground-truth dataset and clean operational records.
        """
        test_results = self._harness.evaluate_replacement_ground_truth()
        clean_results = self._harness.evaluate_clean_operational_data()
        return {
            "replacement_test_evaluation": test_results,
            "clean_operational_evaluation": clean_results
        }
