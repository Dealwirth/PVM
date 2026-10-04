/** Home Assistant integration types (REST + WebSocket). */

export interface HaState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

export interface HaEntityRegistryEntry {
  entity_id: string;
  device_id: string | null;
  platform: string;
  name: string | null;
  original_name: string | null;
  disabled_by: string | null;
  hidden_by: string | null;
  area_id: string | null;
  device_class?: string | null;
  unit_of_measurement?: string | null;
  capabilities?: Record<string, unknown>;
}

export interface HaDeviceRegistryEntry {
  id: string;
  name: string | null;
  name_by_user: string | null;
  manufacturer: string | null;
  model: string | null;
  area_id: string | null;
  identifiers: Array<[string, string]>;
  entry_type: string | null;
  disabled_by: string | null;
}

export interface HaAreaRegistryEntry {
  id: string;
  name: string;
}

export interface HaServiceDomain {
  domain: string;
  services: Record<string, { name?: string; fields?: Record<string, unknown> }>;
}

export interface HaHistoryPoint {
  entity_id: string;
  state: string;
  last_changed: string;
  last_updated: string;
}

export interface HaConfig {
  version: string;
  location_name: string;
  time_zone: string;
  unit_system: Record<string, string>;
}

export interface HaCallServiceRequest {
  domain: string;
  service: string;
  entityId?: string;
  data?: Record<string, unknown>;
}

export interface HaConnectionState {
  connected: boolean;
  url: string;
  lastConnectedAt?: string;
  lastErrorAt?: string;
  lastError?: string;
  haVersion?: string;
}
