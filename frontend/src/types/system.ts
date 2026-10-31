/**
 * System Diagnostics response types matching /health, /ready, and /api/v1/system/info
 */

export interface HealthResponse {
  status: 'healthy';
  service: string;
  version: string;
  timestamp: string;
}

export interface ReadyResponse {
  status: 'ready';
  service: string;
  database: 'connected';
  table_count: number;
  timestamp: string;
}

export interface AllocationPolicyConfig {
  ordering_policy: string;
  sunday_handling: string;
  distance_metric: string;
  single_node_preference: boolean;
}

export interface CarrierPolicyConfig {
  strict_service_level: boolean;
  allow_silent_downgrades: boolean;
  exclude_sundays: boolean;
  exclude_holidays: boolean;
}

export interface SystemInfoResponse {
  app_name: string;
  version: string;
  environment: string;
  timezone: string;
  database_path: string;
  allocation_policy: AllocationPolicyConfig;
  carrier_policy: CarrierPolicyConfig;
}
