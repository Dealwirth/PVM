import type {
  ControlCapability,
  DeviceEntity,
  DeviceType,
  DiscoveredDevice,
  EntityRole,
  HaDeviceRegistryEntry,
  HaEntityRegistryEntry,
  HaState,
  SensorMask,
} from '@pvm/shared';

/** Keywords used to guess the device type from name/model/class. */
const TYPE_KEYWORDS: Array<{ type: DeviceType; words: string[] }> = [
  { type: 'pv', words: ['pv', 'solar', 'photovoltaik', 'inverter', 'wechselrichter', 'string'] },
  { type: 'battery', words: ['battery', 'batterie', 'speicher', 'accumulator', 'bms'] },
  { type: 'wallbox', words: ['wallbox', 'charger', 'charging', 'evse', 'ladestation', 'lade'] },
  { type: 'heat_pump', words: ['heat_pump', 'heatpump', 'wärmepumpe', 'waermepumpe', 'heat pump'] },
  { type: 'heater', words: ['heater', 'heizung', 'boiler', 'thermostat', 'climate'] },
  {
    type: 'load',
    words: ['load', 'last', 'verbraucher', 'appliance', 'maschine', 'pumpe', 'pump'],
  },
];

const DOMAIN_TO_ROLE: Record<string, EntityRole> = {
  sensor: 'other',
  binary_sensor: 'state',
  switch: 'state',
  light: 'state',
  climate: 'temperature',
  number: 'setpoint',
  input_number: 'setpoint',
  select: 'state',
};

const CONTROLLABLE_DOMAINS = new Set([
  'switch',
  'light',
  'climate',
  'number',
  'input_number',
  'select',
  'input_boolean',
]);

function classifyEntityRole(entity: HaEntityRegistryEntry): EntityRole {
  const dc = (entity.device_class ?? '').toLowerCase();
  const unit = (entity.unit_of_measurement ?? '').toLowerCase();
  const id = entity.entity_id.toLowerCase();
  const name = `${entity.name ?? ''} ${entity.original_name ?? ''}`.toLowerCase();

  if (dc === 'power' || unit === 'w' || unit === 'kw' || id.includes('power')) return 'power';
  if (dc === 'energy' || unit === 'wh' || unit === 'kwh') return 'energy';
  if (dc === 'temperature' || unit === '°c' || unit === '°f' || id.includes('temp')) {
    return 'temperature';
  }
  if (dc === 'battery' || id.includes('soc') || id.includes('battery_level')) {
    return 'battery_level';
  }
  if (id.includes('charge')) return 'charge';
  if (dc === 'timestamp' || unit === 'timestamp') return 'timestamp';
  if (id.includes('location') || id.includes('position')) return 'location';
  if (name.includes('soll') || name.includes('setpoint') || name.includes('target'))
    return 'setpoint';
  if (dc === 'running' || id.includes('operational') || id.includes('running'))
    return 'operational';
  return DOMAIN_TO_ROLE[entity.entity_id.split('.')[0] ?? ''] ?? 'other';
}

export function suggestDeviceType(
  name: string,
  manufacturer?: string | null,
  model?: string | null,
): DeviceType {
  const haystack = `${name} ${manufacturer ?? ''} ${model ?? ''}`.toLowerCase();
  for (const { type, words } of TYPE_KEYWORDS) {
    if (words.some((w) => haystack.includes(w))) return type;
  }
  return 'generic';
}

export function suggestSensorMask(entities: DeviceEntity[]): SensorMask {
  const roles = new Set(entities.map((e) => e.role));
  const hasPower = roles.has('power');
  const hasTemp = roles.has('temperature');
  const hasEnergy = roles.has('energy');
  const hasState = roles.has('state') || roles.has('operational');
  if (hasPower && hasTemp) return 'dual';
  if (hasPower && (hasEnergy || hasState)) return 'advanced';
  if (hasPower) return 'power_only';
  if (hasTemp) return 'temperature_only';
  if (hasEnergy) return 'energy_only';
  if (hasState) return 'state_only';
  return 'advanced';
}

export function deriveCapabilities(entities: DeviceEntity[]): ControlCapability[] {
  const caps = new Set<ControlCapability>();
  for (const e of entities) {
    if (!e.controllable) continue;
    if (e.role === 'power' || e.role === 'setpoint') caps.add('power');
    if (e.role === 'temperature' || e.role === 'setpoint') caps.add('temperature');
    if (e.role === 'state') caps.add('state');
    if (e.role === 'charge') caps.add('charge');
  }
  return [...caps];
}

/** Map raw HA registry + states into candidate PVM devices grouped by HA device. */
export function discoverDevices(
  devices: HaDeviceRegistryEntry[],
  entities: HaEntityRegistryEntry[],
  states: HaState[],
  managedHaDeviceIds: Set<string>,
): DiscoveredDevice[] {
  const stateByEntity = new Map(states.map((s) => [s.entity_id, s]));
  const entitiesByDevice = new Map<string, HaEntityRegistryEntry[]>();
  for (const e of entities) {
    if (!e.device_id) continue;
    const list = entitiesByDevice.get(e.device_id) ?? [];
    list.push(e);
    entitiesByDevice.set(e.device_id, list);
  }

  const result: DiscoveredDevice[] = [];
  for (const device of devices) {
    if (device.disabled_by) continue;
    const deviceEntities = entitiesByDevice.get(device.id) ?? [];
    if (deviceEntities.length === 0) continue;

    const mapped: DeviceEntity[] = deviceEntities.map((e) => {
      const state = stateByEntity.get(e.entity_id);
      const domain = e.entity_id.split('.')[0] ?? 'unknown';
      return {
        entityId: e.entity_id,
        role: classifyEntityRole(e),
        name: e.name ?? e.original_name ?? e.entity_id,
        unit:
          e.unit_of_measurement ?? (state?.attributes?.unit_of_measurement as string | undefined),
        deviceClass: e.device_class ?? undefined,
        stateClass: (state?.attributes?.state_class as string | undefined) ?? undefined,
        value: state ? coerceValue(state.state) : null,
        controllable: CONTROLLABLE_DOMAINS.has(domain),
        domain,
      };
    });

    const name = device.name_by_user ?? device.name ?? `HA ${device.id.slice(0, 8)}`;
    result.push({
      haDeviceId: device.id,
      name,
      suggestedType: suggestDeviceType(name, device.manufacturer, device.model),
      suggestedSensorMask: suggestSensorMask(mapped),
      entities: mapped,
      manufacturer: device.manufacturer ?? undefined,
      model: device.model ?? undefined,
      alreadyManaged: managedHaDeviceIds.has(device.id),
    });
  }
  return result;
}

function coerceValue(state: string): number | string | boolean | null {
  if (state === 'unknown' || state === 'unavailable') return null;
  if (state === 'on' || state === 'true') return true;
  if (state === 'off' || state === 'false') return false;
  const n = Number(state);
  return Number.isFinite(n) ? n : state;
}
