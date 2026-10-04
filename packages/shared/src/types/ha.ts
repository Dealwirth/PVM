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

/**
 * A snapshot of Home Assistant state pushed by the HA custom component.
 *
 * This is the API-free path: instead of PVM reaching *out* to HA (which fails
 * when HA is only reachable from the HA host, sits behind a firewall, or uses
 * a self-signed certificate), the HA integration pushes the data it already
 * has *in* to PVM. Fields mirror the REST/WS shapes so downstream code does not
 * need to distinguish the two sources.
 */
export interface HaSnapshot {
  /** ISO timestamp of when the snapshot was collected in HA. */
  takenAt: string;
  /** HA version from `GET /api/config`. */
  haVersion?: string;
  /** HA instance name from `GET /api/config`. */
  locationName?: string;
  /** The HA base URL(s) HA itself knows (internal/external/api). */
  haUrl?: string;
  /** Result of `GET /api/states`. */
  states?: HaState[];
  /** Result of `GET /api/services`. */
  services?: HaServiceDomain[];
  /** Result of the device-registry WebSocket command. */
  deviceRegistry?: HaDeviceRegistryEntry[];
  /** Result of the entity-registry WebSocket command. */
  entityRegistry?: HaEntityRegistryEntry[];
  /** Result of the area-registry WebSocket command. */
  areaRegistry?: HaAreaRegistryEntry[];
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
  /** The HA integration has pushed at least one snapshot (API-free path). */
  integrationConnected?: boolean;
  /** ISO timestamp of the most recent pushed snapshot. */
  snapshotAt?: string;
}
