import type {
  Device,
  DeviceCreateInput,
  DeviceFilter,
  DeviceStatus,
  DeviceType,
  DeviceUpdateInput,
  SensorMask,
} from '@pvm/shared';
import { newId } from '@pvm/shared';
import type { Db } from '../index.js';

interface DeviceRow {
  id: string;
  ha_device_id: string | null;
  name: string;
  type: string;
  status: string;
  priority: number;
  sensor_mask: string;
  capabilities: string;
  entities: string;
  rated_power_w: number | null;
  min_power_w: number | null;
  allow_auto_shutdown: number;
  controllable: number;
  tags: string;
  location: string | null;
  created_at: string;
  updated_at: string;
  manually_added: number;
}

function rowToDevice(row: DeviceRow): Device {
  return {
    id: row.id,
    haDeviceId: row.ha_device_id ?? undefined,
    name: row.name,
    type: row.type as DeviceType,
    status: row.status as DeviceStatus,
    priority: row.priority,
    sensorMask: row.sensor_mask as SensorMask,
    capabilities: JSON.parse(row.capabilities) as Device['capabilities'],
    entities: JSON.parse(row.entities) as Device['entities'],
    ratedPowerW: row.rated_power_w ?? undefined,
    minPowerW: row.min_power_w ?? undefined,
    allowAutoShutdown: row.allow_auto_shutdown === 1,
    controllable: row.controllable === 1,
    tags: JSON.parse(row.tags) as string[],
    location: row.location ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    manuallyAdded: row.manually_added === 1,
  };
}

export class DeviceRepository {
  constructor(private readonly db: Db) {}

  list(filter: DeviceFilter = {}): Device[] {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter.type) {
      clauses.push('type = ?');
      params.push(filter.type);
    }
    if (filter.status) {
      clauses.push('status = ?');
      params.push(filter.status);
    }
    if (filter.sensorMask) {
      clauses.push('sensor_mask = ?');
      params.push(filter.sensorMask);
    }
    if (filter.minPriority !== undefined) {
      clauses.push('priority >= ?');
      params.push(filter.minPriority);
    }
    if (filter.search) {
      clauses.push('LOWER(name) LIKE ?');
      params.push(`%${filter.search.toLowerCase()}%`);
    }
    if (filter.tag) {
      clauses.push('tags LIKE ?');
      params.push(`%"${filter.tag}"%`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`SELECT * FROM devices ${where} ORDER BY priority DESC, name ASC`)
      .all(...params) as DeviceRow[];
    return rows.map(rowToDevice);
  }

  get(id: string): Device | undefined {
    const row = this.db.prepare('SELECT * FROM devices WHERE id = ?').get(id) as
      DeviceRow | undefined;
    return row ? rowToDevice(row) : undefined;
  }

  getByHaDeviceId(haDeviceId: string): Device | undefined {
    const row = this.db.prepare('SELECT * FROM devices WHERE ha_device_id = ?').get(haDeviceId) as
      DeviceRow | undefined;
    return row ? rowToDevice(row) : undefined;
  }

  create(input: DeviceCreateInput): Device {
    const now = new Date().toISOString();
    const id = newId('dev');
    const entities = (input.entities ?? []).map((e) => ({
      entityId: e.entityId,
      role: e.role ?? 'other',
      name: e.name ?? e.entityId,
      unit: e.unit,
      deviceClass: e.deviceClass,
      stateClass: e.stateClass,
      value: e.value ?? null,
      controllable: e.controllable ?? false,
      domain: e.domain ?? e.entityId.split('.')[0] ?? 'unknown',
    }));
    const device: Device = {
      id,
      haDeviceId: input.haDeviceId,
      name: input.name,
      type: input.type,
      status: 'active',
      priority: input.priority ?? 50,
      sensorMask: input.sensorMask ?? 'advanced',
      capabilities: input.capabilities ?? [],
      entities,
      ratedPowerW: input.ratedPowerW,
      minPowerW: input.minPowerW,
      allowAutoShutdown: input.allowAutoShutdown ?? true,
      controllable: input.controllable ?? false,
      tags: input.tags ?? [],
      location: input.location,
      createdAt: now,
      updatedAt: now,
      manuallyAdded: input.manuallyAdded ?? false,
    };
    this.db
      .prepare(
        `INSERT INTO devices (id, ha_device_id, name, type, status, priority, sensor_mask,
          capabilities, entities, rated_power_w, min_power_w, allow_auto_shutdown, controllable,
          tags, location, created_at, updated_at, manually_added)
         VALUES (@id, @haDeviceId, @name, @type, @status, @priority, @sensorMask, @capabilities,
          @entities, @ratedPowerW, @minPowerW, @allowAutoShutdown, @controllable, @tags, @location,
          @createdAt, @updatedAt, @manuallyAdded)`,
      )
      .run({
        id: device.id,
        haDeviceId: device.haDeviceId ?? null,
        name: device.name,
        type: device.type,
        status: device.status,
        priority: device.priority,
        sensorMask: device.sensorMask,
        capabilities: JSON.stringify(device.capabilities),
        entities: JSON.stringify(device.entities),
        ratedPowerW: device.ratedPowerW ?? null,
        minPowerW: device.minPowerW ?? null,
        allowAutoShutdown: device.allowAutoShutdown ? 1 : 0,
        controllable: device.controllable ? 1 : 0,
        tags: JSON.stringify(device.tags),
        location: device.location ?? null,
        createdAt: device.createdAt,
        updatedAt: device.updatedAt,
        manuallyAdded: device.manuallyAdded ? 1 : 0,
      });
    return device;
  }

  update(id: string, patch: DeviceUpdateInput): Device | undefined {
    const existing = this.get(id);
    if (!existing) return undefined;
    const merged: Device = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.db
      .prepare(
        `UPDATE devices SET name=@name, type=@type, status=@status, priority=@priority,
          sensor_mask=@sensorMask, capabilities=@capabilities, entities=@entities,
          rated_power_w=@ratedPowerW, min_power_w=@minPowerW, allow_auto_shutdown=@allowAutoShutdown,
          controllable=@controllable, tags=@tags, location=@location, updated_at=@updatedAt
         WHERE id=@id`,
      )
      .run({
        id,
        name: merged.name,
        type: merged.type,
        status: merged.status,
        priority: merged.priority,
        sensorMask: merged.sensorMask,
        capabilities: JSON.stringify(merged.capabilities),
        entities: JSON.stringify(merged.entities),
        ratedPowerW: merged.ratedPowerW ?? null,
        minPowerW: merged.minPowerW ?? null,
        allowAutoShutdown: merged.allowAutoShutdown ? 1 : 0,
        controllable: merged.controllable ? 1 : 0,
        tags: JSON.stringify(merged.tags),
        location: merged.location ?? null,
        updatedAt: merged.updatedAt,
      });
    return merged;
  }

  remove(id: string): boolean {
    const result = this.db.prepare('DELETE FROM devices WHERE id = ?').run(id);
    return result.changes > 0;
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as c FROM devices').get() as { c: number };
    return row.c;
  }
}
