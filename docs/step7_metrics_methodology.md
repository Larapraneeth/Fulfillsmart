# Step 7 – Performance Metrics and Evaluation

## Generated reports
- `outputs/reports/kpi_summary.csv` – headline operational KPIs with definitions and denominators.
- `outputs/reports/carrier_performance.csv` – shipment counts, delay counts, delay days and on-time rates by carrier.
- `outputs/reports/warehouse_utilization.csv` – allocated orders/units and capacity utilization by node.
- `outputs/reports/service_level_performance.csv` – shipment performance by service-level ID.
- `outputs/reports/monthly_delivery_trend.csv` – monthly order outcomes and rates.
- `outputs/reports/anomaly_label_distribution.csv` – distribution of seeded ground-truth anomaly labels.
- `outputs/reports/step7_metrics_summary.json` – machine-readable headline metrics and interpretation notes.

## Metric definitions
- Allocation success = allocated orders / all orders.
- Carrier/promise coverage = number of carrier-selection rows / all orders. This is a row coverage proxy; split orders may create multiple carrier selections, so it can exceed 100% in other datasets.
- Shipment on-time rate = shipments not flagged delayed / all shipments.
- Order on-time rate (all orders) = orders marked on time / all orders. Carrier-unavailable orders remain in this denominator.
- Order on-time rate (completed) = orders marked on time / completed orders.
- Split-node rate = allocated orders assigned to more than one node / allocated orders.
- Warehouse utilization = summed allocated capacity / summed available capacity across the node-days in `capacity_usage.csv`.

## Important interpretation rules
1. These are synthetic simulation metrics, not real-world service-level claims.
2. Carrier metrics are calculated at shipment grain; order metrics are calculated at order grain. Do not compare their denominators as if they were the same.
3. The 976 ground-truth cases are injected test labels. They are not automatically detected anomalies.
4. Do not report anomaly precision, recall, F1, or accuracy until a detector produces predictions and those predictions are compared with ground truth using a defined train/validation/test split.
5. Capacity utilization is calculated over node-days represented in the allocation run, not every calendar day in the master capacity calendar.

## Reproduce
Run from the extracted project root with Python and pandas installed:
```bash
python generate_step7.py
```
The standalone script is included in this Step 7 bundle. It expects the existing `data/` and `outputs/` folders to be beside it under `FulfillSmart_master_data/`.
