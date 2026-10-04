import { EventEmitter } from 'node:events';
import type { Device, Severity } from '@pvm/shared';
import { PvmError, getErrorDefinition, newId } from '@pvm/shared';
import type { SafetyRepository } from '../db/repositories/forecast.js';
import type { DeviceRepository } from '../db/repositories/devices.js';
import type { HaClient } from '../ha/client.js';
import type { DevLog } from './devlog.js';
import type { SettingsService } from './settings.js';

export interface SafetyReaction {
  id: string;
  timestamp: string;
  code: string;
  category: string;
  severity: Severity;
  action: string;
  deviceId?: string;
  message: string;
  details?: Record<string, unknown>;
}

interface DeviceSnapshot {
  deviceId: string;
  entityId: string;
  domain: string;
  service: string;
  data?: Record<string, unknown>;
}

/**
 * Safety system: monitors metrics, applies load management, triggers shutdowns
 * on critical errors and performs self-healing by restoring the last good state.
 */
export class SafetyService extends EventEmitter {
  private lastGoodState = new Map<string, DeviceSnapshot>();
  private suspended = new Set<string>();

  constructor(
    private readonly safetyRepo: SafetyRepository,
    private readonly deviceRepo: DeviceRepository,
    private readonly ha: HaClient,
    private readonly settings: SettingsService,
    private readonly log: DevLog,
  ) {
    super();
  }

  /** Evaluate the current power draw and shed low-priority load if needed. */
  async evaluateLoad(totalPowerW: number): Promise<SafetyReaction[]> {
    const s = this.settings.get().safety;
    if (!s.autoShutdown) return [];
    const reactions: SafetyReaction[] = [];

    if (totalPowerW > s.maxGridImportW) {
      this.log.warn('safety', 'Grid import limit exceeded', {
        totalPowerW,
        limit: s.maxGridImportW,
      });
      reactions.push(
        await this.shedLoad(
          totalPowerW - s.maxGridImportW,
          'Netzbezug über Grenzwert: Prioritäten reduziert.',
        ),
      );
    }

    for (const device of this.deviceRepo.list({ status: 'active' })) {
      const power = currentPower(device);
      if (power !== null && power > s.maxDevicePowerW) {
        reactions.push(
          await this.record('PVM-007', 'shutdown', device.id, {
            powerW: power,
            limitW: s.maxDevicePowerW,
          }),
        );
      }
      const temp = currentTemperature(device);
      if (temp !== null && temp > s.maxTemperatureC) {
        reactions.push(
          await this.record('PVM-008', 'shutdown', device.id, {
            temperatureC: temp,
            limitC: s.maxTemperatureC,
          }),
        );
      }
    }
    return reactions.filter((r): r is SafetyReaction => Boolean(r));
  }

  /** Reduce load by switching off the lowest-priority auto-shutdown devices. */
  async shedLoad(excessW: number, reason: string): Promise<SafetyReaction> {
    const candidates = this.deviceRepo
      .list({ status: 'active' })
      .filter((d) => d.allowAutoShutdown && d.controllable && currentPower(d) !== null)
      .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));

    let shed = 0;
    for (const device of candidates) {
      if (shed >= excessW) break;
      await this.turnOff(device, reason);
      shed += currentPower(device) ?? 0;
    }

    return this.record('PVM-007', 'load_shed', undefined, {
      excessW,
      shedW: shed,
      reason,
    });
  }

  /** Turn a device off via its controllable state entity. */
  async turnOff(device: Device, reason: string): Promise<void> {
    const entity =
      device.entities.find((e) => e.role === 'state' && e.controllable) ??
      device.entities.find((e) => e.controllable);
    if (!entity) return;
    try {
      const domain = entity.domain === 'input_boolean' ? 'input_boolean' : entity.domain;
      await this.ha.callService(domain, 'turn_off', entity.entityId);
      this.suspended.add(device.id);
      this.log.warn('safety', 'Device switched off', { deviceId: device.id, reason });
    } catch (err) {
      this.log.error(
        'safety',
        'Failed to switch off device',
        { deviceId: device.id, error: (err as Error).message },
        'PVM-006',
      );
    }
  }

  /** Record a last-good state so self-healing can restore it. */
  captureGoodState(device: Device): void {
    const entity = device.entities.find((e) => e.controllable);
    if (!entity) return;
    this.lastGoodState.set(device.id, {
      deviceId: device.id,
      entityId: entity.entityId,
      domain: entity.domain,
      service: 'turn_on',
    });
  }

  /** Attempt to restore devices that were suspended by safety reactions. */
  async selfHeal(): Promise<SafetyReaction[]> {
    const s = this.settings.get().general;
    if (!s.selfHealing) return [];
    const reactions: SafetyReaction[] = [];
    for (const deviceId of [...this.suspended]) {
      const snapshot = this.lastGoodState.get(deviceId);
      const device = this.deviceRepo.get(deviceId);
      if (!device || !snapshot) {
        this.suspended.delete(deviceId);
        continue;
      }
      try {
        await this.ha.callService(snapshot.domain, snapshot.service, snapshot.entityId);
        this.suspended.delete(deviceId);
        reactions.push(
          this.record('PVM-018', 'self_healed', deviceId, { entityId: snapshot.entityId }),
        );
        this.log.info('safety', 'Device restored via self-healing', { deviceId });
      } catch (err) {
        this.log.error(
          'safety',
          'Self-healing failed, notifying user',
          { deviceId, error: (err as Error).message },
          'PVM-006',
        );
        reactions.push(
          this.record('PVM-018', 'self_heal_failed', deviceId, {
            error: (err as Error).message,
          }),
        );
      }
    }
    return reactions;
  }

  /** Handle any error; decide whether it triggers a shutdown. */
  async handleError(error: unknown): Promise<SafetyReaction | null> {
    const code = error instanceof PvmError ? error.code : 'PVM-020';
    const def = getErrorDefinition(code);
    const severity = def.severity;

    if (def.triggersShutdown && this.settings.get().safety.autoShutdown) {
      const reaction = this.record(code, 'shutdown', undefined, {
        message: error instanceof Error ? error.message : String(error),
      });
      this.emit('shutdown', reaction);
      return reaction;
    }

    if (severity === 'critical' || severity === 'high') {
      return this.record(code, 'logged', undefined, {
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return null;
  }

  /** Persist a safety reaction and emit it to listeners. */
  record(
    code: string,
    action: string,
    deviceId: string | undefined,
    details?: Record<string, unknown>,
  ): SafetyReaction {
    const def = getErrorDefinition(code);
    const reaction: SafetyReaction = {
      id: newId('safety'),
      timestamp: new Date().toISOString(),
      code: def.code,
      category: def.category,
      severity: def.severity,
      action,
      deviceId,
      message: def.description,
      details,
    };
    this.safetyRepo.add(reaction);
    this.emit('reaction', reaction);
    return reaction;
  }

  list(limit = 200): SafetyReaction[] {
    return this.safetyRepo.list(limit).map((e) => ({
      ...e,
      severity: e.severity as Severity,
    }));
  }

  isSuspended(deviceId: string): boolean {
    return this.suspended.has(deviceId);
  }
}

function currentPower(device: Device): number | null {
  const entity = device.entities.find((e) => e.role === 'power');
  const value = entity?.value;
  if (typeof value !== 'number') return null;
  return entity?.unit?.toLowerCase() === 'kw' ? value * 1000 : value;
}

function currentTemperature(device: Device): number | null {
  const entity = device.entities.find((e) => e.role === 'temperature');
  const value = entity?.value;
  return typeof value === 'number' ? value : null;
}
