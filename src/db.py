r"""
FulfillSmart Database Access & Schema Management Module
Database location: E:\FulfillSmart\storage\fulfillsmart.db
Configured with WAL mode, foreign keys, and optimized composite indexes.
"""
import sqlite3
from pathlib import Path
from typing import Generator
from contextlib import contextmanager
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.config import settings

DB_PATH = settings.database_path


def get_db_connection() -> sqlite3.Connection:
    """Create an optimized SQLite connection with configured pragmas."""
    settings.ensure_directories()
    conn = sqlite3.connect(str(DB_PATH), timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute(f"PRAGMA cache_size = -{settings.cache_size_mb * 1000};")
    conn.execute("PRAGMA temp_store = MEMORY;")
    return conn


@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    """Context manager for synchronous Python code (`with get_db() as conn:`).
    All engine and service code should use this form.
    """
    conn = get_db_connection()
    try:
        yield conn
    finally:
        conn.close()


# Backward compatible alias for legacy code
get_db_context = get_db


def get_db_dep() -> Generator[sqlite3.Connection, None, None]:
    """Plain generator function for use as a FastAPI Depends() dependency.
    Must NOT be decorated with @contextmanager — FastAPI drives the generator directly.
    """
    conn = get_db_connection()
    try:
        yield conn
    finally:
        conn.close()




def initialize_schema(conn: sqlite3.Connection) -> None:
    """Create all required tables, constraints, and indexes."""
    cursor = conn.cursor()
    
    # Ingestion metadata tracking table for idempotent loading and hash verification
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ingestion_metadata (
        file_name TEXT PRIMARY KEY,
        relative_path TEXT NOT NULL,
        sha256_hash TEXT NOT NULL,
        row_count INTEGER NOT NULL,
        ingested_at TEXT NOT NULL
    );
    """)

    # 1. Master Tables
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS skus (
        sku_id TEXT PRIMARY KEY,
        sku_name TEXT NOT NULL,
        category TEXT NOT NULL,
        unit_weight_kg REAL NOT NULL,
        unit_length_cm REAL NOT NULL,
        unit_width_cm REAL NOT NULL,
        unit_height_cm REAL NOT NULL,
        unit_price_inr REAL NOT NULL,
        is_active INTEGER NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS fulfillment_nodes (
        node_id TEXT PRIMARY KEY,
        node_name TEXT NOT NULL,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        node_pincode TEXT NOT NULL,
        node_type TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        is_active INTEGER NOT NULL,
        timezone TEXT NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS delivery_zones (
        delivery_zone_id TEXT PRIMARY KEY,
        zone_name TEXT NOT NULL,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        region TEXT NOT NULL,
        synthetic_pincode TEXT NOT NULL,
        distance_band TEXT NOT NULL,
        is_active INTEGER NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS inventory (
        inventory_id TEXT PRIMARY KEY,
        node_id TEXT NOT NULL,
        sku_id TEXT NOT NULL,
        on_hand_qty INTEGER NOT NULL,
        reserved_qty INTEGER NOT NULL,
        available_qty INTEGER NOT NULL,
        inventory_updated_at TEXT NOT NULL,
        FOREIGN KEY (node_id) REFERENCES fulfillment_nodes(node_id),
        FOREIGN KEY (sku_id) REFERENCES skus(sku_id),
        UNIQUE(node_id, sku_id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS carriers (
        carrier_id TEXT PRIMARY KEY,
        carrier_name TEXT NOT NULL,
        carrier_type TEXT NOT NULL,
        supports_reverse_logistics INTEGER NOT NULL,
        is_active INTEGER NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS service_levels (
        service_level_id TEXT PRIMARY KEY,
        carrier_id TEXT NOT NULL,
        service_code TEXT NOT NULL,
        service_name TEXT NOT NULL,
        nominal_transit_days INTEGER NOT NULL,
        priority_rank INTEGER NOT NULL,
        max_weight_kg REAL NOT NULL,
        is_active INTEGER NOT NULL,
        FOREIGN KEY (carrier_id) REFERENCES carriers(carrier_id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS carrier_service_zones (
        carrier_service_zone_id TEXT PRIMARY KEY,
        carrier_id TEXT NOT NULL,
        delivery_zone_id TEXT NOT NULL,
        standard_available INTEGER NOT NULL,
        express_available INTEGER NOT NULL,
        same_day_available INTEGER NOT NULL,
        FOREIGN KEY (carrier_id) REFERENCES carriers(carrier_id),
        FOREIGN KEY (delivery_zone_id) REFERENCES delivery_zones(delivery_zone_id),
        UNIQUE(carrier_id, delivery_zone_id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS warehouse_capacity (
        capacity_id TEXT PRIMARY KEY,
        node_id TEXT NOT NULL,
        capacity_date TEXT NOT NULL,
        max_orders INTEGER NOT NULL,
        max_units INTEGER NOT NULL,
        allocated_orders INTEGER NOT NULL,
        allocated_units INTEGER NOT NULL,
        FOREIGN KEY (node_id) REFERENCES fulfillment_nodes(node_id),
        UNIQUE(node_id, capacity_date)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS carrier_calendar (
        carrier_calendar_id TEXT PRIMARY KEY,
        carrier_id TEXT NOT NULL,
        calendar_date TEXT NOT NULL,
        is_operating_day INTEGER NOT NULL,
        pickup_cutoff_time TEXT NOT NULL,
        dispatch_window_start TEXT NOT NULL,
        dispatch_window_end TEXT NOT NULL,
        FOREIGN KEY (carrier_id) REFERENCES carriers(carrier_id),
        UNIQUE(carrier_id, calendar_date)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS holidays (
        holiday_id TEXT PRIMARY KEY,
        holiday_date TEXT NOT NULL,
        holiday_name TEXT NOT NULL,
        state_scope TEXT NOT NULL,
        is_working_day INTEGER NOT NULL,
        calendar_type TEXT NOT NULL
    );
    """)

    # 2. Transaction Tables
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        order_id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        order_time TEXT NOT NULL,
        destination_zone_id TEXT NOT NULL,
        destination_pincode TEXT NOT NULL,
        destination_city TEXT NOT NULL,
        destination_state TEXT NOT NULL,
        requested_service TEXT NOT NULL,
        order_channel TEXT NOT NULL,
        order_priority TEXT NOT NULL,
        order_status TEXT NOT NULL,
        order_total_inr REAL NOT NULL,
        FOREIGN KEY (destination_zone_id) REFERENCES delivery_zones(delivery_zone_id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS order_lines (
        order_line_id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        line_number INTEGER NOT NULL,
        sku_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price_inr REAL NOT NULL,
        line_total_inr REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(order_id),
        FOREIGN KEY (sku_id) REFERENCES skus(sku_id)
    );
    """)

    # 3. Events Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tracking_events (
        tracking_event_id TEXT PRIMARY KEY,
        shipment_id TEXT NOT NULL,
        order_id TEXT NOT NULL,
        event_sequence INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        event_timestamp TEXT NOT NULL,
        event_location TEXT NOT NULL,
        event_description TEXT NOT NULL
    );
    """)

    # 4. Allocation Output Tables
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS allocation_decisions (
        allocation_id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        order_line_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        sku_id TEXT NOT NULL,
        allocated_qty INTEGER NOT NULL,
        allocation_date TEXT NOT NULL,
        allocation_type TEXT NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(order_id),
        FOREIGN KEY (order_line_id) REFERENCES order_lines(order_line_id),
        FOREIGN KEY (node_id) REFERENCES fulfillment_nodes(node_id),
        FOREIGN KEY (sku_id) REFERENCES skus(sku_id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS order_allocation_summary (
        order_id TEXT PRIMARY KEY,
        allocation_status TEXT NOT NULL,
        allocation_type TEXT NOT NULL,
        allocated_node_count INTEGER NOT NULL,
        total_units INTEGER NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(order_id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS capacity_usage (
        node_id TEXT NOT NULL,
        capacity_date TEXT NOT NULL,
        allocated_orders INTEGER NOT NULL,
        allocated_units INTEGER NOT NULL,
        max_orders INTEGER NOT NULL,
        max_units INTEGER NOT NULL,
        PRIMARY KEY (node_id, capacity_date),
        FOREIGN KEY (node_id) REFERENCES fulfillment_nodes(node_id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS allocation_exceptions (
        order_id TEXT NOT NULL,
        exception_code TEXT NOT NULL,
        exception_detail TEXT NOT NULL,
        destination_zone_id TEXT NOT NULL,
        order_date TEXT NOT NULL
    );
    """)

    # 5. Carrier & Promise Output Tables
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS carrier_selection (
        carrier_selection_id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        delivery_zone_id TEXT NOT NULL,
        carrier_id TEXT NOT NULL,
        carrier_name TEXT NOT NULL,
        service_level_id TEXT NOT NULL,
        selected_service TEXT NOT NULL,
        allocation_date TEXT NOT NULL,
        dispatch_date TEXT NOT NULL,
        pickup_cutoff_time TEXT NOT NULL,
        allocated_line_count INTEGER NOT NULL,
        allocated_unit_count INTEGER NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(order_id),
        FOREIGN KEY (node_id) REFERENCES fulfillment_nodes(node_id),
        FOREIGN KEY (delivery_zone_id) REFERENCES delivery_zones(delivery_zone_id),
        FOREIGN KEY (carrier_id) REFERENCES carriers(carrier_id),
        FOREIGN KEY (service_level_id) REFERENCES service_levels(service_level_id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS delivery_promises (
        delivery_promise_id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        carrier_id TEXT NOT NULL,
        service_level_id TEXT NOT NULL,
        requested_service TEXT NOT NULL,
        dispatch_date TEXT NOT NULL,
        promised_delivery_date TEXT NOT NULL,
        promise_version INTEGER NOT NULL,
        promise_status TEXT NOT NULL,
        transit_business_days INTEGER NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(order_id),
        FOREIGN KEY (node_id) REFERENCES fulfillment_nodes(node_id),
        FOREIGN KEY (carrier_id) REFERENCES carriers(carrier_id),
        FOREIGN KEY (service_level_id) REFERENCES service_levels(service_level_id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS promise_exceptions (
        order_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        delivery_zone_id TEXT NOT NULL,
        requested_service TEXT NOT NULL,
        exception_code TEXT NOT NULL,
        exception_detail TEXT NOT NULL
    );
    """)

    # 6. Shipment Output Tables
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS shipments (
        shipment_id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        carrier_id TEXT NOT NULL,
        service_level_id TEXT NOT NULL,
        delivery_promise_id TEXT NOT NULL,
        dispatch_date TEXT NOT NULL,
        promised_delivery_date TEXT NOT NULL,
        actual_delivery_date TEXT NOT NULL,
        shipment_status TEXT NOT NULL,
        is_delayed INTEGER NOT NULL,
        delay_days INTEGER NOT NULL,
        package_line_count INTEGER NOT NULL,
        package_unit_count INTEGER NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(order_id),
        FOREIGN KEY (node_id) REFERENCES fulfillment_nodes(node_id),
        FOREIGN KEY (carrier_id) REFERENCES carriers(carrier_id),
        FOREIGN KEY (service_level_id) REFERENCES service_levels(service_level_id),
        FOREIGN KEY (delivery_promise_id) REFERENCES delivery_promises(delivery_promise_id)
    );
    """)

    # 7. Report Tables
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS delivery_outcomes (
        order_id TEXT PRIMARY KEY,
        order_time TEXT NOT NULL,
        requested_service TEXT NOT NULL,
        allocated_node_groups INTEGER NOT NULL,
        shipment_count INTEGER NOT NULL,
        delivered_shipment_count INTEGER NOT NULL,
        latest_actual_delivery_date TEXT,
        latest_promised_delivery_date TEXT,
        delayed_shipment_count INTEGER NOT NULL,
        delivery_outcome_status TEXT NOT NULL,
        delivery_completed INTEGER NOT NULL,
        delivery_on_time INTEGER,
        FOREIGN KEY (order_id) REFERENCES orders(order_id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS carrier_performance (
        carrier_id TEXT PRIMARY KEY,
        carrier_name TEXT NOT NULL,
        shipment_count INTEGER NOT NULL,
        delayed_shipments INTEGER NOT NULL,
        average_delay_days REAL NOT NULL,
        median_delay_days REAL NOT NULL,
        on_time_rate_pct REAL NOT NULL,
        delay_rate_pct REAL NOT NULL,
        FOREIGN KEY (carrier_id) REFERENCES carriers(carrier_id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS warehouse_utilization (
        node_id TEXT PRIMARY KEY,
        active_node_days INTEGER NOT NULL,
        allocated_orders INTEGER NOT NULL,
        allocated_units INTEGER NOT NULL,
        order_capacity INTEGER NOT NULL,
        unit_capacity INTEGER NOT NULL,
        node_name TEXT NOT NULL,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        order_utilization_pct REAL NOT NULL,
        unit_utilization_pct REAL NOT NULL,
        FOREIGN KEY (node_id) REFERENCES fulfillment_nodes(node_id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS service_level_performance (
        service_level_id TEXT PRIMARY KEY,
        shipment_count INTEGER NOT NULL,
        delayed_shipments INTEGER NOT NULL,
        average_delay_days REAL NOT NULL,
        on_time_rate_pct REAL NOT NULL,
        FOREIGN KEY (service_level_id) REFERENCES service_levels(service_level_id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS monthly_delivery_trend (
        month TEXT PRIMARY KEY,
        orders INTEGER NOT NULL,
        on_time_orders INTEGER NOT NULL,
        completed_orders INTEGER NOT NULL,
        late_orders INTEGER NOT NULL,
        carrier_unavailable_orders INTEGER NOT NULL,
        on_time_rate_all_orders_pct REAL NOT NULL,
        completion_rate_pct REAL NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS anomaly_label_distribution (
        anomaly_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        split TEXT NOT NULL,
        case_count INTEGER NOT NULL,
        PRIMARY KEY (anomaly_type, severity, split)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS shipment_exceptions (
        row_id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        exception_code TEXT NOT NULL,
        exception_detail TEXT NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS kpi_summary (
        metric TEXT PRIMARY KEY,
        value REAL NOT NULL,
        unit TEXT NOT NULL,
        definition TEXT NOT NULL
    );
    """)

    # 8. Simulation Sandbox Tables (Completely separate from historical tables)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS simulation_runs (
        scenario_id TEXT PRIMARY KEY,
        scenario_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        notes TEXT,
        simulated_orders_count INTEGER NOT NULL DEFAULT 0
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS simulation_orders (
        scenario_id TEXT NOT NULL,
        order_id TEXT NOT NULL,
        customer_id TEXT NOT NULL,
        order_time TEXT NOT NULL,
        destination_zone_id TEXT NOT NULL,
        requested_service TEXT NOT NULL,
        order_priority TEXT NOT NULL,
        order_status TEXT NOT NULL,
        order_total_inr REAL NOT NULL,
        PRIMARY KEY (scenario_id, order_id),
        FOREIGN KEY (scenario_id) REFERENCES simulation_runs(scenario_id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS simulation_inventory_delta (
        scenario_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        sku_id TEXT NOT NULL,
        reserved_delta INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (scenario_id, node_id, sku_id),
        FOREIGN KEY (scenario_id) REFERENCES simulation_runs(scenario_id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS simulation_capacity_delta (
        scenario_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        capacity_date TEXT NOT NULL,
        orders_delta INTEGER NOT NULL DEFAULT 0,
        units_delta INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (scenario_id, node_id, capacity_date),
        FOREIGN KEY (scenario_id) REFERENCES simulation_runs(scenario_id)
    );
    """)

    # 9. Performance Indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_status_date ON orders(order_status, order_time);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_zone ON orders(destination_zone_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_priority ON orders(order_priority);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_order_lines_order_id ON order_lines(order_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_order_lines_sku_id ON order_lines(sku_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_inv_node_sku ON inventory(node_id, sku_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cap_node_date ON warehouse_capacity(node_id, capacity_date);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tracking_shipment_seq ON tracking_events(shipment_id, event_sequence);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tracking_order_id ON tracking_events(order_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON shipments(order_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_shipments_node_id ON shipments(node_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_shipments_carrier_id ON shipments(carrier_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_allocations_order_id ON allocation_decisions(order_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_carrier_sel_order_id ON carrier_selection(order_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_promises_order_id ON delivery_promises(order_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_outcomes_order_id ON delivery_outcomes(order_id);")

    conn.commit()
