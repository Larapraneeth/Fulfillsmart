# Replacement Synthetic Ground-Truth Test Dataset

## Overview
This directory contains the synthetic replacement ground-truth test dataset generated for evaluating the FulfillSmart anomaly detection engine.

> [!IMPORTANT]
> **Data Origin & Replacement Notice:**
> The original `data/ground_truth/ground_truth.csv` and Step 6 files were identified as missing from the repository archive.
> This file is a **synthetic replacement test dataset** generated deterministically using fixed seed `20261022`.
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
- Generated at: 2026-10-30T13:03:02.551973
- Random Seed: `20261022`
- Location: `data/replacement_ground_truth/replacement_ground_truth.csv`
