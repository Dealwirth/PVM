import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PvmBackup } from '@pvm/shared';
import { loadConfig, type ServerConfig } from '../config.js';
import { openDatabase } from '../db/index.js';
import { createContext, type AppContext } from '../context.js';
import { buildApp } from '../api/app.js';

/**
 * End-to-end backup/restore against a real in-memory SQLite database:
 * export excludes the HA token by default, includeSecrets opts in, a restore
 * replaces data transactionally, and a malformed file is rejected (PVM-021)
 * without touching existing data.
 */
let app: FastifyInstance;
let ctx: AppContext;
const auth = { authorization: 'Bearer test-secret-value-at-least-32-chars-long' };

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pvm-backup-'));
  const base = loadConfig();
  const config: ServerConfig = {
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
  const db = openDatabase(config.dbPath);
  ctx = createContext(config, db);
  app = await buildApp(ctx);
});

describe('backup export', () => {
  it('excludes the HA token by default', async () => {
    ctx.settings.update({ ha: { url: 'http://homeassistant.local:8123', token: 'secret-token' } });
    const res = await app.inject({ method: 'GET', url: '/api/backup/export', headers: auth });
    expect(res.statusCode).toBe(200);
    const backup = res.json() as PvmBackup;
    expect(backup.metadata.app).toBe('pvm');
    expect(backup.metadata.includesSecrets).toBe(false);
    expect((backup.settings.ha as { token: string }).token).toBe('');
    expect(backup.tables.devices).toEqual([]);
  });

  it('includes the HA token when secrets=true', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/backup/export?secrets=true',
      headers: auth,
    });
    const backup = res.json() as PvmBackup;
    expect(backup.metadata.includesSecrets).toBe(true);
    expect((backup.settings.ha as { token: string }).token).toBe('secret-token');
  });

  it('reports counts in /backup/info', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/backup/info', headers: auth });
    const body = res.json() as { counts: { devices: number } };
    expect(body.counts.devices).toBe(0);
  });
});

describe('backup restore', () => {
  it('round-trips a device and rejects a malformed file', async () => {
    const device = ctx.devices.create({ name: 'Test PV', type: 'pv', priority: 80 });
    const exported = (
      await app.inject({ method: 'GET', url: '/api/backup/export', headers: auth })
    ).json() as PvmBackup;
    expect(exported.tables.devices).toHaveLength(1);

    // Remove the device, then restore the backup.
    ctx.devices.remove(device.id);
    expect(ctx.devices.list()).toHaveLength(0);

    const restore = await app.inject({
      method: 'POST',
      url: '/api/backup/import',
      headers: auth,
      payload: exported,
    });
    expect(restore.statusCode).toBe(200);
    expect(restore.json()).toMatchObject({ ok: true });
    expect(ctx.devices.list()).toHaveLength(1);

    // A malformed file must be rejected and change nothing.
    const bad = await app.inject({
      method: 'POST',
      url: '/api/backup/import',
      headers: auth,
      payload: { foo: 'bar' },
    });
    expect(bad.statusCode).toBeGreaterThanOrEqual(400);
    expect(bad.json()).toMatchObject({ error: { code: 'PVM-021' } });
    expect(ctx.devices.list()).toHaveLength(1);
  });
});
