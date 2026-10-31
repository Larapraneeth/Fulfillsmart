r"""
FulfillSmart High-Performance CSV Data Loader & Hash-Verified Ingestion Engine
Loads 29 historical CSV files into SQLite database at E:\FulfillSmart\storage\fulfillsmart.db.
Provides idempotency, SHA-256 integrity verification, and batch execution.
"""
import csv
import hashlib
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple, Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.config import settings, ROOT_DIR
from src.db import get_db, initialize_schema

# Explicit, programmatically verified mapping of all 29 historical CSV files
CSV_MAPPINGS: List[Dict[str, Any]] = [
    # Master Data (10 files)
    {
        "table": "skus",
        "path": "data/master/skus.csv",
        "columns": ["sku_id", "sku_name", "category", "unit_weight_kg", "unit_length_cm", "unit_width_cm", "unit_height_cm", "unit_price_inr", "is_active"],
        "types": [str, str, str, float, float, float, float, float, lambda x: 1 if str(x).lower() == "true" else 0]
    },
    {
        "table": "fulfillment_nodes",
        "path": "data/master/fulfillment_nodes.csv",
        "columns": ["node_id", "node_name", "city", "state", "node_pincode", "node_type", "latitude", "longitude", "is_active", "timezone"],
        "types": [str, str, str, str, str, str, float, float, lambda x: 1 if str(x).lower() == "true" else 0, str]
    },
    {
        "table": "delivery_zones",
        "path": "data/master/delivery_zones.csv",
        "columns": ["delivery_zone_id", "zone_name", "city", "state", "region", "synthetic_pincode", "distance_band", "is_active"],
        "types": [str, str, str, str, str, str, str, lambda x: 1 if str(x).lower() == "true" else 0]
    },
    {
        "table": "inventory",
        "path": "data/master/inventory.csv",
        "columns": ["inventory_id", "node_id", "sku_id", "on_hand_qty", "reserved_qty", "available_qty", "inventory_updated_at"],
        "types": [str, str, str, int, int, int, str]
    },
    {
        "table": "carriers",
        "path": "data/master/carriers.csv",
        "columns": ["carrier_id", "carrier_name", "carrier_type", "supports_reverse_logistics", "is_active"],
        "types": [str, str, str, lambda x: 1 if str(x).lower() == "true" else 0, lambda x: 1 if str(x).lower() == "true" else 0]
    },
    {
        "table": "service_levels",
        "path": "data/master/service_levels.csv",
        "columns": ["service_level_id", "carrier_id", "service_code", "service_name", "nominal_transit_days", "priority_rank", "max_weight_kg", "is_active"],
        "types": [str, str, str, str, int, int, float, lambda x: 1 if str(x).lower() == "true" else 0]
    },
    {
        "table": "carrier_service_zones",
        "path": "data/master/carrier_service_zones.csv",
        "columns": ["carrier_service_zone_id", "carrier_id", "delivery_zone_id", "standard_available", "express_available", "same_day_available"],
        "types": [str, str, str, lambda x: 1 if str(x).lower() == "true" else 0, lambda x: 1 if str(x).lower() == "true" else 0, lambda x: 1 if str(x).lower() == "true" else 0]
    },
    {
        "table": "warehouse_capacity",
        "path": "data/master/warehouse_capacity.csv",
        "columns": ["capacity_id", "node_id", "capacity_date", "max_orders", "max_units", "allocated_orders", "allocated_units"],
        "types": [str, str, str, int, int, int, int]
    },
    {
        "table": "carrier_calendar",
        "path": "data/master/carrier_calendar.csv",
        "columns": ["carrier_calendar_id", "carrier_id", "calendar_date", "is_operating_day", "pickup_cutoff_time", "dispatch_window_start", "dispatch_window_end"],
        "types": [str, str, str, lambda x: 1 if str(x).lower() == "true" else 0, str, str, str]
    },
    {
        "table": "holidays",
        "path": "data/master/holidays.csv",
        "columns": ["holiday_id", "holiday_date", "holiday_name", "state_scope", "is_working_day", "calendar_type"],
        "types": [str, str, str, str, lambda x: 1 if str(x).lower() == "true" else 0, str]
    },
    
    # Transactions (2 files)
    {
        "table": "orders",
        "path": "data/transactions/orders.csv",
        "columns": ["order_id", "customer_id", "order_time", "destination_zone_id", "destination_pincode", "destination_city", "destination_state", "requested_service", "order_channel", "order_priority", "order_status", "order_total_inr"],
        "types": [str, str, str, str, str, str, str, str, str, str, str, float]
    },
    {
        "table": "order_lines",
        "path": "data/transactions/order_lines.csv",
        "columns": ["order_line_id", "order_id", "line_number", "sku_id", "quantity", "unit_price_inr", "line_total_inr"],
        "types": [str, str, int, str, int, float, float]
    },

    # Events (1 file)
    {
        "table": "tracking_events",
        "path": "data/events/tracking_events.csv",
        "columns": ["tracking_event_id", "shipment_id", "order_id", "event_sequence", "event_type", "event_timestamp", "event_location", "event_description"],
        "types": [str, str, str, int, str, str, str, str]
    },

    # Allocations (4 files)
    {
        "table": "allocation_decisions",
        "path": "outputs/allocations/allocation_decisions.csv",
        "columns": ["allocation_id", "order_id", "order_line_id", "node_id", "sku_id", "allocated_qty", "allocation_date", "allocation_type"],
        "types": [str, str, str, str, str, int, str, str]
    },
    {
        "table": "order_allocation_summary",
        "path": "outputs/allocations/order_allocation_summary.csv",
        "columns": ["order_id", "allocation_status", "allocation_type", "allocated_node_count", "total_units"],
        "types": [str, str, str, int, int]
    },
    {
        "table": "capacity_usage",
        "path": "outputs/allocations/capacity_usage.csv",
        "columns": ["node_id", "capacity_date", "allocated_orders", "allocated_units", "max_orders", "max_units"],
        "types": [str, str, int, int, int, int]
    },
    {
        "table": "allocation_exceptions",
        "path": "outputs/allocations/allocation_exceptions.csv",
        "columns": ["order_id", "exception_code", "exception_detail", "destination_zone_id", "order_date"],
        "types": [str, str, str, str, str]
    },

    # Carriers (1 file)
    {
        "table": "carrier_selection",
        "path": "outputs/carriers/carrier_selection.csv",
        "columns": ["carrier_selection_id", "order_id", "node_id", "delivery_zone_id", "carrier_id", "carrier_name", "service_level_id", "selected_service", "allocation_date", "dispatch_date", "pickup_cutoff_time", "allocated_line_count", "allocated_unit_count"],
        "types": [str, str, str, str, str, str, str, str, str, str, str, int, int]
    },

    # Promises (2 files)
    {
        "table": "delivery_promises",
        "path": "outputs/promises/delivery_promises.csv",
        "columns": ["delivery_promise_id", "order_id", "node_id", "carrier_id", "service_level_id", "requested_service", "dispatch_date", "promised_delivery_date", "promise_version", "promise_status", "transit_business_days"],
        "types": [str, str, str, str, str, str, str, str, int, str, int]
    },
    {
        "table": "promise_exceptions",
        "path": "outputs/promises/promise_exceptions.csv",
        "columns": ["order_id", "node_id", "delivery_zone_id", "requested_service", "exception_code", "exception_detail"],
        "types": [str, str, str, str, str, str]
    },

    # Shipments (1 file)
    {
        "table": "shipments",
        "path": "outputs/shipments/shipments.csv",
        "columns": ["shipment_id", "order_id", "node_id", "carrier_id", "service_level_id", "delivery_promise_id", "dispatch_date", "promised_delivery_date", "actual_delivery_date", "shipment_status", "is_delayed", "delay_days", "package_line_count", "package_unit_count"],
        "types": [str, str, str, str, str, str, str, str, str, str, lambda x: 1 if str(x).lower() == "true" else 0, int, int, int]
    },

    # Reports (8 CSV files)
    {
        "table": "delivery_outcomes",
        "path": "outputs/reports/delivery_outcomes.csv",
        "columns": ["order_id", "order_time", "requested_service", "allocated_node_groups", "shipment_count", "delivered_shipment_count", "latest_actual_delivery_date", "latest_promised_delivery_date", "delayed_shipment_count", "delivery_outcome_status", "delivery_completed", "delivery_on_time"],
        "types": [str, str, str, int, int, int, str, str, int, str, lambda x: 1 if str(x).lower() == "true" else 0, lambda x: 1 if str(x).lower() == "true" else 0]
    },
    {
        "table": "carrier_performance",
        "path": "outputs/reports/carrier_performance.csv",
        "columns": ["carrier_id", "carrier_name", "shipment_count", "delayed_shipments", "average_delay_days", "median_delay_days", "on_time_rate_pct", "delay_rate_pct"],
        "types": [str, str, int, int, float, float, float, float]
    },
    {
        "table": "warehouse_utilization",
        "path": "outputs/reports/warehouse_utilization.csv",
        "columns": ["node_id", "active_node_days", "allocated_orders", "allocated_units", "order_capacity", "unit_capacity", "node_name", "city", "state", "order_utilization_pct", "unit_utilization_pct"],
        "types": [str, int, int, int, int, int, str, str, str, float, float]
    },
    {
        "table": "service_level_performance",
        "path": "outputs/reports/service_level_performance.csv",
        "columns": ["service_level_id", "shipment_count", "delayed_shipments", "average_delay_days", "on_time_rate_pct"],
        "types": [str, int, int, float, float]
    },
    {
        "table": "monthly_delivery_trend",
        "path": "outputs/reports/monthly_delivery_trend.csv",
        "columns": ["month", "orders", "on_time_orders", "completed_orders", "late_orders", "carrier_unavailable_orders", "on_time_rate_all_orders_pct", "completion_rate_pct"],
        "types": [str, int, int, int, int, int, float, float]
    },
    {
        "table": "anomaly_label_distribution",
        "path": "outputs/reports/anomaly_label_distribution.csv",
        "columns": ["anomaly_type", "severity", "split", "case_count"],
        "types": [str, str, str, int]
    },
    {
        "table": "shipment_exceptions",
        "path": "outputs/reports/shipment_exceptions.csv",
        "columns": ["order_id", "node_id", "exception_code", "exception_detail"],
        "types": [str, str, str, str]
    },
    {
        "table": "kpi_summary",
        "path": "outputs/reports/kpi_summary.csv",
        "columns": ["metric", "value", "unit", "definition"],
        "types": [str, float, str, str]
    }
]


def calculate_sha256(filepath: Path) -> str:
    """Compute SHA-256 hash of a file."""
    sha = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            sha.update(chunk)
    return sha.hexdigest()


def get_historical_csv_hashes() -> Dict[str, str]:
    """Return dictionary of relative_path -> sha256_hash for all 29 historical CSVs."""
    hashes = {}
    for mapping in CSV_MAPPINGS:
        rel_path = mapping["path"]
        abs_path = ROOT_DIR / rel_path
        if abs_path.exists():
            hashes[rel_path] = calculate_sha256(abs_path)
    return hashes


def parse_row(row: Dict[str, str], columns: List[str], types: List[Any]) -> Tuple:
    """Parse CSV row strings into typed tuples with error handling."""
    parsed = []
    for col, type_fn in zip(columns, types):
        val = row.get(col, "")
        if val is None or val == "":
            parsed.append(None)
        else:
            try:
                parsed.append(type_fn(val))
            except Exception:
                parsed.append(val)
    return tuple(parsed)


def ingest_file(conn: sqlite3.Connection, mapping: Dict[str, Any], force_refresh: bool = False) -> Dict[str, Any]:
    """Ingest a single CSV file idempotently using hash verification."""
    table = mapping["table"]
    rel_path = mapping["path"]
    abs_path = ROOT_DIR / rel_path
    columns = mapping["columns"]
    types = mapping["types"]

    if not abs_path.exists():
        return {"table": table, "status": "SKIPPED_MISSING", "rows": 0}

    current_hash = calculate_sha256(abs_path)
    file_name = abs_path.name

    cursor = conn.cursor()
    cursor.execute("SELECT sha256_hash, row_count FROM ingestion_metadata WHERE file_name = ?", (file_name,))
    meta = cursor.fetchone()

    if meta and not force_refresh:
        recorded_hash, recorded_rows = meta["sha256_hash"], meta["row_count"]
        if recorded_hash == current_hash:
            return {"table": table, "status": "UP_TO_DATE", "rows": recorded_rows, "sha256": current_hash}

    # Ingestion required
    batch_size = 10000
    rows_batch = []
    total_rows = 0

    placeholders = ",".join(["?"] * len(columns))
    insert_sql = f"INSERT OR REPLACE INTO {table} ({','.join(columns)}) VALUES ({placeholders})"

    # Truncate table before reloading if refreshing
    cursor.execute(f"DELETE FROM {table}")

    with open(abs_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            parsed = parse_row(row, columns, types)
            rows_batch.append(parsed)
            total_rows += 1

            if len(rows_batch) >= batch_size:
                cursor.executemany(insert_sql, rows_batch)
                rows_batch.clear()

        if rows_batch:
            cursor.executemany(insert_sql, rows_batch)
            rows_batch.clear()

    # Record in ingestion metadata
    now_iso = datetime.now(timezone.utc).isoformat()
    cursor.execute("""
    INSERT OR REPLACE INTO ingestion_metadata (file_name, relative_path, sha256_hash, row_count, ingested_at)
    VALUES (?, ?, ?, ?, ?)
    """, (file_name, rel_path, current_hash, total_rows, now_iso))

    conn.commit()
    return {"table": table, "status": "INGESTED", "rows": total_rows, "sha256": current_hash}


def load_all_historical_data(force_refresh: bool = False) -> Dict[str, Any]:
    """Ingest all 29 historical CSV files into fulfillsmart.db."""
    results = []
    with get_db() as conn:
        initialize_schema(conn)
        conn.execute("PRAGMA foreign_keys = OFF;")
        for mapping in CSV_MAPPINGS:
            res = ingest_file(conn, mapping, force_refresh=force_refresh)
            results.append(res)
        conn.execute("PRAGMA foreign_keys = ON;")
        fk_violations = conn.execute("PRAGMA foreign_key_check;").fetchall()
        if fk_violations:
            print(f"WARNING: Found {len(fk_violations)} foreign key violations during validation!")
    
    total_ingested = sum(r["rows"] for r in results)
    return {
        "status": "COMPLETED",
        "csv_count": len(CSV_MAPPINGS),
        "total_records": total_ingested,
        "details": results
    }


if __name__ == "__main__":
    refresh = "--refresh" in sys.argv
    print(f"Starting FulfillSmart Ingestion (force_refresh={refresh})...")
    res = load_all_historical_data(force_refresh=refresh)
    print(f"Ingestion finished: {res['csv_count']} CSVs processed, total rows: {res['total_records']}")
    for d in res["details"]:
        print(f"  [{d['status']}] {d['table']}: {d['rows']} rows (sha: {d.get('sha256', '')[:12]}...)")
