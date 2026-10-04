import { EventEmitter } from 'node:events';
import { request } from 'undici';
import WebSocket from 'ws';
import type {
  HaConfig,
  HaConnectionState,
  HaDeviceRegistryEntry,
  HaEntityRegistryEntry,
  HaHistoryPoint,
  HaServiceDomain,
  HaState,
} from '@pvm/shared';
import { PvmError, isLocalUrl } from '@pvm/shared';
import type { DevLog } from '../services/devlog.js';

export interface HaClientOptions {
  url: string;
  token: string;
  localOnly: boolean;
  reconnectBaseMs: number;
  log: DevLog;
}

/**
 * Home Assistant REST + WebSocket client.
 *
 * The token never leaves the server; all calls are made server-side only.
 * Non-local URLs are rejected when `localOnly` is enabled.
 */
export class HaClient extends EventEmitter {
  private state: HaConnectionState;
  private ws?: WebSocket;
  private reconnectTimer?: NodeJS.Timeout;
  private reconnectAttempts = 0;
  private nextMessageId = 1;
  private closing = false;
  private readonly pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();

  constructor(private opts: HaClientOptions) {
    super();
    this.state = { connected: false, url: opts.url };
  }

  configure(opts: Partial<HaClientOptions>): void {
    this.opts = { ...this.opts, ...opts };
    this.state.url = this.opts.url;
  }

  getState(): HaConnectionState {
    return { ...this.state };
  }

  private baseUrl(): string {
    const url = this.opts.url.replace(/\/+$/, '');
    if (!url) throw new PvmError('PVM-001', { field: 'ha.url' });
    if (this.opts.localOnly && !isLocalUrl(url)) {
      throw new PvmError('PVM-016', { url });
    }
    return url;
  }

  private headers(): Record<string, string> {
    if (!this.opts.token) throw new PvmError('PVM-001', { field: 'ha.token' });
    return {
      Authorization: `Bearer ${this.opts.token}`,
      'Content-Type': 'application/json',
    };
  }

  private async rest<T>(path: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<T> {
    const base = this.baseUrl();
    let res;
    try {
      res = await request(`${base}${path}`, {
        method,
        headers: this.headers(),
        body: body === undefined ? undefined : JSON.stringify(body),
        headersTimeout: 15_000,
        bodyTimeout: 30_000,
      });
    } catch (err) {
      this.state.lastError = (err as Error).message;
      this.state.lastErrorAt = new Date().toISOString();
      throw new PvmError('PVM-002', { path, error: (err as Error).message });
    }
    if (res.statusCode === 401 || res.statusCode === 403) {
      throw new PvmError('PVM-003', { status: res.statusCode });
    }
    if (res.statusCode >= 400) {
      const text = await res.body.text();
      throw new PvmError('PVM-002', { status: res.statusCode, body: text.slice(0, 500) });
    }
    if (res.statusCode === 204) return undefined as T;
    return (await res.body.json()) as T;
  }

  async testConnection(): Promise<{ ok: boolean; config?: HaConfig; error?: string }> {
    try {
      const cfg = await this.rest<HaConfig>('/api/config');
      this.state.connected = true;
      this.state.lastConnectedAt = new Date().toISOString();
      this.state.haVersion = cfg.version;
      return { ok: true, config: cfg };
    } catch (err) {
      this.state.connected = false;
      this.state.lastError = (err as Error).message;
      this.state.lastErrorAt = new Date().toISOString();
      return { ok: false, error: (err as Error).message };
    }
  }

  async getConfig(): Promise<HaConfig> {
    return this.rest<HaConfig>('/api/config');
  }

  async getStates(): Promise<HaState[]> {
    return this.rest<HaState[]>('/api/states');
  }

  async getStateById(entityId: string): Promise<HaState> {
    return this.rest<HaState>(`/api/states/${encodeURIComponent(entityId)}`);
  }

  async getServices(): Promise<HaServiceDomain[]> {
    return this.rest<HaServiceDomain[]>('/api/services');
  }

  async getHistory(entityId: string, startIso: string, endIso?: string): Promise<HaHistoryPoint[]> {
    const params = new URLSearchParams({ filter_entity_id: entityId });
    if (endIso) params.set('end_time', endIso);
    const path = `/api/history/period/${encodeURIComponent(startIso)}?${params.toString()}`;
    const result = await this.rest<HaHistoryPoint[][]>(path);
    return result.flat();
  }

  async callService(
    domain: string,
    service: string,
    entityId?: string,
    data?: Record<string, unknown>,
  ): Promise<unknown> {
    const payload: Record<string, unknown> = { ...(data ?? {}) };
    if (entityId) payload.entity_id = entityId;
    return this.rest(`/api/services/${domain}/${service}`, 'POST', payload);
  }

  /**
   * Registry data is only available over the authenticated WebSocket API.
   * We open a short-lived connection, fetch, then close.
   *
   * Commands are tried with the modern ``config/`` prefix first and fall back
   * to the legacy unprefixed name, so the integration works across HA versions.
   */
  async getRegistry<T>(
    type: 'device_registry/list' | 'entity_registry/list' | 'area_registry/list',
  ): Promise<T[]> {
    const ws = await this.connectWs();
    try {
      const candidates = type.startsWith('config/') ? [type] : [`config/${type}`, type];
      let lastError: unknown;
      for (const command of candidates) {
        try {
          return await this.wsCommand<T[]>(ws, { type: command });
        } catch (err) {
          lastError = err;
          if (!isUnknownCommand(err)) throw err;
        }
      }
      throw lastError ?? new PvmError('PVM-002', { error: 'registry command failed' });
    } finally {
      ws.close();
    }
  }

  async getDeviceRegistry(): Promise<HaDeviceRegistryEntry[]> {
    return this.getRegistry<HaDeviceRegistryEntry>('device_registry/list');
  }

  async getEntityRegistry(): Promise<HaEntityRegistryEntry[]> {
    return this.getRegistry<HaEntityRegistryEntry>('entity_registry/list');
  }

  private connectWs(): Promise<WebSocket> {
    const base = this.baseUrl().replace(/^http/, 'ws');
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${base}/api/websocket`);
      const timeout = setTimeout(() => {
        ws.terminate();
        reject(new PvmError('PVM-002', { reason: 'websocket timeout' }));
      }, 15_000);

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString()) as { type: string; [k: string]: unknown };
        if (msg.type === 'auth_required') {
          ws.send(JSON.stringify({ type: 'auth', access_token: this.opts.token }));
        } else if (msg.type === 'auth_ok') {
          clearTimeout(timeout);
          resolve(ws);
        } else if (msg.type === 'auth_invalid') {
          clearTimeout(timeout);
          ws.close();
          reject(new PvmError('PVM-003', {}));
        }
      });
      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(new PvmError('PVM-002', { error: err.message }));
      });
    });
  }

  private wsCommand<T>(ws: WebSocket, payload: Record<string, unknown>): Promise<T> {
    const id = this.nextMessageId++;
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new PvmError('PVM-002', { reason: 'ws command timeout' }));
      }, 20_000);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timeout);
          resolve(v as T);
        },
        reject: (e) => {
          clearTimeout(timeout);
          reject(e);
        },
      });
      ws.send(JSON.stringify({ id, ...payload }));
      const onMessage = (raw: WebSocket.RawData): void => {
        const msg = JSON.parse(raw.toString()) as {
          id?: number;
          type: string;
          success?: boolean;
          result?: unknown;
          error?: { message: string; code?: string };
        };
        if (msg.id !== id) return;
        ws.off('message', onMessage);
        const p = this.pending.get(id);
        this.pending.delete(id);
        if (!p) return;
        if (msg.success === false) {
          p.reject(new PvmError('PVM-002', { error: msg.error?.message, code: msg.error?.code }));
        } else {
          p.resolve(msg.result);
        }
      };
      ws.on('message', onMessage);
    });
  }

  /** Start a persistent WebSocket connection for live state updates. */
  startStateStream(): void {
    this.closing = false;
    this.connectStream();
  }

  private connectStream(): void {
    if (this.closing) return;
    let base: string;
    try {
      base = this.baseUrl().replace(/^http/, 'ws');
    } catch (err) {
      this.opts.log.error('ha', 'Cannot start state stream', {
        error: (err as Error).message,
      });
      return;
    }
    const ws = new WebSocket(`${base}/api/websocket`);
    this.ws = ws;

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString()) as {
        type: string;
        id?: number;
        event?: { event_type: string; data: { entity_id: string; new_state: HaState } };
        result?: unknown;
        success?: boolean;
        error?: { message: string };
      };
      if (msg.type === 'auth_required') {
        ws.send(JSON.stringify({ type: 'auth', access_token: this.opts.token }));
      } else if (msg.type === 'auth_ok') {
        this.state.connected = true;
        this.state.lastConnectedAt = new Date().toISOString();
        this.reconnectAttempts = 0;
        ws.send(
          JSON.stringify({
            id: this.nextMessageId++,
            type: 'subscribe_events',
            event_type: 'state_changed',
          }),
        );
        this.emit('connected');
      } else if (msg.type === 'auth_invalid') {
        this.opts.log.error('ha', 'WebSocket auth invalid', {}, 'PVM-003');
        ws.close();
      } else if (msg.type === 'event' && msg.event?.event_type === 'state_changed') {
        this.emit('state_changed', msg.event.data);
      } else if (msg.id !== undefined && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        if (msg.success === false) p.reject(new PvmError('PVM-002', { error: msg.error?.message }));
        else p.resolve(msg.result);
      }
    });

    ws.on('close', () => {
      this.state.connected = false;
      this.emit('disconnected');
      if (!this.closing) this.scheduleReconnect();
    });

    ws.on('error', (err) => {
      this.state.lastError = err.message;
      this.state.lastErrorAt = new Date().toISOString();
      this.opts.log.warn('ha', 'WebSocket error', { error: err.message });
    });
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts += 1;
    const delay = Math.min(this.opts.reconnectBaseMs * 2 ** (this.reconnectAttempts - 1), 60_000);
    this.opts.log.info('ha', 'Reconnecting to Home Assistant', {
      attempt: this.reconnectAttempts,
      delayMs: delay,
    });
    this.reconnectTimer = setTimeout(() => this.connectStream(), delay);
  }

  stopStateStream(): void {
    this.closing = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.state.connected = false;
  }
}

/** True when an error stems from an unsupported/renamed WebSocket command. */
function isUnknownCommand(err: unknown): boolean {
  if (!(err instanceof PvmError)) return false;
  const details = err.details ?? {};
  if (details.code === 'unknown_command') return true;
  return typeof details.error === 'string' && /unknown command/i.test(details.error);
}
