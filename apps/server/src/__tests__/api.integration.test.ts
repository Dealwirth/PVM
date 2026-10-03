import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { loadConfig, type ServerConfig } from '../config.js';
import { openDatabase } from '../db/index.js';
import { createContext } from '../context.js';
import { buildApp } from '../api/app.js';

function testConfig(): ServerConfig {
  const dir = mkdtempSync(join(tmpdir(), 'pvm-it-'));
  const base = loadConfig();
  return {
    ...base,
    env: 'test',
    apiSecret: 'test-secret-value-at-least-32-chars-long',
    dbPath: ':memory:',
    dataDir: dir,
    addonsDir: join(dir, 'addons'),
    logsDir: join(dir, 'logs'),
    haUrl: '',
    haToken: '',
    corsOrigins: [],
  };
}

let app: FastifyInstance;
let token: string;

beforeAll(async () => {
  const config = testConfig();
  const db = openDatabase(config.dbPath);
  const ctx = createContext(config, db);
  app = await buildApp(ctx);
  await app.ready();
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { token: config.apiSecret },
  });
  token = (res.json() as { token: string }).token;
});

function auth(): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

describe('API integration', () => {
  it('exposes a health endpoint without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });

  it('rejects unauthenticated access', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/devices' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: { code: 'PVM-004' } });
  });

  it('lists devices with auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/devices', headers: auth() });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it('creates, updates and deletes a device', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/devices',
      headers: auth(),
      payload: { name: 'Test Wallbox', type: 'wallbox', priority: 70, ratedPowerW: 11000 },
    });
    expect(create.statusCode).toBe(201);
    const device = create.json() as { id: string };
    expect(device.id).toBeTruthy();

    const update = await app.inject({
      method: 'PUT',
      url: `/api/devices/${device.id}`,
      headers: auth(),
      payload: { priority: 90 },
    });
    expect(update.statusCode).toBe(200);
    expect((update.json() as { priority: number }).priority).toBe(90);

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/devices/${device.id}`,
      headers: auth(),
    });
    expect(del.statusCode).toBe(204);
  });

  it('validates device input (PVM-015)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/devices',
      headers: auth(),
      payload: { name: '', type: 'nope' },
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: { code: string } }).error.code).toBe('PVM-015');
  });

  it('returns 404 for a missing device (PVM-005)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/devices/does-not-exist',
      headers: auth(),
    });
    expect(res.statusCode).toBe(404);
    expect((res.json() as { error: { code: string } }).error.code).toBe('PVM-005');
  });

  it('returns required-settings status', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/settings/required', headers: auth() });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { complete: boolean; missing: unknown[] };
    expect(body.complete).toBe(false);
    expect(body.missing.length).toBeGreaterThan(0);
  });

  it('updates settings and bumps revision', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: auth(),
      payload: { general: { language: 'en' } },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { general: { language: string }; revision: number };
    expect(body.general.language).toBe('en');
    expect(body.revision).toBeGreaterThan(0);
  });

  it('blocks addon install until required settings are complete (PVM-001)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/addons/install',
      headers: auth(),
      payload: { source: 'https://github.com/example/addon' },
    });
    expect(res.statusCode).toBe(500);
    expect((res.json() as { error: { code: string } }).error.code).toBe('PVM-001');
  });

  it('serves the built-in store registry', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/addons/store', headers: auth() });
    expect(res.statusCode).toBe(200);
    expect((res.json() as unknown[]).length).toBeGreaterThan(0);
  });

  it('serves the error catalog', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/errors/catalog', headers: auth() });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('PVM-001');
  });

  it('exports dev-log as CSV', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/logs/export?format=csv',
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
  });

  it('reports dev-log stats and clears the buffer', async () => {
    const stats = await app.inject({ method: 'GET', url: '/api/logs/stats', headers: auth() });
    expect(stats.statusCode).toBe(200);
    expect(stats.json()).toHaveProperty('byLevel');

    const clear = await app.inject({ method: 'DELETE', url: '/api/logs', headers: auth() });
    expect(clear.statusCode).toBe(204);
  });

  it('dispatches HA service calls through the bridge (get_devices)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/ha/services/get_devices',
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it('rejects unknown HA bridge services (PVM-020)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/ha/services/does_not_exist',
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode).toBe(500);
    expect((res.json() as { error: { code: string } }).error.code).toBe('PVM-020');
  });

  it('validates HA service payloads (PVM-015)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/ha/services/set_device_power',
      headers: auth(),
      payload: { device_id: 'dev1', power: 'not-a-number' },
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: { code: string } }).error.code).toBe('PVM-015');
  });

  it('accepts a valid HA set_device_power payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/ha/services/set_device_power',
      headers: auth(),
      payload: { device_id: 'dev1', power: 11000 },
    });
    // Device does not exist, but the payload passed validation (no PVM-015).
    expect(res.statusCode).not.toBe(400);
  });

  it('applies a load plan pushed through the HA bridge', async () => {
    const plan = {
      id: 'plan-ha-1',
      generatedAt: '2026-10-03T12:00:00Z',
      start: '2026-10-03T12:00:00Z',
      end: '2026-10-03T18:00:00Z',
      slots: [
        {
          deviceId: 'dev1',
          deviceName: 'Wallbox',
          start: '2026-10-03T12:00:00Z',
          end: '2026-10-03T14:00:00Z',
          powerW: 11000,
          priority: 80,
          reason: 'PV surplus window.',
        },
      ],
      shutdowns: [],
      conditions: [],
      inputHash: 'abc123',
    };
    const applied = await app.inject({
      method: 'POST',
      url: '/api/ha/services/update_plan',
      headers: auth(),
      payload: { plan },
    });
    expect(applied.statusCode).toBe(200);
    expect((applied.json() as Array<{ id: string }>)[0]?.id).toBe('plan-ha-1');

    const latest = await app.inject({
      method: 'GET',
      url: '/api/plan/latest',
      headers: auth(),
    });
    expect((latest.json() as { id: string }).id).toBe('plan-ha-1');
  });

  it('rejects an update_plan payload without a plan (PVM-015)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/ha/services/update_plan',
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: { code: string } }).error.code).toBe('PVM-015');
  });

  it('validates forecast input and rejects malformed payloads (PVM-015)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/forecast/generate',
      headers: auth(),
      payload: { horizon: 'day' },
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: { code: string } }).error.code).toBe('PVM-015');
  });

  it('generates a deterministic forecast for a valid payload', async () => {
    const payload = {
      method: 'combined',
      horizon: 'day',
      history: [{ timestamp: '2026-10-02T12:00:00Z', productionWh: 1000, consumptionWh: 500 }],
      weather: [
        {
          timestamp: '2026-10-03T12:00:00Z',
          irradianceWm2: 500,
          temperatureC: 20,
          cloudCover: 0.2,
        },
      ],
      calendarEvents: [],
      devices: [{ deviceId: 'dev1', type: 'pv', ratedPowerW: 5000 }],
      settings: { recencyWeight: 0.5, historyDays: 30, combinedWeatherWeight: 0.5 },
    };
    const first = await app.inject({
      method: 'POST',
      url: '/api/forecast/generate',
      headers: auth(),
      payload,
    });
    expect(first.statusCode).toBe(200);
    const body = first.json() as {
      method: string;
      horizon: string;
      points: unknown[];
      totalResidualWh: number;
      totalProductionWh: number;
    };
    expect(body.method).toBe('combined');
    expect(body.points.length).toBeGreaterThan(0);

    const second = await app.inject({
      method: 'POST',
      url: '/api/forecast/generate',
      headers: auth(),
      payload,
    });
    const again = second.json() as typeof body;
    // id/generatedAt/window start depend on wall-clock time; the modelled
    // values must be identical for identical input.
    expect(again.points).toEqual(body.points);
    expect(again.totalResidualWh).toBe(body.totalResidualWh);
    expect(again.totalProductionWh).toBe(body.totalProductionWh);
  });
});
