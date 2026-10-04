import type { Device, Forecast, LoadPlan } from '@pvm/shared';
import { round } from '@pvm/shared';
import type { DeviceService } from './devices.js';
import type { ForecastService } from './forecast.js';
import type { PlannerService } from './planner.js';
import type { SafetyService } from './safety.js';
import type { SettingsService } from './settings.js';
import type { HaClient } from '../ha/client.js';
import type { DevLog } from './devlog.js';

export interface DashboardSummary {
  generatedAt: string;
  ha: ReturnType<HaClient['getState']>;
  devices: {
    total: number;
    active: number;
    error: number;
    byType: Record<string, number>;
    totalPowerW: number;
  };
  forecast?: {
    method: string;
    horizon: string;
    totalProductionWh: number;
    totalConsumptionWh: number;
    totalResidualWh: number;
    confidence: number;
  };
  plan?: {
    slots: number;
    shutdowns: number;
    start: string;
    end: string;
  };
  safety: {
    recentReactions: number;
    mode: string;
  };
  log: {
    recentErrors: number;
  };
  requiredSettings: ReturnType<SettingsService['requiredStatus']>;
}

export class DashboardService {
  constructor(
    private readonly devices: DeviceService,
    private readonly forecast: ForecastService,
    private readonly planner: PlannerService,
    private readonly safety: SafetyService,
    private readonly settings: SettingsService,
    private readonly ha: HaClient,
    private readonly log: DevLog,
  ) {}

  summary(): DashboardSummary {
    const devices = this.devices.list();
    const byType: Record<string, number> = {};
    for (const d of devices) byType[d.type] = (byType[d.type] ?? 0) + 1;

    const fc = this.forecast.latest();
    const plan = this.planner.latest();
    const safetyEvents = this.safety.list(50);
    const cutoff = Date.now() - 24 * 3_600_000;

    return {
      generatedAt: new Date().toISOString(),
      ha: this.ha.getState(),
      devices: {
        total: devices.length,
        active: devices.filter((d: Device) => d.status === 'active').length,
        error: devices.filter((d: Device) => d.status === 'error').length,
        byType,
        totalPowerW: round(this.devices.currentTotalPowerW(), 1),
      },
      forecast: fc
        ? {
            method: fc.method,
            horizon: fc.horizon,
            totalProductionWh: fc.totalProductionWh,
            totalConsumptionWh: fc.totalConsumptionWh,
            totalResidualWh: fc.totalResidualWh,
            confidence: fc.confidence,
          }
        : undefined,
      plan: plan
        ? {
            slots: plan.slots.length,
            shutdowns: plan.shutdowns.length,
            start: plan.start,
            end: plan.end,
          }
        : undefined,
      safety: {
        recentReactions: safetyEvents.filter((e) => Date.parse(e.timestamp) >= cutoff).length,
        mode: this.settings.get().safety.mode,
      },
      log: {
        recentErrors: this.log.recentErrorCount(),
      },
      requiredSettings: this.settings.requiredStatus(),
    };
  }

  /** Build forecast + plan in one shot using current state. */
  async runPlanningCycle(): Promise<{ forecast: Forecast; plan: LoadPlan }> {
    const settings = this.settings.get();
    const devices = this.devices.list();
    const history = this.devices
      .list()
      .flatMap((d) => this.devices.historyFor(d.id))
      .map((p) => ({
        timestamp: p.timestamp,
        productionWh: p.powerW ?? 0,
        consumptionWh: p.powerW ?? 0,
      }));

    const forecast = this.forecast.generate({
      method: settings.forecast.methods[0] ?? 'combined',
      horizon: 'day',
      history,
      weather: [],
      calendarEvents: [],
      devices: devices.map((d) => ({
        deviceId: d.id,
        type: d.type,
        ratedPowerW: d.ratedPowerW,
      })),
      settings: {
        recencyWeight: settings.forecast.recencyWeight,
        historyDays: settings.forecast.historyDays,
        combinedWeatherWeight: settings.forecast.combinedWeatherWeight,
      },
    });

    const plan = this.planner.plan({
      forecast,
      devices,
      batteryLevelPercent: 50,
      batteryCapacityWh: 10_000,
      weather: [],
      calendarEvents: [],
      settings: {
        batteryReserveFraction: 0.1,
        comfortIsHardLimit: true,
        maxGridImportW: settings.safety.maxGridImportW,
        usePriceSignals: false,
        minSchedulePriority: 20,
      },
    });

    return { forecast, plan };
  }
}
