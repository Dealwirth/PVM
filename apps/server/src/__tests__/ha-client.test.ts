import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocketServer, type WebSocket } from 'ws';
import { HaClient } from '../ha/client.js';
import { DevLog } from '../services/devlog.js';

/**
 * In-process fake Home Assistant exposing the real REST and WebSocket APIs
 * the client talks to. The client itself runs unmodified, so this exercises
 * the actual HTTP/WS transport, auth handshake and command dispatch.
 */
let httpServer: Server;
let wss: WebSocketServer;
let baseUrl: string;
/** When true the fake HA only understands the legacy unprefixed commands. */
let legacyRegistryMode = false;

const STATES = [
  {
    entity_id: 'sensor.pv_power',
    state: '4321',
    attributes: {
      device_class: 'power',
      unit_of_measurement: 'W',
      friendly_name: 'PV Power',
    },
    last_changed: '2026-10-03T12:00:00Z',
    last_updated: '2026-10-03T12:00:00Z',
  },
];

const SERVICES = [
  {
    domain: 'pvm',
    services: {
      set_device_power: {
        name: 'Set device power',
        description: '',
        fields: { device_id: { name: 'Device', description: '' } },
      },
    },
  },
];

beforeAll(async () => {
  httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.url === '/api/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'API running.' }));
      return;
    }
    if (req.url === '/api/config') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ version: '2026.9.4', location_name: 'Test HA', unit_system: {} }));
      return;
    }
    if (req.url === '/api/states') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(STATES));
      return;
    }
    if (req.url === '/api/services') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(SERVICES));
      return;
    }
    if (req.url?.startsWith('/api/services/')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
      return;
    }
    res.writeHead(404);
    res.end('{}');
  });

  wss = new WebSocketServer({ server: httpServer });
  wss.on('connection', (socket: WebSocket) => {
    socket.send(JSON.stringify({ type: 'auth_required', ha_version: '2026.9.4' }));
    socket.on('message', (raw: Buffer) => {
      const msg = JSON.parse(raw.toString()) as {
        id?: number;
        type?: string;
        access_token?: string;
      };
      if (msg.type === 'auth') {
        if (msg.access_token === 'good-token') {
          socket.send(JSON.stringify({ type: 'auth_ok', ha_version: '2026.9.4' }));
        } else {
          socket.send(JSON.stringify({ type: 'auth_invalid', message: 'Invalid access token' }));
        }
        return;
      }
      if (msg.type === 'subscribe_events') {
        socket.send(JSON.stringify({ id: msg.id, type: 'result', success: true, result: null }));
        return;
      }
      if (msg.type === 'config/device_registry/list' && !legacyRegistryMode) {
        socket.send(
          JSON.stringify({
            id: msg.id,
            type: 'result',
            success: true,
            result: [
              { id: 'dev-1', name: 'Inverter', name_by_user: 'My Inverter', identifiers: [] },
            ],
          }),
        );
        return;
      }
      if (msg.type === 'config/entity_registry/list' && !legacyRegistryMode) {
        socket.send(
          JSON.stringify({
            id: msg.id,
            type: 'result',
            success: true,
            result: [{ entity_id: 'sensor.pv_power', device_id: 'dev-1', platform: 'pvm' }],
          }),
        );
        return;
      }
      if (msg.type === 'device_registry/list' && legacyRegistryMode) {
        socket.send(
          JSON.stringify({
            id: msg.id,
            type: 'result',
            success: true,
            result: [{ id: 'legacy-1', name: 'Legacy Inverter', identifiers: [] }],
          }),
        );
        return;
      }
      // Everything else, including unprefixed legacy registry names, is unknown.
      socket.send(
        JSON.stringify({
          id: msg.id,
          type: 'result',
          success: false,
          error: { code: 'unknown_command', message: 'Unknown command.' },
        }),
      );
    });
  });

  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const addr = httpServer.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => wss.close(() => resolve()));
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

function makeClient(token = 'good-token', localOnly = true): HaClient {
  const log = new DevLog({ dir: mkdtempSync(join(tmpdir(), 'pvm-ha-')) });
  return new HaClient({
    url: baseUrl,
    token,
    localOnly,
    reconnectBaseMs: 50,
    log,
  });
}

describe('Home Assistant client (real transport)', () => {
  it('reports a successful connection against the REST API', async () => {
    const result = await makeClient().testConnection();
    expect(result.ok).toBe(true);
    expect(result.config?.version).toBe('2026.9.4');
  });

  it('fetches entity states', async () => {
    const states = await makeClient().getStates();
    expect(states).toHaveLength(1);
    expect(states[0]?.entity_id).toBe('sensor.pv_power');
    expect(states[0]?.state).toBe('4321');
  });

  it('lists available services', async () => {
    const services = await makeClient().getServices();
    const domains = services.map((s) => s.domain);
    expect(domains).toContain('pvm');
  });

  it('rejects non-local URLs when localOnly is enabled (PVM-016)', async () => {
    const log = new DevLog({ dir: mkdtempSync(join(tmpdir(), 'pvm-ha-')) });
    const client = new HaClient({
      url: 'http://example.com:8123',
      token: 'good-token',
      localOnly: true,
      reconnectBaseMs: 50,
      log,
    });
    await expect(client.getStates()).rejects.toMatchObject({ code: 'PVM-016' });
  });

  it('surfaces an invalid token as PVM-003', async () => {
    await expect(makeClient('bad-token').getDeviceRegistry()).rejects.toMatchObject({
      code: 'PVM-003',
    });
  });

  it('uses the prefixed registry command and falls back only when needed', async () => {
    const devices = await makeClient().getDeviceRegistry();
    expect(devices).toHaveLength(1);
    expect(devices[0]?.name_by_user).toBe('My Inverter');

    const entities = await makeClient().getEntityRegistry();
    expect(entities[0]?.entity_id).toBe('sensor.pv_power');
  });

  it('falls back to legacy registry commands on older Home Assistant', async () => {
    legacyRegistryMode = true;
    try {
      const devices = await makeClient().getDeviceRegistry();
      expect(devices).toHaveLength(1);
      expect(devices[0]?.id).toBe('legacy-1');
    } finally {
      legacyRegistryMode = false;
    }
  });
});
