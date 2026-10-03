/**
 * Device domain types for PVM.
 */

export const DEVICE_TYPES = [
  'pv',
  'battery',
  'wallbox',
  'heat_pump',
  'heater',
  'load',
  'generic',
] as const;

export type DeviceType = (typeof DEVICE_TYPES)[number];

export const SENSOR_MASKS = [
  'power_only',
  'temperature_only',
  'dual',
  'energy_only',
  'state_only',
  'advanced',
] as const;

export type SensorMask = (typeof SENSOR_MASKS)[number];

export const DEVICE_STATUSES = ['active', 'disabled', 'error', 'unavailable'] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

export const CONTROL_CAPABILITIES = [
  'power',
  'temperature',
  'state',
  'charge',
  'discharge',
  'setpoint',
] as const;
export type ControlCapability = (typeof CONTROL_CAPABILITIES)[number];

export const ENTITY_ROLES = [
  'power',
  'energy',
  'temperature',
  'state',
  'battery_level',
  'charge',
  'operational',
  'timestamp',
  'location',
  'setpoint',
  'other',
] as const;
export type EntityRole = (typeof ENTITY_ROLES)[number];

/** A single Home Assistant entity mapped to a PVM device. */
export interface DeviceEntity {
  /** HA entity_id, e.g. sensor.pv_power */
  entityId: string;
  /** Role of this entity within the device. */
  role: EntityRole;
  name: string;
  unit?: string;
  deviceClass?: string;
  stateClass?: string;
  /** Last known value (normalized where possible). */
  value?: number | string | boolean | null;
  /** Whether this entity is controllable via a HA service. */
  controllable: boolean;
  /** HA domain of the entity, e.g. sensor, switch, climate. */
  domain: string;
}

/** A managed device in PVM. */
export interface Device {
  id: string;
  /** Stable HA device registry id, when the device originates from HA. */
  haDeviceId?: string;
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  /** Priority 0..100 (higher = more important). */
  priority: number;
  sensorMask: SensorMask;
  capabilities: ControlCapability[];
  entities: DeviceEntity[];
  /** Nominal/rated power in watts, if known. */
  ratedPowerW?: number;
  /** Minimum run power in watts (e.g. heat pump modulation floor). */
  minPowerW?: number;
  /** Whether PVM may switch this device off automatically. */
  allowAutoShutdown: boolean;
  /** Whether PVM may control this device at all. */
  controllable: boolean;
  /** Free-form tags for filtering. */
  tags: string[];
  /** Optional location label, e.g. garage, roof, basement. */
  location?: string;
  createdAt: string;
  updatedAt: string;
  /** User added manually instead of discovered via HA. */
  manuallyAdded: boolean;
}

export interface DeviceCreateInput {
  name: string;
  type: DeviceType;
  priority?: number;
  sensorMask?: SensorMask;
  capabilities?: ControlCapability[];
  entities?: Array<Partial<DeviceEntity> & { entityId: string }>;
  ratedPowerW?: number;
  minPowerW?: number;
  allowAutoShutdown?: boolean;
  controllable?: boolean;
  tags?: string[];
  location?: string;
  haDeviceId?: string;
  manuallyAdded?: boolean;
}

export interface DeviceUpdateInput {
  name?: string;
  type?: DeviceType;
  status?: DeviceStatus;
  priority?: number;
  sensorMask?: SensorMask;
  capabilities?: ControlCapability[];
  entities?: DeviceEntity[];
  ratedPowerW?: number;
  minPowerW?: number;
  allowAutoShutdown?: boolean;
  controllable?: boolean;
  tags?: string[];
  location?: string;
}

export interface DeviceFilter {
  type?: DeviceType;
  status?: DeviceStatus;
  sensorMask?: SensorMask;
  minPriority?: number;
  search?: string;
  tag?: string;
}

/** A candidate device proposed by HA discovery, not yet adopted. */
export interface DiscoveredDevice {
  haDeviceId: string;
  name: string;
  suggestedType: DeviceType;
  suggestedSensorMask: SensorMask;
  entities: DeviceEntity[];
  manufacturer?: string;
  model?: string;
  /** True when the device matches an already-managed PVM device. */
  alreadyManaged: boolean;
}

export interface DeviceCommand {
  deviceId: string;
  capability: ControlCapability;
  /** For power: watts. For temperature/setpoint: celsius. For state: boolean/on-off. */
  value: number | boolean | string;
  /** Originating subsystem, for audit purposes. */
  source: 'user' | 'planner' | 'safety' | 'self_healing' | 'api';
  reason?: string;
}
