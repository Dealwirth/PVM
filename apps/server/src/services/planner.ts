import type { Device, LoadPlan, PlannerInput, PlanSlot } from '@pvm/shared';
import { PvmError, newId, round, stableHash } from '@pvm/shared';
import type { PlanRepository } from '../db/repositories/forecast.js';
import type { DevLog } from './devlog.js';

/**
 * Deterministic load-planning algorithm.
 *
 * Given a residual-PV forecast, device priorities, battery state, weather,
 * calendar events and settings, it produces a schedule of slots describing
 * when each device should run and at what power. Output depends only on the
 * inputs, so it is fully reproducible and testable.
 */
export class PlannerService {
  constructor(
    private readonly repo: PlanRepository,
    private readonly log: DevLog,
  ) {}

  plan(input: PlannerInput): LoadPlan {
    const { forecast, devices, settings } = input;

    if (forecast.points.length === 0) {
      throw new PvmError('PVM-010', { reason: 'empty forecast' });
    }

    // Battery reserve is energy we must keep, expressed in Wh.
    const reserveWh = input.batteryCapacityWh * settings.batteryReserveFraction;
    const usableBatteryWh = Math.max(
      0,
      (input.batteryLevelPercent / 100) * input.batteryCapacityWh - reserveWh,
    );

    // Usable residual budget = residual PV + usable battery, but never below 0.
    let budgetWh = Math.max(0, forecast.totalResidualWh) + usableBatteryWh;

    const conditions: string[] = [];
    if (forecast.totalResidualWh < 0) {
      conditions.push('Reststrom negativ: Defizit über den Zeitraum.');
    }
    if (input.batteryLevelPercent <= settings.batteryReserveFraction * 100) {
      conditions.push('Batterie auf Reserve-Niveau: Ladung wird reduziert.');
    }
    if (input.calendarEvents.some((e) => e.kind === 'holiday')) {
      conditions.push('Urlaub im Kalender: Komfortbedarf reduziert.');
    }

    const schedulable = devices
      .filter((d) => d.status === 'active' && d.priority >= settings.minSchedulePriority)
      .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));

    const slots: PlanSlot[] = [];
    const shutdowns: Array<{ deviceId: string; reason: string }> = [];

    // Positive residual points are the windows we may schedule into.
    const surplusPoints = forecast.points.filter((p) => p.residualWh > 0);

    for (const device of schedulable) {
      const energyNeedWh = this.energyNeed(device, input);
      if (energyNeedWh <= 0) continue;

      if (budgetWh < energyNeedWh) {
        if (device.allowAutoShutdown) {
          shutdowns.push({
            deviceId: device.id,
            reason: `Nicht genug Reststrom (Bedarf ${round(energyNeedWh)} Wh > Budget ${round(budgetWh)} Wh)`,
          });
        }
        continue;
      }

      const slot = this.scheduleDevice(device, energyNeedWh, surplusPoints, settings, conditions);
      if (slot) {
        slots.push(slot);
        budgetWh -= energyNeedWh;
      }
    }

    const plan: LoadPlan = {
      id: newId('plan'),
      generatedAt: new Date().toISOString(),
      start: forecast.start,
      end: forecast.end,
      slots: slots.sort((a, b) => Date.parse(a.start) - Date.parse(b.start)),
      shutdowns,
      conditions,
      inputHash: stableHash({
        forecastId: forecast.id,
        deviceIds: schedulable.map((d) => d.id),
        batteryLevelPercent: input.batteryLevelPercent,
        settings,
      }),
    };

    this.repo.save(plan);
    this.log.info('planner', 'Load plan generated', {
      id: plan.id,
      slots: plan.slots.length,
      shutdowns: plan.shutdowns.length,
      inputHash: plan.inputHash,
    });
    return plan;
  }

  latest(): LoadPlan | undefined {
    return this.repo.latest();
  }

  history(limit = 50): LoadPlan[] {
    return this.repo.history(limit);
  }

  /**
   * Replace the stored plans with an externally supplied batch (e.g. pushed via
   * the ``pvm.update_plan`` HA service or the UI). Returns the applied plans.
   */
  applyPlans(plans: LoadPlan[]): LoadPlan[] {
    if (plans.length === 0) throw new PvmError('PVM-015', { reason: 'no plans supplied' });
    this.repo.replaceAll(plans);
    this.log.info('planner', 'Load plans applied', { count: plans.length });
    return plans;
  }

  private energyNeed(device: Device, input: PlannerInput): number {
    if (device.type === 'pv' || device.type === 'battery') return 0; // producers, not scheduled
    if (device.type === 'wallbox') {
      const commute = input.calendarEvents.find(
        (e) => e.kind === 'commute' || e.kind === 'charging',
      );
      return commute?.expectedEnergyWh ?? (device.ratedPowerW ? device.ratedPowerW * 2 : 7000);
    }
    if (device.type === 'heat_pump') {
      // Prefer pre-heating: use rated power for 2 hours.
      return device.ratedPowerW ? device.ratedPowerW * 2 : 3000;
    }
    if (device.type === 'heater') {
      return device.ratedPowerW ? device.ratedPowerW * 1.5 : 2000;
    }
    return device.ratedPowerW ? device.ratedPowerW : 1000;
  }

  private scheduleDevice(
    device: Device,
    energyNeedWh: number,
    surplusPoints: PlannerInput['forecast']['points'],
    settings: PlannerInput['settings'],
    conditions: string[],
  ): PlanSlot | null {
    if (surplusPoints.length === 0) {
      // No surplus: only allow if priority is very high and grid import permits.
      if (device.priority < 90) return null;
      const start = new Date().toISOString();
      const end = new Date(Date.now() + 3_600_000).toISOString();
      const powerW = Math.min(device.ratedPowerW ?? 2000, settings.maxGridImportW);
      conditions.push(`${device.name}: kein PV-Überschuss, Notbetrieb wegen hoher Priorität.`);
      return {
        deviceId: device.id,
        deviceName: device.name,
        start,
        end,
        powerW,
        priority: device.priority,
        reason: 'Hohe Priorität ohne PV-Überschuss (Notbetrieb).',
      };
    }

    const powerW = device.ratedPowerW ?? 2000;
    const neededHours = Math.max(1, Math.ceil(energyNeedWh / powerW));

    // Greedy: pick the highest-surplus contiguous window that fits neededHours.
    const best = this.findBestWindow(surplusPoints, neededHours);
    if (!best) return null;

    return {
      deviceId: device.id,
      deviceName: device.name,
      start: best.start,
      end: best.end,
      powerW,
      priority: device.priority,
      reason: `PV-Überschuss-Fenster (Ø ${round(best.avgSurplusWh)} Wh/h).`,
    };
  }

  private findBestWindow(
    points: PlannerInput['forecast']['points'],
    hours: number,
  ): { start: string; end: string; avgSurplusWh: number } | null {
    if (points.length < hours) return null;
    let best: { start: string; end: string; avgSurplusWh: number } | null = null;
    for (let i = 0; i + hours <= points.length; i += 1) {
      const window = points.slice(i, i + hours);
      const avg = window.reduce((a, p) => a + p.residualWh, 0) / hours;
      if (!best || avg > best.avgSurplusWh) {
        best = {
          start: window[0]!.timestamp,
          end: new Date(Date.parse(window[window.length - 1]!.timestamp) + 3_600_000).toISOString(),
          avgSurplusWh: avg,
        };
      }
    }
    return best;
  }
}
