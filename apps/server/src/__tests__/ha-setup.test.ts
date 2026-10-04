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
 * End-to-end setup assistant flow against a real fake Home Assistant HTTP
 * server: token entry, non-persisting connection test, URL auto-detection via
 * the HA component's detect endpoint, and masked-token persistence.
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
  haUrl = `http://127.0.0.1:${port}`;

  const dir = mkdtempSync(join(tmpdir(), 'pvm-setup-'));
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

describe('HA setup assistant', () => {
  it('verifies a URL/token pair without persisting it', async () => {
    const ok = await app.inject({
      method: 'POST',
      url: '/api/settings/test-ha',
      headers: auth(),
      payload: { url: haUrl, token: 'good-token' },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ ok: true, haVersion: '2026.9.4', url: haUrl });

    const bad = await app.inject({
      method: 'POST',
      url: '/api/settings/test-ha',
      headers: auth(),
      payload: { url: haUrl, token: 'wrong-token' },
    });
    expect(bad.json()).toMatchObject({ ok: false, errorCode: 'PVM-003' });

    // Nothing was saved by the tests above.
    const settings = await app.inject({ method: 'GET', url: '/api/settings', headers: auth() });
    expect((settings.json() as { ha: { url: string } }).ha.url).toBe('');
  });

  it('stores the token masked and marks it as set', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: auth(),
      payload: { ha: { token: 'good-token' } },
    });
    const body = res.json() as { ha: { token: string; tokenSet: boolean } };
    expect(body.ha.token).not.toContain('good-token');
    expect(body.ha.tokenSet).toBe(true);
  });

  it('auto-detects and stores the HA URL from component candidates', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/ha/internal/detect',
      headers: auth(),
      payload: { candidates: ['http://unreachable.invalid:8123', haUrl] },
    });
    expect(res.json()).toMatchObject({ ok: true, url: haUrl });

    const settings = await app.inject({ method: 'GET', url: '/api/settings', headers: auth() });
    expect((settings.json() as { ha: { url: string } }).ha.url).toBe(haUrl);

    const required = await app.inject({
      method: 'GET',
      url: '/api/settings/required',
      headers: auth(),
    });
    expect((required.json() as { complete: boolean }).complete).toBe(true);
  });

  it('never overwrites the stored token with the UI mask', async () => {
    await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: auth(),
      payload: { ha: { token: '••••••••' } },
    });
    // The stored token still works, so the mask did not replace it.
    const test = await app.inject({
      method: 'POST',
      url: '/api/settings/test-ha',
      headers: auth(),
      payload: {},
    });
    expect(test.json()).toMatchObject({ ok: true });
  });

  it('persists setup dismissal so the assistant does not reappear', async () => {
    await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: auth(),
      payload: { general: { setupDismissed: true } },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/settings/required',
      headers: auth(),
    });
    expect((res.json() as { setupDismissed: boolean }).setupDismissed).toBe(true);
  });
});
