/**
 * Centralized API endpoint paths matching backend FastAPI routing
 */
export const API_ENDPOINTS = {
  // Diagnostics
  HEALTH: '/health',
  READY: '/ready',
  SYSTEM_INFO: '/api/v1/system/info',

  // Order Management
  ORDERS: '/api/v1/orders',
  ORDER_DETAIL: (orderId: string) => `/api/v1/orders/${encodeURIComponent(orderId)}`,

  // Network Topology
  NETWORK_TOPOLOGY: '/api/v1/network/topology',

  // Carrier Intelligence
  CARRIER_OVERVIEW: '/api/v1/carrier/overview',
  CARRIER_DETAIL: (carrierId: string) => `/api/v1/carrier/${encodeURIComponent(carrierId)}`,
  CARRIER_SERVICE_ZONES: '/api/v1/carrier/service-zones',
  CARRIER_SELECT: '/api/v1/carrier/select',
  CARRIER_HISTORY: (orderId: string) => `/api/v1/carrier/history/${encodeURIComponent(orderId)}`,

  // Metrics & Analytics
  METRICS_HEADLINE: '/api/v1/metrics/headline',
  METRICS_KPI_SUMMARY: '/api/v1/metrics/kpi-summary',
  METRICS_CARRIER_PERF: '/api/v1/metrics/carrier-performance',
  METRICS_WAREHOUSE_UTIL: '/api/v1/metrics/warehouse-utilization',
  METRICS_MONTHLY_TRENDS: '/api/v1/metrics/monthly-trends',
  // Analytics
  ANALYTICS_OVERVIEW: '/api/v1/analytics/overview',
  ANALYTICS_TRENDS: '/api/v1/analytics/trends',
  ANALYTICS_FULFILLMENT: '/api/v1/analytics/fulfillment',
  ANALYTICS_CARRIERS: '/api/v1/analytics/carriers',
  ANALYTICS_DELIVERY: '/api/v1/analytics/delivery',
  ANALYTICS_ALLOCATION: '/api/v1/analytics/allocation',
  ANALYTICS_EXPORT: '/api/v1/analytics/export',

  // Allocation
  ALLOCATION_OVERVIEW: '/api/v1/allocation/overview',
  ALLOCATION_ORDER: '/api/v1/allocation/order',
  ALLOCATION_BATCH: '/api/v1/allocation/batch',
  ALLOCATION_HISTORY: (orderId: string) => `/api/v1/allocation/history/${encodeURIComponent(orderId)}`,

  // Tracking
  TRACKING_OVERVIEW: '/api/v1/tracking/overview',
  TRACKING_SHIPMENTS: '/api/v1/tracking/shipments',
  TRACKING_SHIPMENT_DETAIL: (shipmentId: string) => `/api/v1/tracking/shipment/${encodeURIComponent(shipmentId)}`,
  TRACKING_ROLLUP: '/api/v1/tracking/rollup',
  TRACKING_VALIDATE_EVENTS: '/api/v1/tracking/validate-events',
  TRACKING_HISTORY: (orderId: string) => `/api/v1/tracking/history/${encodeURIComponent(orderId)}`,

  // Anomalies
  ANOMALIES_OVERVIEW: '/api/v1/anomalies/overview',
  ANOMALIES_LIST: '/api/v1/anomalies',
  ANOMALY_DETAIL: (anomalyId: string) => `/api/v1/anomalies/${encodeURIComponent(anomalyId)}`,
  ANOMALIES_DETECT: '/api/v1/anomalies/detect',
  ANOMALIES_EVALUATE_GROUND_TRUTH: '/api/v1/anomalies/evaluate/ground-truth',
  ANOMALIES_EVALUATE_CLEAN_AUDIT: '/api/v1/anomalies/evaluate/clean-audit',

  // Simulation
  SIMULATION_SCENARIOS_STANDARD: '/api/v1/simulation/scenarios/standard',
  SIMULATION_RUN: '/api/v1/simulation/run',
  SIMULATION_COMPARE: '/api/v1/simulation/compare',
  SIMULATION_HISTORY: '/api/v1/simulation/history',
  SIMULATION_RUN_DETAIL: (runId: string) => `/api/v1/simulation/runs/${encodeURIComponent(runId)}`,
} as const;
