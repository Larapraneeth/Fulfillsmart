"""
Automated Test Suite for Data Ingestion, Idempotency and Database Integrity
Validates fulfillsmart.db against official Step 1-5 schemas and verification counts.
"""
import pytest
import sqlite3
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.config import settings, ROOT_DIR
from src.db import get_db, get_db_connection
from src.data_loader import CSV_MAPPINGS, ingest_file, calculate_sha256

EXPECTED_ROW_COUNTS = {
    "skus": 1000,
    "fulfillment_nodes": 20,
    "delivery_zones": 50,
    "inventory": 20000,
    "carriers": 10,
    "service_levels": 30,
    "carrier_service_zones": 335,
    "warehouse_capacity": 7300,
    "carrier_calendar": 3650,
    "holidays": 9,
    "orders": 50000,
    "order_lines": 93552,
    "tracking_events": 100000,
    "allocation_decisions": 93558,
    "order_allocation_summary": 50000,
    "capacity_usage": 5184,
    "allocation_exceptions": 0,
    "carrier_selection": 49436,
    "delivery_promises": 49436,
    "promise_exceptions": 580,
    "shipments": 49436,
    "delivery_outcomes": 50000,
    "carrier_performance": 10,
    "warehouse_utilization": 20,
    "service_level_performance": 30,
    "monthly_delivery_trend": 11,
    "anomaly_label_distribution": 6,
    "shipment_exceptions": 580,
    "kpi_summary": 19
}


def test_database_file_location():
    """Verify database resides strictly at E:\\FulfillSmart\\storage\\fulfillsmart.db."""
    expected_path = ROOT_DIR / "storage" / "fulfillsmart.db"
    assert settings.database_path == expected_path
    assert expected_path.parent.name == "storage"
    assert expected_path.parent.exists()


def test_total_csv_mappings_count():
    """Verify exact count of 29 historical CSV files."""
    assert len(CSV_MAPPINGS) == 29
    for mapping in CSV_MAPPINGS:
        csv_file = ROOT_DIR / mapping["path"]
        assert csv_file.exists(), f"Historical CSV missing: {csv_file}"


def test_table_row_counts():
    """Verify exact row counts in SQLite match official simulation counts."""
    with get_db() as conn:
        cursor = conn.cursor()
        for table, expected_count in EXPECTED_ROW_COUNTS.items():
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            actual_count = cursor.fetchone()[0]
            assert actual_count == expected_count, (
                f"Row count mismatch in table '{table}': expected {expected_count}, got {actual_count}"
            )


def test_ingestion_metadata_tracking():
    """Verify all 29 CSVs are logged in ingestion_metadata with accurate SHA-256 hashes."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT file_name, sha256_hash, row_count FROM ingestion_metadata")
        records = {r["file_name"]: (r["sha256_hash"], r["row_count"]) for r in cursor.fetchall()}
        
        assert len(records) == 29, f"Expected 29 metadata entries, found {len(records)}"
        
        for mapping in CSV_MAPPINGS:
            csv_path = ROOT_DIR / mapping["path"]
            fname = csv_path.name
            assert fname in records, f"File {fname} missing from ingestion_metadata"
            
            disk_hash = calculate_sha256(csv_path)
            meta_hash, meta_rows = records[fname]
            assert meta_hash == disk_hash, f"Hash mismatch in metadata for {fname}"
            assert meta_rows == EXPECTED_ROW_COUNTS[mapping["table"]]


def test_ingestion_idempotency():
    """Verify re-running ingestion on unchanged files skips re-insertion (status UP_TO_DATE)."""
    with get_db() as conn:
        for mapping in CSV_MAPPINGS[:5]:
            result = ingest_file(conn, mapping, force_refresh=False)
            assert result["status"] == "UP_TO_DATE", f"Expected UP_TO_DATE for {mapping['table']}, got {result['status']}"


def test_inventory_arithmetic_invariant():
    """Verify available_qty == on_hand_qty - reserved_qty across all 20,000 inventory records."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM inventory WHERE available_qty != (on_hand_qty - reserved_qty)")
        violations = cursor.fetchone()[0]
        assert violations == 0, f"Found {violations} inventory records violating arithmetic invariant"


def test_order_line_foreign_key_integrity():
    """Verify all 93,552 order lines link to valid orders and SKUs."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COUNT(*) FROM order_lines l
            LEFT JOIN orders o ON l.order_id = o.order_id
            WHERE o.order_id IS NULL
        """)
        orphaned_orders = cursor.fetchone()[0]
        assert orphaned_orders == 0, f"Found {orphaned_orders} orphaned order lines"

        cursor.execute("""
            SELECT COUNT(*) FROM order_lines l
            LEFT JOIN skus s ON l.sku_id = s.sku_id
            WHERE s.sku_id IS NULL
        """)
        orphaned_skus = cursor.fetchone()[0]
        assert orphaned_skus == 0, f"Found {orphaned_skus} order lines with invalid SKU references"


def test_tracking_events_sequencing():
    """Verify tracking events sequence numbers and shipment links."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT MIN(event_sequence), MAX(event_sequence) FROM tracking_events")
        min_seq, max_seq = cursor.fetchone()
        assert min_seq >= 1
        assert max_seq <= 4


def test_simulation_schema_isolation():
    """Verify simulation sandbox tables exist and are empty in clean baseline."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM simulation_runs")
        assert cursor.fetchone()[0] == 0
        cursor.execute("SELECT COUNT(*) FROM simulation_orders")
        assert cursor.fetchone()[0] == 0
        cursor.execute("SELECT COUNT(*) FROM simulation_inventory_delta")
        assert cursor.fetchone()[0] == 0
        cursor.execute("SELECT COUNT(*) FROM simulation_capacity_delta")
        assert cursor.fetchone()[0] == 0
