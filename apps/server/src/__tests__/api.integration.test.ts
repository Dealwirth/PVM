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
});
