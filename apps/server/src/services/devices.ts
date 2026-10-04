import type {
  Device,
  DeviceCommand,
  DeviceCreateInput,
  DeviceEntity,
  DeviceFilter,
  DeviceUpdateInput,
  DiscoveredDevice,
} from '@pvm/shared';
import { PvmError } from '@pvm/shared';
import type { DeviceRepository } from '../db/repositories/devices.js';
import type { HistoryRepository } from '../db/repositories/history.js';
import type { HaClient } from '../ha/client.js';
import { deriveCapabilities, discoverDevices } from '../ha/discovery.js';
import type { DevLog } from './devlog.js';

/** Map a PVM capability + value onto a HA service call. */
function commandToService(
  device: Device,
  command: DeviceCommand,
): { domain: string; service: string; entityId: string; data?: Record<string, unknown> } {
  const byRole = (role: DeviceEntity['role']): DeviceEntity | undefined =>
    device.entities.find((e) => e.role === role && e.controllable) ??
    device.entities.find((e) => e.role === role);

  switch (command.capability) {
    case 'state': {
      const entity = byRole('state');
      if (!entity) throw new PvmError('PVM-006', { deviceId: device.id, capability: 'state' });
      const on = command.value === true || command.value === 'on' || command.value === 1;
      const domain =
        entity.domain === 'light'
          ? 'light'
          : entity.domain === 'input_boolean'
            ? 'input_boolean'
            : 'switch';
      return { domain, service: on ? 'turn_on' : 'turn_off', entityId: entity.entityId };
    }
    case 'temperature':
    case 'setpoint': {
      const entity = byRole('temperature') ?? byRole('setpoint');
      if (!entity)
        throw new PvmError('PVM-006', { deviceId: device.id, capability: command.capability });
      if (entity.domain === 'climate') {
        return {
          domain: 'climate',
          service: 'set_temperature',
          entityId: entity.entityId,
          data: { temperature: Number(command.value) },
        };
      }
      return {
        domain: entity.domain === 'input_number' ? 'input_number' : 'number',
        service: 'set_value',
        entityId: entity.entityId,
        data: { value: Number(command.value) },
      };
    }
    case 'power':
    case 'charge':
    case 'discharge': {
      const entity = byRole('setpoint') ?? byRole('power') ?? byRole('state');
      if (!entity)
        throw new PvmError('PVM-006', { deviceId: device.id, capability: command.capability });
      if (entity.domain === 'number' || entity.domain === 'input_number') {
        return {
          domain: entity.domain,
          service: 'set_value',
          entityId: entity.entityId,
          data: { value: Number(command.value) },
        };
      }
      const on = Number(command.value) > 0;
      return { domain: 'switch', service: on ? 'turn_on' : 'turn_off', entityId: entity.entityId };
    }
    default:
      throw new PvmError('PVM-006', { deviceId: device.id, capability: command.capability });
  }
}

export class DeviceService {
  constructor(
    private readonly repo: DeviceRepository,
    private readonly history: HistoryRepository,
    private readonly ha: HaClient,
    private readonly log: DevLog,
  ) {}

  list(filter: DeviceFilter = {}): Device[] {
    return this.repo.list(filter);
  }

  get(id: string): Device {
    const device = this.repo.get(id);
    if (!device) throw new PvmError('PVM-005', { deviceId: id }, `Gerät ${id} nicht gefunden`);
    return device;
  }

  create(input: DeviceCreateInput): Device {
    const device = this.repo.create(input);
    this.log.info('devices', 'Device created', { deviceId: device.id, type: device.type });
    return device;
  }

  update(id: string, patch: DeviceUpdateInput): Device {
    const updated = this.repo.update(id, patch);
    if (!updated) throw new PvmError('PVM-005', { deviceId: id });
    this.log.info('devices', 'Device updated', { deviceId: id });
    return updated;
  }

  remove(id: string): void {
    if (!this.repo.remove(id)) throw new PvmError('PVM-005', { deviceId: id });
    this.log.info('devices', 'Device removed', { deviceId: id });
  }

  /** Adopt a discovered HA device into PVM. */
  adopt(discovered: DiscoveredDevice, overrides: Partial<DeviceCreateInput> = {}): Device {
    const entities = discovered.entities.map((e) => ({ ...e, value: e.value ?? null }));
    const capabilities = deriveCapabilities(entities);
    return this.create({
      name: discovered.name,
      type: overrides.type ?? discovered.suggestedType,
      sensorMask: overrides.sensorMask ?? discovered.suggestedSensorMask,
      haDeviceId: discovered.haDeviceId,
      entities,
      capabilities,
      controllable: overrides.controllable ?? capabilities.length > 0,
      priority: overrides.priority ?? 50,
      tags: overrides.tags,
      location: overrides.location,
      ratedPowerW: overrides.ratedPowerW,
      minPowerW: overrides.minPowerW,
      manuallyAdded: false,
    });
  }

  async discover(): Promise<DiscoveredDevice[]> {
    const [deviceRegistry, entityRegistry, states] = await Promise.all([
      this.ha.getDeviceRegistry(),
      this.ha.getEntityRegistry(),
      this.ha.getStates(),
    ]);
    const managed = new Set(
      this.repo
        .list()
        .map((d) => d.haDeviceId)
        .filter((id): id is string => Boolean(id)),
    );
    const discovered = discoverDevices(deviceRegistry, entityRegistry, states, managed);
    this.log.info('devices', 'Discovery completed', { count: discovered.length });
    return discovered;
  }

  /** Refresh cached entity values for a device from live HA state. */
  async refreshValues(id: string): Promise<Device> {
    const device = this.get(id);
    const updatedEntities: DeviceEntity[] = [];
    for (const entity of device.entities) {
      try {
        const state = await this.ha.getStateById(entity.entityId);
        updatedEntities.push({
          ...entity,
          value: coerce(state.state),
          unit: (state.attributes.unit_of_measurement as string | undefined) ?? entity.unit,
        });
      } catch {
        updatedEntities.push(entity);
      }
    }
    return this.update(id, { entities: updatedEntities });
  }

  async execute(command: DeviceCommand): Promise<{ ok: boolean; service: string }> {
    const device = this.get(command.deviceId);
    if (!device.controllable && command.source !== 'safety') {
      throw new PvmError('PVM-006', { deviceId: device.id, reason: 'not controllable' });
    }
    const call = commandToService(device, command);
    try {
      await this.ha.callService(call.domain, call.service, call.entityId, call.data);
      this.log.info('devices', 'Command executed', {
        deviceId: device.id,
        capability: command.capability,
        source: command.source,
      });
      return { ok: true, service: `${call.domain}.${call.service}` };
    } catch (err) {
      this.log.error(
        'devices',
        'Command failed',
        { deviceId: device.id, capability: command.capability, error: (err as Error).message },
        'PVM-006',
      );
      throw new PvmError('PVM-006', { deviceId: device.id, error: (err as Error).message });
    }
  }

  historyFor(deviceId: string, since?: string, until?: string) {
    return this.history.forDevice(deviceId, since, until);
  }

  /** Sum current power of all active devices, in watts. */
  currentTotalPowerW(): number {
    let total = 0;
    for (const device of this.repo.list()) {
      const power = device.entities.find((e) => e.role === 'power');
      const value = power?.value;
      if (typeof value === 'number') {
        total += power?.unit?.toLowerCase() === 'kw' ? value * 1000 : value;
      }
    }
    return total;
  }
}

function coerce(state: string): number | string | boolean | null {
  if (state === 'unknown' || state === 'unavailable') return null;
  if (state === 'on') return true;
  if (state === 'off') return false;
  const n = Number(state);
  return Number.isFinite(n) ? n : state;
}
