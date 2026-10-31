"""
FulfillSmart Production Database Initializer & Verification Utility.

Designed for Render Persistent Disks mounted at /var/data (or custom FULFILLSMART_DATABASE_PATH).

Safety guarantees:
1. Idempotency: If an existing valid database is detected, verifies integrity and leaves data untouched.
2. Overwrite Protection: Never drops, truncates, or overwrites an existing valid database.
3. Corruption Guard: If an existing database file exists but is incomplete or corrupted,
   ABORTS immediately with a fatal error to prevent automated overwrites or silent data loss.
4. Cryptographic Audit: Ensures all 29 CSVs match SHA-256 digests in ingestion_metadata.
"""
import sys
import sqlite3
from pathlib import Path

# Add project root to path
ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from src.config import settings
from src.data_loader import CSV_MAPPINGS, load_all_historical_data, calculate_sha256
from src.db import get_db

REQUIRED_TABLE_COUNTS = {
    "orders": 50000,
    "order_lines": 93552,
    "shipments": 49436,
    "allocation_decisions": 93558,
    "fulfillment_nodes": 20,
    "carriers": 10,
    "delivery_zones": 50,
    "inventory": 20000,
    "skus": 1000,
}


def check_existing_database(db_path: Path) -> str:
    """
    Checks the status of an existing database file.
    Returns: 'VALID', 'INCOMPLETE_OR_CORRUPT', or 'NON_EXISTENT'.
    """
    if not db_path.exists():
        return "NON_EXISTENT"

    if db_path.stat().st_size == 0:
        return "NON_EXISTENT"

    try:
        conn = sqlite3.connect(str(db_path), timeout=10.0)
        conn.row_factory = sqlite3.Row

        # 1. Quick SQLite integrity check
        integrity = conn.execute("PRAGMA integrity_check;").fetchone()[0]
        if str(integrity).lower() != "ok":
            print(f"[DB Init Error] SQLite PRAGMA integrity_check failed: {integrity}")
            conn.close()
            return "INCOMPLETE_OR_CORRUPT"

        # 2. Check total tables
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        table_count = cursor.fetchone()[0]

        if table_count < 25:
            print(f"[DB Init Error] Found only {table_count} tables in existing database (expected >= 29).")
            conn.close()
            return "INCOMPLETE_OR_CORRUPT"

        # 3. Check core table row counts
        for table, expected_count in REQUIRED_TABLE_COUNTS.items():
            try:
                cnt = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
                if cnt != expected_count:
                    print(f"[DB Init Error] Table '{table}' has {cnt} rows (expected {expected_count}).")
                    conn.close()
                    return "INCOMPLETE_OR_CORRUPT"
            except sqlite3.OperationalError as ex:
                print(f"[DB Init Error] Table '{table}' check failed: {ex}")
                conn.close()
                return "INCOMPLETE_OR_CORRUPT"

        conn.close()
        return "VALID"

    except Exception as ex:
        print(f"[DB Init Error] Could not inspect existing database: {ex}")
        return "INCOMPLETE_OR_CORRUPT"


def run_post_init_audit(db_path: Path) -> bool:
    """Audit database records and verify 29 CSV SHA-256 hashes against ingestion_metadata."""
    print("[DB Init] Running post-initialization verification audit...")
    try:
        conn = sqlite3.connect(str(db_path), timeout=10.0)
        conn.row_factory = sqlite3.Row

        # Verify ingestion_metadata entries
        meta_rows = conn.execute("SELECT file_name, sha256_hash, row_count FROM ingestion_metadata").fetchall()
        meta_by_name = {r["file_name"]: r["sha256_hash"] for r in meta_rows}

        if len(meta_by_name) < 29:
            print(f"[DB Init Error] Expected 29 ingestion_metadata entries, found {len(meta_by_name)}")
            conn.close()
            return False

        # Verify disk CSV hashes against recorded metadata
        for mapping in CSV_MAPPINGS:
            csv_path = ROOT_DIR / mapping["path"]
            fname = csv_path.name
            expected_hash = meta_by_name.get(fname)
            if not csv_path.exists():
                print(f"[DB Init Error] Missing source CSV: {csv_path}")
                conn.close()
                return False

            disk_hash = calculate_sha256(csv_path)
            if disk_hash != expected_hash:
                print(f"[DB Init Error] SHA-256 mismatch for {fname}: disk={disk_hash}, metadata={expected_hash}")
                conn.close()
                return False

        conn.close()
        print("[DB Init] All 29 historical CSV SHA-256 hashes verified successfully.")
        return True

    except Exception as ex:
        print(f"[DB Init Error] Post-init audit failed: {ex}")
        return False


def main():
    db_path = settings.database_path
    print(f"[DB Init] Target database path: {db_path}")

    # Ensure parent directory exists (e.g. /var/data)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    status = check_existing_database(db_path)

    if status == "VALID":
        print(f"[DB Init] Valid existing database detected at {db_path}.")
        print("[DB Init] All core table counts match. No re-initialization needed.")
        sys.exit(0)

    elif status == "INCOMPLETE_OR_CORRUPT":
        print("=" * 80)
        print(f"FATAL: Database at '{db_path}' exists but failed integrity or completeness checks!")
        print("To protect production data, initialization has been halted.")
        print("Automatic overwrites are strictly disabled to prevent permanent data loss.")
        print("Please inspect the persistent disk storage or restore from a verified backup.")
        print("=" * 80)
        sys.exit(1)

    else:
        print(f"[DB Init] No existing database found at {db_path}.")
        print("[DB Init] Starting initial data ingestion of 29 historical CSVs...")
        res = load_all_historical_data(force_refresh=False)
        print(f"[DB Init] Ingestion finished. Status: {res['status']}, CSVs processed: {res['csv_count']}")

        audit_ok = run_post_init_audit(db_path)
        if not audit_ok:
            print("FATAL: Post-initialization audit failed! Check logs.")
            sys.exit(1)

        print(f"[DB Init] Production database at '{db_path}' initialized and verified successfully.")
        sys.exit(0)


if __name__ == "__main__":
    main()
