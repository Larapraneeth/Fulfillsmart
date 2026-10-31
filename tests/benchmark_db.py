r"""
FulfillSmart Database Query Performance Benchmark
Executes and records actual hardware query timings on E:\FulfillSmart\storage\fulfillsmart.db.
Benchmarks pagination, multi-criteria filtering, full order joins, and event lookups.
"""
import time
import statistics
import sqlite3
from typing import List, Dict, Any
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.db import get_db


def run_timed_query(conn: sqlite3.Connection, query: str, params: tuple = (), iterations: int = 20) -> Dict[str, Any]:
    """Execute query multiple times and measure elapsed times in milliseconds."""
    timings: List[float] = []
    cursor = conn.cursor()
    
    # Warm-up run
    cursor.execute(query, params)
    cursor.fetchall()
    
    for _ in range(iterations):
        t0 = time.perf_counter()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        t1 = time.perf_counter()
        timings.append((t1 - t0) * 1000.0)  # ms
        
    return {
        "iterations": iterations,
        "rows_returned": len(rows),
        "min_ms": round(min(timings), 3),
        "median_ms": round(statistics.median(timings), 3),
        "mean_ms": round(statistics.mean(timings), 3),
        "max_ms": round(max(timings), 3)
    }


def run_all_benchmarks() -> Dict[str, Any]:
    print("=" * 70)
    print(" FulfillSmart SQLite Database Performance Benchmark")
    print(" Database: E:\\FulfillSmart\\storage\\fulfillsmart.db")
    print("=" * 70)
    
    results = {}
    with get_db() as conn:
        # 1. 50-row Paginated Orders (Status + Priority Filter, Chronological Sort)
        q1 = """
        SELECT order_id, customer_id, order_time, destination_city, requested_service, order_priority, order_status, order_total_inr
        FROM orders
        WHERE order_status = 'CREATED' AND order_priority = 'NORMAL'
        ORDER BY order_time DESC
        LIMIT 50 OFFSET 0;
        """
        results["Q1_paginated_orders_filtered"] = run_timed_query(conn, q1, iterations=25)
        
        # 2. Paginated Orders with Date Range Filter
        q2 = """
        SELECT order_id, customer_id, order_time, destination_zone_id, requested_service, order_total_inr
        FROM orders
        WHERE order_time BETWEEN '2026-05-01T00:00:00+05:30' AND '2026-05-31T23:59:59+05:30'
        ORDER BY order_time ASC
        LIMIT 50 OFFSET 100;
        """
        results["Q2_paginated_orders_date_range"] = run_timed_query(conn, q2, iterations=25)
        
        # 3. Deep Order Detail Join (Order + Lines + SKUs + Allocation + Promise + Shipments)
        q3 = """
        SELECT o.order_id, o.customer_id, o.order_time, o.requested_service,
               l.order_line_id, l.sku_id, s.sku_name, l.quantity, l.unit_price_inr,
               a.node_id, a.allocated_qty,
               p.carrier_id, p.promised_delivery_date,
               shp.shipment_id, shp.shipment_status, shp.is_delayed
        FROM orders o
        JOIN order_lines l ON o.order_id = l.order_id
        JOIN skus s ON l.sku_id = s.sku_id
        LEFT JOIN allocation_decisions a ON l.order_line_id = a.order_line_id
        LEFT JOIN delivery_promises p ON o.order_id = p.order_id
        LEFT JOIN shipments shp ON o.order_id = shp.order_id
        WHERE o.order_id = 'ORD-2026-019142';
        """
        results["Q3_deep_order_detail_join"] = run_timed_query(conn, q3, iterations=25)
        
        # 4. Tracking Event Timeline Lookup for a Shipment
        q4 = """
        SELECT tracking_event_id, event_sequence, event_type, event_timestamp, event_location, event_description
        FROM tracking_events
        WHERE shipment_id = 'SHP-00000001'
        ORDER BY event_sequence ASC;
        """
        results["Q4_shipment_tracking_timeline"] = run_timed_query(conn, q4, iterations=25)
        
        # 5. Warehouse Inventory Level Lookup
        q5 = """
        SELECT i.sku_id, s.sku_name, s.category, i.on_hand_qty, i.reserved_qty, i.available_qty
        FROM inventory i
        JOIN skus s ON i.sku_id = s.sku_id
        WHERE i.node_id = 'FUL-2026-000001' AND i.available_qty > 0
        ORDER BY i.available_qty DESC
        LIMIT 100;
        """
        results["Q5_warehouse_inventory_lookup"] = run_timed_query(conn, q5, iterations=25)
        
        # 6. Carrier Shipment Performance Aggregation across all 49,436 shipments
        q6 = """
        SELECT carrier_id,
               COUNT(*) AS total_shipments,
               SUM(is_delayed) AS delayed_count,
               ROUND(AVG(delay_days), 3) AS avg_delay_days,
               ROUND((1.0 - CAST(SUM(is_delayed) AS REAL) / COUNT(*)) * 100, 2) AS on_time_rate_pct
        FROM shipments
        GROUP BY carrier_id;
        """
        results["Q6_carrier_shipments_aggregation"] = run_timed_query(conn, q6, iterations=15)

    print(f"\n{'Query Name':<38} | {'Rows':<5} | {'Min (ms)':<9} | {'Median (ms)':<12} | {'Mean (ms)':<10}")
    print("-" * 85)
    for q_name, stats in results.items():
        print(f"{q_name:<38} | {stats['rows_returned']:<5} | {stats['min_ms']:<9.3f} | {stats['median_ms']:<12.3f} | {stats['mean_ms']:<10.3f}")
    print("=" * 85)
    
    return results


if __name__ == "__main__":
    run_all_benchmarks()
