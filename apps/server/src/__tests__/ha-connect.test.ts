import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { loadConfig, type ServerConfig } from '../config.js';
import { openDatabase } from '../db/index.js';
import { createContext } from '../context.js';
import { buildApp } from '../api/app.js';

/**
 * Connection flows that must never dead-end:
 *
 *  1. A public HA URL (DuckDNS/Nabu Casa) is verified and allowed in one step
 *     via `allowRemote`, then remembered (no manual retry loop).
 *  2. When PVM cannot reach HA directly, the HA integration can push a
 *     snapshot (`/api/ha/internal/ingest`) and PVM works in integration mode
 *     without an HA token.
 *
 * `0.0.0.0` is used as the "public" host: it is not local per `isLocalUrl`,
 * yet it reaches the loopback listener, so the test exercises the real path.
 */
let haServer: Server;
let haUrl: string;
let app: FastifyInstance;
let token: string;

const HA_CONFIG = { version: '2026.9.4', location_name: 'Test Home', unit_system: {} };

beforeAll(async () => {
  haServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    const authorized = req.headers.authorization === 'Bearer good-token';
    if (req.url === '/api/config') {
      if (!authorized) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Unauthorized' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(HA_CONFIG));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end('{}');
  });
  await new Promise<void>((resolve) => haServer.listen(0, '127.0.0.1', resolve));
  const addr = haServer.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  haUrl = `http://0.0.0.0:${port}`;

  const dir = mkdtempSync(join(tmpdir(), 'pvm-connect-'));
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
  app = await buildApp(createContext(config, db));
  await app.ready();
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { token: config.apiSecret },
  });
  token = (res.json() as { token: string }).token;
});

afterAll(async () => {
  await app.close();
  await new Promise<void>((resolve) => haServer.close(() => resolve()));
});

function auth(): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

describe('public HA URL is verified and allowed in one step', () => {
  it('blocks the public URL first (PVM-016, publicUrl) and succeeds with allowRemote', async () => {
    const blocked = await app.inject({
      method: 'POST',
      url: '/api/settings/test-ha',
      headers: auth(),
      payload: { url: haUrl, token: 'good-token' },
    });
    expect(blocked.json()).toMatchObject({ ok: false, errorCode: 'PVM-016', publicUrl: true });

    const allowed = await app.inject({
      method: 'POST',
      url: '/api/settings/test-ha',
      headers: auth(),
      payload: { url: haUrl, token: 'good-token', allowRemote: true },
    });
    expect(allowed.json()).toMatchObject({ ok: true, url: haUrl, mode: 'api' });

    // The choice is remembered: the guard is off and the URL can be saved.
    const settings = await app.inject({ method: 'GET', url: '/api/settings', headers: auth() });
    expect((settings.json() as { ha: { localOnly: boolean } }).ha.localOnly).toBe(false);
  });

  it('auto-detects a pushed public candidate (integration detect)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/ha/internal/detect',
      headers: auth(),
      payload: { candidates: [haUrl], token: 'good-token' },
    });
    expect(res.json()).toMatchObject({ ok: true, url: haUrl });
  });
});

describe('integration mode (no direct HA API)', () => {
  it('reports PVM-022 before any snapshot has been pushed', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/settings/test-ha',
      headers: auth(),
      payload: { requireIntegration: true },
    });
    expect(res.json()).toMatchObject({ ok: false, errorCode: 'PVM-022' });
  });

  it('accepts a snapshot and then reports the integration as connected', async () => {
    const ingest = await app.inject({
      method: 'POST',
      url: '/api/ha/internal/ingest',
      headers: auth(),
      payload: {
        haVersion: '2026.9.4',
        locationName: 'Test Home',
        states: [
          {
            entity_id: 'sensor.pv_power',
            state: '1234',
            attributes: { unit_of_measurement: 'W', device_class: 'power' },
            last_changed: '2026-09-30T10:00:00Z',
            last_updated: '2026-09-30T10:00:00Z',
          },
        ],
        deviceRegistry: [{ id: 'dev1', name: 'PV' }],
        entityRegistry: [{ entity_id: 'sensor.pv_power', device_id: 'dev1' }],
      },
    });
    expect(ingest.json()).toMatchObject({
      ok: true,
      counts: { states: 1, devices: 1, entities: 1 },
    });

    const test = await app.inject({
      method: 'POST',
      url: '/api/settings/test-ha',
      headers: auth(),
      payload: { requireIntegration: true },
    });
    expect(test.json()).toMatchObject({ ok: true, mode: 'integration', haVersion: '2026.9.4' });
  });

  it('does not require an HA URL or token once the integration is connected', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/settings/required', headers: auth() });
    const body = res.json() as { missing: Array<{ key: string }> };
    expect(body.missing.map((m) => m.key)).not.toContain('ha.token');
    expect(body.missing.map((m) => m.key)).not.toContain('ha.url');
  });
});
