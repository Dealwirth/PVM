import { describe, expect, it } from 'vitest';
import type { Device, Forecast, PlannerInput } from '@pvm/shared';
import { PlannerService } from '../services/planner.js';
import { PlanRepository } from '../db/repositories/forecast.js';
import { openDatabase } from '../db/index.js';
import { DevLog } from '../services/devlog.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function makeForecast(overrides: Partial<Forecast> = {}): Forecast {
  const points = Array.from({ length: 12 }, (_, i) => ({
    timestamp: new Date(Date.UTC(2024, 0, 1, i)).toISOString(),
    expectedProductionWh: 1000,
    expectedConsumptionWh: 300,
    residualWh: 700,
    confidence: 0.8,
  }));
  return {
    id: 'fc1',
    method: 'combined',
    horizon: 'day',
    generatedAt: new Date().toISOString(),
    start: points[0]!.timestamp,
    end: points[points.length - 1]!.timestamp,
    points,
    totalProductionWh: 12_000,
    totalConsumptionWh: 3600,
    totalResidualWh: 8400,
    confidence: 0.8,
    ...overrides,
  };
}

function makeDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: 'd1',
    name: 'Wallbox',
    type: 'wallbox',
    status: 'active',
    priority: 80,
    sensorMask: 'power_only',
    capabilities: ['power', 'state'],
    entities: [],
    ratedPowerW: 3000,
    allowAutoShutdown: true,
    controllable: true,
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    manuallyAdded: false,
    ...overrides,
  };
}

function makePlanner(): PlannerService {
  const db = openDatabase(':memory:');
  const log = new DevLog({
    dir: mkdtempSync(join(tmpdir(), 'pvm-test-')),
    level: 'FATAL',
    enabled: false,
  });
  return new PlannerService(new PlanRepository(db), log);
}

function baseInput(overrides: Partial<PlannerInput> = {}): PlannerInput {
  return {
    forecast: makeForecast(),
    devices: [makeDevice()],
    batteryLevelPercent: 50,
    batteryCapacityWh: 10_000,
    weather: [],
    calendarEvents: [],
    settings: {
      batteryReserveFraction: 0.1,
      comfortIsHardLimit: true,
      maxGridImportW: 11_000,
      usePriceSignals: false,
      minSchedulePriority: 20,
    },
    ...overrides,
  };
}

describe('PlannerService', () => {
  it('produces identical plans for identical input (determinism)', () => {
    const planner = makePlanner();
    const a = planner.plan(baseInput());
    const b = planner.plan(baseInput());
    expect(a.slots).toEqual(b.slots);
    expect(a.inputHash).toEqual(b.inputHash);
  });

  it('schedules a high-priority device when surplus exists', () => {
    const planner = makePlanner();
    const plan = planner.plan(baseInput());
    expect(plan.slots.length).toBeGreaterThan(0);
    expect(plan.slots[0]!.deviceId).toBe('d1');
  });

  it('does not schedule producers (pv/battery)', () => {
    const planner = makePlanner();
    const plan = planner.plan(
      baseInput({ devices: [makeDevice({ id: 'pv1', type: 'pv', priority: 100 })] }),
    );
    expect(plan.slots).toHaveLength(0);
  });

  it('recommends shutdown when budget is insufficient', () => {
    const planner = makePlanner();
    const deficitForecast = makeForecast({
      points: makeForecast().points.map((p) => ({ ...p, residualWh: 0, expectedProductionWh: 0 })),
      totalResidualWh: -1000,
      totalProductionWh: 0,
    });
    const plan = planner.plan(
      baseInput({
        forecast: deficitForecast,
        batteryLevelPercent: 5,
        devices: [makeDevice({ priority: 50, ratedPowerW: 10_000 })],
      }),
    );
    expect(plan.slots).toHaveLength(0);
    expect(plan.shutdowns.length).toBe(1);
  });

  it('skips devices below the minimum schedule priority', () => {
    const planner = makePlanner();
    const plan = planner.plan(baseInput({ devices: [makeDevice({ priority: 5 })] }));
    expect(plan.slots).toHaveLength(0);
  });

  it('throws PVM-010 on empty forecast', () => {
    const planner = makePlanner();
    expect(() => planner.plan(baseInput({ forecast: makeForecast({ points: [] }) }))).toThrowError(
      /PVM-010|Ladeplan/i,
    );
  });
});
