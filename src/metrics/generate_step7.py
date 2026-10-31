from pathlib import Path
import pandas as pd, json
from datetime import datetime, timezone
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'outputs' / 'reports'
DOC = ROOT / 'docs'
OUT.mkdir(parents=True, exist_ok=True); DOC.mkdir(parents=True, exist_ok=True)

def read(rel): return pd.read_csv(ROOT / rel)
orders=read('data/transactions/orders.csv')
summary=read('outputs/allocations/order_allocation_summary.csv')
alloc=read('outputs/allocations/allocation_decisions.csv')
capacity=read('outputs/allocations/capacity_usage.csv')
carriers=read('outputs/carriers/carrier_selection.csv')
ship=read('outputs/shipments/shipments.csv')
outcomes=read('outputs/reports/delivery_outcomes.csv')
gt=read('data/ground_truth/ground_truth.csv')
nodes=read('data/master/fulfillment_nodes.csv')

# Core KPI calculations. Rates use explicit denominators and are not model scores.
total_orders=len(orders); allocated_orders=int((summary.allocation_status=='ALLOCATED').sum())
completed=int(outcomes.delivery_completed.astype(bool).sum())
on_time=int(outcomes.delivery_on_time.astype(bool).sum())
late=int((outcomes.delivery_outcome_status=='DELIVERED_LATE').sum())
carrier_unavailable=int((outcomes.delivery_outcome_status=='CARRIER_UNAVAILABLE').sum())
split_orders=int((summary.allocated_node_count>1).sum())
shipment_count=len(ship)
shipment_late=int(ship.is_delayed.astype(bool).sum())

# Warehouse utilization weighted by total capacity, across node-days represented in the allocation run.
cap_orders=capacity.max_orders.sum(); used_orders=capacity.allocated_orders.sum()
cap_units=capacity.max_units.sum(); used_units=capacity.allocated_units.sum()

kpis=[
('total_orders',total_orders,'orders','All synthetic orders in orders.csv'),
('allocation_success_rate',allocated_orders/total_orders*100 if total_orders else 0,'percent','Allocated orders / total orders'),
('allocated_orders',allocated_orders,'orders','Orders with ALLOCATED status'),
('unallocated_orders',total_orders-allocated_orders,'orders','Total orders minus allocated orders'),
('carrier_promise_coverage_rate',len(carriers)/total_orders*100 if total_orders else 0,'percent','Orders with a carrier selection / all orders; split orders can have multiple selections'),
('shipment_count',shipment_count,'shipments','Rows in shipments.csv'),
('shipment_on_time_rate', (shipment_count-shipment_late)/shipment_count*100 if shipment_count else 0,'percent','Shipments not flagged delayed / all shipments'),
('shipment_delay_rate',shipment_late/shipment_count*100 if shipment_count else 0,'percent','Shipments flagged delayed / all shipments'),
('order_delivery_completion_rate',completed/total_orders*100 if total_orders else 0,'percent','Orders with completed delivery / all orders'),
('order_on_time_rate_all_orders',on_time/total_orders*100 if total_orders else 0,'percent','On-time delivered orders / all orders; carrier-unavailable orders remain in denominator'),
('order_on_time_rate_completed',on_time/completed*100 if completed else 0,'percent','On-time delivered orders / completed orders'),
('late_orders',late,'orders','Order outcome DELIVERED_LATE'),
('carrier_unavailable_orders',carrier_unavailable,'orders','Order outcome CARRIER_UNAVAILABLE'),
('split_shipment_order_rate',split_orders/allocated_orders*100 if allocated_orders else 0,'percent','Allocated orders assigned to more than one node / allocated orders'),
('single_node_orders',allocated_orders-split_orders,'orders','Allocated orders assigned to exactly one node'),
('split_node_orders',split_orders,'orders','Allocated orders assigned to multiple nodes'),
('warehouse_order_capacity_utilization',used_orders/cap_orders*100 if cap_orders else 0,'percent','Sum allocated order capacity / sum capacity across used node-days'),
('warehouse_unit_capacity_utilization',used_units/cap_units*100 if cap_units else 0,'percent','Sum allocated unit capacity / sum capacity across used node-days'),
('labelled_anomaly_cases',len(gt),'cases','Ground-truth anomaly scenarios; separate from clean operational records'),
]
pd.DataFrame(kpis,columns=['metric','value','unit','definition']).to_csv(OUT/'kpi_summary.csv',index=False)

# Carrier-level shipment performance
s=ship.merge(read('data/master/carriers.csv')[['carrier_id','carrier_name']],on='carrier_id',how='left',suffixes=('','_master'))
carrier_perf=s.groupby(['carrier_id','carrier_name'],dropna=False).agg(
 shipment_count=('shipment_id','count'), delayed_shipments=('is_delayed',lambda x:int(x.astype(bool).sum())),
 average_delay_days=('delay_days','mean'), median_delay_days=('delay_days','median'),
).reset_index()
carrier_perf['on_time_rate_pct']=(1-carrier_perf.delayed_shipments/carrier_perf.shipment_count)*100
carrier_perf['delay_rate_pct']=carrier_perf.delayed_shipments/carrier_perf.shipment_count*100
carrier_perf.to_csv(OUT/'carrier_performance.csv',index=False)

# Node utilization and allocation volume
node_perf=capacity.groupby('node_id').agg(
 active_node_days=('capacity_date','nunique'), allocated_orders=('allocated_orders','sum'), allocated_units=('allocated_units','sum'),
 order_capacity=('max_orders','sum'), unit_capacity=('max_units','sum')).reset_index().merge(nodes[['node_id','node_name','city','state']],on='node_id',how='left')
node_perf['order_utilization_pct']=node_perf.allocated_orders/node_perf.order_capacity*100
node_perf['unit_utilization_pct']=node_perf.allocated_units/node_perf.unit_capacity*100
node_perf.to_csv(OUT/'warehouse_utilization.csv',index=False)

# Service level performance at shipment grain
service=ship.groupby('service_level_id').agg(shipment_count=('shipment_id','count'),delayed_shipments=('is_delayed',lambda x:int(x.astype(bool).sum())),average_delay_days=('delay_days','mean')).reset_index()
service['on_time_rate_pct']=(1-service.delayed_shipments/service.shipment_count)*100
service.to_csv(OUT/'service_level_performance.csv',index=False)

# Monthly order outcome trend
monthly=outcomes.copy(); monthly['month']=pd.to_datetime(monthly.order_time,utc=True).dt.strftime('%Y-%m')
monthly_trend=monthly.groupby('month').agg(orders=('order_id','count'),on_time_orders=('delivery_on_time',lambda x:int(x.astype(bool).sum())),completed_orders=('delivery_completed',lambda x:int(x.astype(bool).sum())),late_orders=('delivery_outcome_status',lambda x:int((x=='DELIVERED_LATE').sum())),carrier_unavailable_orders=('delivery_outcome_status',lambda x:int((x=='CARRIER_UNAVAILABLE').sum()))).reset_index()
monthly_trend['on_time_rate_all_orders_pct']=monthly_trend.on_time_orders/monthly_trend.orders*100
monthly_trend['completion_rate_pct']=monthly_trend.completed_orders/monthly_trend.orders*100
monthly_trend.to_csv(OUT/'monthly_delivery_trend.csv',index=False)

# Ground-truth labels are a test dataset, not detected anomalies.
anom=gt.groupby(['anomaly_type','severity','split']).size().reset_index(name='case_count')
anom.to_csv(OUT/'anomaly_label_distribution.csv',index=False)

summary_json={
 'project':'FulfillSmart','step':7,'generated_at_utc':datetime.now(timezone.utc).isoformat(),
 'source_files':['orders.csv','order_allocation_summary.csv','allocation_decisions.csv','capacity_usage.csv','carrier_selection.csv','shipments.csv','delivery_outcomes.csv','ground_truth.csv'],
 'headline':{'total_orders':total_orders,'allocated_orders':allocated_orders,'allocation_success_rate_pct':round(allocated_orders/total_orders*100,2) if total_orders else 0,'shipments':shipment_count,'order_on_time_rate_all_orders_pct':round(on_time/total_orders*100,2) if total_orders else 0,'order_on_time_rate_completed_pct':round(on_time/completed*100,2) if completed else 0,'carrier_unavailable_orders':carrier_unavailable,'split_node_orders':split_orders,'warehouse_order_capacity_utilization_pct':round(used_orders/cap_orders*100,2) if cap_orders else 0,'warehouse_unit_capacity_utilization_pct':round(used_units/cap_units*100,2) if cap_units else 0,'ground_truth_anomaly_cases':len(gt)},
 'interpretation_notes':['All values are calculated from the synthetic project datasets.','Order-level on-time rate over all orders includes carrier-unavailable orders in the denominator; completed-only rate excludes them.','Carrier performance is shipment-level, not order-level.','Warehouse utilization is weighted across node-days present in capacity_usage.csv.','Ground-truth anomaly labels are seeded test cases, not predictions from an anomaly detector.','Precision, recall, F1 and detection accuracy are intentionally not reported because no detector predictions have been evaluated against the labels.']}
(OUT/'step7_metrics_summary.json').write_text(json.dumps(summary_json,indent=2),encoding='utf-8')

# Data dictionary / methodology
doc='''# Step 7 – Performance Metrics and Evaluation\n\n## Generated reports\n- `outputs/reports/kpi_summary.csv` – headline operational KPIs with definitions and denominators.\n- `outputs/reports/carrier_performance.csv` – shipment counts, delay counts, delay days and on-time rates by carrier.\n- `outputs/reports/warehouse_utilization.csv` – allocated orders/units and capacity utilization by node.\n- `outputs/reports/service_level_performance.csv` – shipment performance by service-level ID.\n- `outputs/reports/monthly_delivery_trend.csv` – monthly order outcomes and rates.\n- `outputs/reports/anomaly_label_distribution.csv` – distribution of seeded ground-truth anomaly labels.\n- `outputs/reports/step7_metrics_summary.json` – machine-readable headline metrics and interpretation notes.\n\n## Metric definitions\n- Allocation success = allocated orders / all orders.\n- Carrier/promise coverage = number of carrier-selection rows / all orders. This is a row coverage proxy; split orders may create multiple carrier selections, so it can exceed 100% in other datasets.\n- Shipment on-time rate = shipments not flagged delayed / all shipments.\n- Order on-time rate (all orders) = orders marked on time / all orders. Carrier-unavailable orders remain in this denominator.\n- Order on-time rate (completed) = orders marked on time / completed orders.\n- Split-node rate = allocated orders assigned to more than one node / allocated orders.\n- Warehouse utilization = summed allocated capacity / summed available capacity across the node-days in `capacity_usage.csv`.\n\n## Important interpretation rules\n1. These are synthetic simulation metrics, not real-world service-level claims.\n2. Carrier metrics are calculated at shipment grain; order metrics are calculated at order grain. Do not compare their denominators as if they were the same.\n3. The 976 ground-truth cases are injected test labels. They are not automatically detected anomalies.\n4. Do not report anomaly precision, recall, F1, or accuracy until a detector produces predictions and those predictions are compared with ground truth using a defined train/validation/test split.\n5. Capacity utilization is calculated over node-days represented in the allocation run, not every calendar day in the master capacity calendar.\n\n## Reproduce\nRun from the extracted project root with Python and pandas installed:\n```bash\npython generate_step7.py\n```\nThe standalone script is included in this Step 7 bundle. It expects the existing `data/` and `outputs/` folders to be beside it under `FulfillSmart_master_data/`.\n'''
(DOC/'step7_metrics_methodology.md').write_text(doc,encoding='utf-8')
print(json.dumps(summary_json['headline'],indent=2))
print('reports:', sorted(p.name for p in OUT.glob('*') if p.name in ['kpi_summary.csv','carrier_performance.csv','warehouse_utilization.csv','service_level_performance.csv','monthly_delivery_trend.csv','anomaly_label_distribution.csv','step7_metrics_summary.json']))
