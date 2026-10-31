import hashlib
import sqlite3
import re
from pathlib import Path

# 1. Secret Scan
files_to_check = [
    'src/api/schemas/anomalies.py',
    'src/api/routers/anomalies.py',
    'tests/test_api.py',
    'frontend/src/api/endpoints.ts',
    'frontend/src/types/anomalies.ts',
    'frontend/src/api/queries/useAnomalies.ts',
    'frontend/src/modules/anomalies/components/AnomaliesHeader.tsx',
    'frontend/src/modules/anomalies/components/AnomalyKpiCards.tsx',
    'frontend/src/modules/anomalies/components/AnomalyCategoryDistribution.tsx',
    'frontend/src/modules/anomalies/components/AnomalySeverityDistribution.tsx',
    'frontend/src/modules/anomalies/components/AnomalyFilters.tsx',
    'frontend/src/modules/anomalies/components/AnomalyExplorer.tsx',
    'frontend/src/modules/anomalies/components/AnomalyDetailDrawer.tsx',
    'frontend/src/modules/anomalies/components/AnomalyBenchmarkAuditTab.tsx',
    'frontend/src/modules/anomalies/AnomaliesPage.tsx'
]

secret_regexes = [
    re.compile(r'ghp_[0-9a-zA-Z]{36}'),
    re.compile(r'eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}'),
    re.compile(r'BEGIN\s+PRIVATE\s+KEY'),
    re.compile(r'AKIA[0-9A-Z]{16}')
]

found_secrets = False
for fpath in files_to_check:
    p = Path(fpath)
    if p.exists():
        content = p.read_text(encoding='utf-8')
        for pat in secret_regexes:
            if pat.search(content):
                print(f"SECRET DETECTED in {fpath}")
                found_secrets = True

if not found_secrets:
    print("Secret Scan: PASS (Zero secrets or unauthorized tokens detected)")

# 2. Database Row Counts
expected_counts = {
    'ingestion_metadata': 29,
    'skus': 1000,
    'fulfillment_nodes': 20,
    'delivery_zones': 50,
    'inventory': 20000,
    'carriers': 10,
    'service_levels': 30,
    'carrier_service_zones': 335,
    'warehouse_capacity': 7300,
    'carrier_calendar': 3650,
    'holidays': 9,
    'orders': 50000,
    'order_lines': 93552,
    'tracking_events': 100000,
    'allocation_decisions': 93558,
    'order_allocation_summary': 50000,
    'capacity_usage': 5184,
    'allocation_exceptions': 0,
    'carrier_selection': 49436,
    'delivery_promises': 49436,
    'promise_exceptions': 580,
    'shipments': 49436,
    'delivery_outcomes': 50000,
    'carrier_performance': 10,
    'warehouse_utilization': 20,
    'service_level_performance': 30,
    'monthly_delivery_trend': 11,
    'anomaly_label_distribution': 6,
    'shipment_exceptions': 580
}

conn = sqlite3.connect('storage/fulfillsmart.db')
cur = conn.cursor()

row_mismatches = []
for table, exp in expected_counts.items():
    cur.execute(f'SELECT COUNT(*) FROM "{table}"')
    actual = cur.fetchone()[0]
    if actual != exp:
        row_mismatches.append(f"{table}: expected {exp}, got {actual}")

if not row_mismatches:
    print("Database Row Counts: PASS (All 29 tables match expected baseline counts exactly)")
else:
    print("Database Row Counts: FAIL", row_mismatches)

# 3. 29 Source CSV SHA-256 Hashes against ingestion_metadata
cur.execute("SELECT table_name, file_path, sha256_hash FROM ingestion_metadata")
rows = cur.fetchall()
hash_mismatches = []
print(f"Checking SHA-256 for all {len(rows)} CSV files from ingestion_metadata:")
for table_name, rel_path, expected_hash in rows:
    file_path = Path(rel_path)
    if not file_path.exists():
        # try relative to workspace
        file_path = Path("E:/FulfillSmart") / rel_path
    if not file_path.exists():
        hash_mismatches.append(f"{table_name}: file {rel_path} not found")
        continue

    with open(file_path, "rb") as f:
        actual_hash = hashlib.sha256(f.read()).hexdigest()

    if actual_hash != expected_hash:
        hash_mismatches.append(f"{table_name}: expected {expected_hash}, got {actual_hash}")

if not hash_mismatches:
    print("CSV SHA-256 Check: PASS (All 29 CSV files match recorded SHA-256 hashes with zero drift)")
else:
    print("CSV SHA-256 Check: FAIL", hash_mismatches)
