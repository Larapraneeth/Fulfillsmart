r"""
Replacement Synthetic Ground-Truth Test Data Generator
Generates exactly 976 synthetic anomaly test cases using fixed seed 20261022.
Preserves the exact six-category distribution from outputs/reports/anomaly_label_distribution.csv:
- ALLOCATION_EXCEEDS_AVAILABLE_STOCK: 200 cases (CRITICAL)
- CARRIER_UNSUPPORTED_ZONE: 165 cases (HIGH)
- DELIVERED_BEFORE_DISPATCH: 200 cases (CRITICAL)
- INCORRECT_SPLIT_SHIPMENT_STATUS_ROLLUP: 11 cases (HIGH)
- PROMISE_BEFORE_ORDER: 200 cases (HIGH)
- WAREHOUSE_CAPACITY_EXCEEDED: 200 cases (CRITICAL)
Total: 976 cases

NOTE: These are replacement synthetic test cases for evaluating anomaly detection models.
They are stored separately in data/replacement_ground_truth/ and are NOT the missing original Step 6 files.
"""
import csv
import json
import random
from pathlib import Path
from datetime import datetime, date, timedelta

ROOT_DIR = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT_DIR / "data" / "replacement_ground_truth"
OUT_CSV = OUT_DIR / "replacement_ground_truth.csv"
OUT_README = OUT_DIR / "README.md"

SEED = 20261022


def generate_dataset():
    random.seed(SEED)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    
    cases = []
    case_counter = 1
    
    # 1. ALLOCATION_EXCEEDS_AVAILABLE_STOCK (200 cases, CRITICAL)
    # Violation: allocated_qty > available_qty for a given SKU at a warehouse node
    for i in range(200):
        case_id = f"RGT-{case_counter:04d}"
        case_counter += 1
        node_id = f"FUL-2026-{random.randint(1, 20):06d}"
        sku_id = f"SKU-{random.randint(1, 1000):06d}"
        avail = random.randint(0, 10)
        allocated = avail + random.randint(1, 15)
        payload = {
            "order_id": f"ORD-ANOM-{case_id}",
            "node_id": node_id,
            "sku_id": sku_id,
            "allocation_date": "2026-06-15",
            "allocated_qty": allocated,
            "available_qty": avail
        }
        cases.append({
            "case_id": case_id,
            "anomaly_type": "ALLOCATION_EXCEEDS_AVAILABLE_STOCK",
            "severity": "CRITICAL",
            "split": "TEST",
            "entity_type": "ALLOCATION",
            "entity_id": payload["order_id"],
            "description": f"Allocated quantity ({allocated}) exceeds warehouse available on-hand stock ({avail}) at {node_id} for {sku_id}.",
            "scenario_payload": json.dumps(payload)
        })

    # 2. CARRIER_UNSUPPORTED_ZONE (165 cases, HIGH)
    # Violation: Assigned carrier does not support requested service level for destination zone
    carriers = [f"CAR-{i:03d}" for i in range(1, 11)]
    services = ["SAME_DAY", "EXPRESS", "STANDARD"]
    for i in range(165):
        case_id = f"RGT-{case_counter:04d}"
        case_counter += 1
        carrier_id = random.choice(carriers)
        zone_id = f"DZ-{random.randint(1, 50):03d}"
        service = random.choice(services)
        payload = {
            "order_id": f"ORD-ANOM-{case_id}",
            "carrier_id": carrier_id,
            "destination_zone_id": zone_id,
            "requested_service": service,
            "is_zone_covered": False,  # Carrier coverage matrix returns False
            "service_available_in_zone": False
        }
        cases.append({
            "case_id": case_id,
            "anomaly_type": "CARRIER_UNSUPPORTED_ZONE",
            "severity": "HIGH",
            "split": "TEST",
            "entity_type": "CARRIER_SELECTION",
            "entity_id": payload["order_id"],
            "description": f"Carrier {carrier_id} assigned to order delivering to zone {zone_id} for service {service}, which is unsupported.",
            "scenario_payload": json.dumps(payload)
        })

    # 3. DELIVERED_BEFORE_DISPATCH (200 cases, CRITICAL)
    # Violation: actual_delivery_date is earlier than dispatch_date (or delivery timestamp < pickup timestamp)
    for i in range(200):
        case_id = f"RGT-{case_counter:04d}"
        case_counter += 1
        base_day = date(2026, 4, 1) + timedelta(days=random.randint(0, 180))
        dispatch_day = base_day + timedelta(days=random.randint(2, 5))
        delivery_day = base_day  # Delivery before dispatch!
        payload = {
            "shipment_id": f"SHP-ANOM-{case_id}",
            "order_id": f"ORD-ANOM-{case_id}",
            "dispatch_date": dispatch_day.isoformat(),
            "actual_delivery_date": delivery_day.isoformat(),
            "pickup_timestamp": f"{dispatch_day.isoformat()}T14:00:00+05:30",
            "delivery_timestamp": f"{delivery_day.isoformat()}T11:00:00+05:30"
        }
        cases.append({
            "case_id": case_id,
            "anomaly_type": "DELIVERED_BEFORE_DISPATCH",
            "severity": "CRITICAL",
            "split": "TEST",
            "entity_type": "SHIPMENT",
            "entity_id": payload["shipment_id"],
            "description": f"Shipment actual delivery date ({delivery_day.isoformat()}) is earlier than warehouse dispatch date ({dispatch_day.isoformat()}).",
            "scenario_payload": json.dumps(payload)
        })

    # 4. INCORRECT_SPLIT_SHIPMENT_STATUS_ROLLUP (11 cases, HIGH)
    # Violation: Split shipment order rollup has inconsistent status (e.g. marked DELIVERED_ON_TIME despite one delayed shipment, or delivered count mismatch)
    for i in range(11):
        case_id = f"RGT-{case_counter:04d}"
        case_counter += 1
        # 2 shipments: 1 on-time, 1 delayed by 2 days, but order status incorrectly rolled up as DELIVERED_ON_TIME
        s1 = {"shipment_id": f"SHP-{case_id}-A", "promised": "2026-07-10", "actual": "2026-07-10", "is_delayed": 0}
        s2 = {"shipment_id": f"SHP-{case_id}-B", "promised": "2026-07-10", "actual": "2026-07-13", "is_delayed": 1}
        payload = {
            "order_id": f"ORD-ANOM-{case_id}",
            "allocated_node_groups": 2,
            "shipments": [s1, s2],
            "shipment_count": 2,
            "delivered_shipment_count": 2,
            "reported_delivery_outcome_status": "DELIVERED_ON_TIME",  # Anomaly! S2 is delayed, so order outcome must be DELIVERED_LATE
            "reported_delivery_on_time": 1,                           # Anomaly! Must be 0
            "delayed_shipment_count": 0                               # Anomaly! Mismatches actual delayed shipment count (1)
        }
        cases.append({
            "case_id": case_id,
            "anomaly_type": "INCORRECT_SPLIT_SHIPMENT_STATUS_ROLLUP",
            "severity": "HIGH",
            "split": "TEST",
            "entity_type": "DELIVERY_OUTCOME",
            "entity_id": payload["order_id"],
            "description": f"Split shipment order rollup marked DELIVERED_ON_TIME even though shipment {s2['shipment_id']} was delayed.",
            "scenario_payload": json.dumps(payload)
        })

    # 5. PROMISE_BEFORE_ORDER (200 cases, HIGH)
    # Violation: promised_delivery_date or dispatch_date is strictly earlier than order_time
    for i in range(200):
        case_id = f"RGT-{case_counter:04d}"
        case_counter += 1
        order_day = date(2026, 5, 1) + timedelta(days=random.randint(0, 150))
        promised_day = order_day - timedelta(days=random.randint(1, 4))
        payload = {
            "order_id": f"ORD-ANOM-{case_id}",
            "order_time": f"{order_day.isoformat()}T10:00:00+05:30",
            "dispatch_date": (order_day - timedelta(days=1)).isoformat(),
            "promised_delivery_date": promised_day.isoformat()
        }
        cases.append({
            "case_id": case_id,
            "anomaly_type": "PROMISE_BEFORE_ORDER",
            "severity": "HIGH",
            "split": "TEST",
            "entity_type": "DELIVERY_PROMISE",
            "entity_id": payload["order_id"],
            "description": f"Delivery promise date ({promised_day.isoformat()}) precedes the customer order date ({order_day.isoformat()}).",
            "scenario_payload": json.dumps(payload)
        })

    # 6. WAREHOUSE_CAPACITY_EXCEEDED (200 cases, CRITICAL)
    # Violation: Sum of allocated orders or allocated units on a date exceeds node maximum daily capacity
    for i in range(200):
        case_id = f"RGT-{case_counter:04d}"
        case_counter += 1
        node_id = f"FUL-2026-{random.randint(1, 20):06d}"
        cap_orders = random.randint(50, 150)
        cap_units = random.randint(200, 600)
        exceed_type = random.choice(["ORDERS", "UNITS", "BOTH"])
        alloc_orders = cap_orders + (random.randint(5, 30) if exceed_type in ["ORDERS", "BOTH"] else 0)
        alloc_units = cap_units + (random.randint(20, 100) if exceed_type in ["UNITS", "BOTH"] else 0)
        payload = {
            "node_id": node_id,
            "capacity_date": "2026-08-15",
            "max_orders": cap_orders,
            "max_units": cap_units,
            "allocated_orders": alloc_orders,
            "allocated_units": alloc_units
        }
        cases.append({
            "case_id": case_id,
            "anomaly_type": "WAREHOUSE_CAPACITY_EXCEEDED",
            "severity": "CRITICAL",
            "split": "TEST",
            "entity_type": "WAREHOUSE_CAPACITY",
            "entity_id": f"{node_id}_2026-08-15",
            "description": f"Allocated capacity (orders={alloc_orders}, units={alloc_units}) exceeds max warehouse capacity (orders={cap_orders}, units={cap_units}) at {node_id}.",
            "scenario_payload": json.dumps(payload)
        })

    assert len(cases) == 976, f"Expected 976 cases, got {len(cases)}"
    
    # Write CSV
    fields = ["case_id", "anomaly_type", "severity", "split", "entity_type", "entity_id", "description", "scenario_payload"]
    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(cases)
        
    # Write README
    readme_content = f"""# Replacement Synthetic Ground-Truth Test Dataset

## Overview
This directory contains the synthetic replacement ground-truth test dataset generated for evaluating the FulfillSmart anomaly detection engine.

> [!IMPORTANT]
> **Data Origin & Replacement Notice:**
> The original `data/ground_truth/ground_truth.csv` and Step 6 files were identified as missing from the repository archive.
> This file is a **synthetic replacement test dataset** generated deterministically using fixed seed `{SEED}`.
> It replicates the exact six-category distribution of **976 test cases** reported in `outputs/reports/anomaly_label_distribution.csv`.
> It is strictly separated from operational datasets and is **not** claimed to be identical to the missing original files.

## Distribution of 976 Cases
- `ALLOCATION_EXCEEDS_AVAILABLE_STOCK`: 200 cases (CRITICAL)
- `CARRIER_UNSUPPORTED_ZONE`: 165 cases (HIGH)
- `DELIVERED_BEFORE_DISPATCH`: 200 cases (CRITICAL)
- `INCORRECT_SPLIT_SHIPMENT_STATUS_ROLLUP`: 11 cases (HIGH)
- `PROMISE_BEFORE_ORDER`: 200 cases (HIGH)
- `WAREHOUSE_CAPACITY_EXCEEDED`: 200 cases (CRITICAL)
**Total**: 976 test cases (`split: TEST`)

## Integrity
- Generated at: {datetime.now().isoformat()}
- Random Seed: `{SEED}`
- Location: `data/replacement_ground_truth/replacement_ground_truth.csv`
"""
    OUT_README.write_text(readme_content, encoding="utf-8")
    print(f"Successfully generated {len(cases)} replacement ground truth cases at {OUT_CSV}")


if __name__ == "__main__":
    generate_dataset()
