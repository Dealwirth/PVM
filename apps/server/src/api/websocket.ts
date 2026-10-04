import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { AppContext } from '../context.js';

/**
 * WebSocket hub for realtime UI updates.
 *
 * Channels:
 *  - logs      : dev-log entries
 *  - safety    : safety reactions
 *  - ha        : HA connection + state change events
 *
 * Auth: the client must pass `?token=` or an Authorization header on connect.
 */
export function registerWebSocket(app: FastifyInstance, ctx: AppContext): void {
  const clients = new Set<WebSocket>();

  const broadcast = (channel: string, payload: unknown): void => {
    const message = JSON.stringify({ channel, payload, timestamp: new Date().toISOString() });
    for (const client of clients) {
      if (client.readyState === 1) client.send(message);
    }
  };

  ctx.log.on('entry', (entry) => broadcast('logs', entry));
  ctx.safety.on('reaction', (reaction) => broadcast('safety', reaction));
  ctx.ha.on('state_changed', (data) => broadcast('ha', data));
  ctx.ha.on('connected', () => broadcast('ha', { connected: true }));
  ctx.ha.on('disconnected', () => broadcast('ha', { connected: false }));

  app.get('/ws', { websocket: true }, (socket, request) => {
    const token =
      (request.query as { token?: string }).token ??
      request.headers.authorization?.replace(/^Bearer\s+/i, '') ??
      '';
    if (ctx.auth.enabled && !ctx.auth.authenticate(token ? `Bearer ${token}` : undefined)) {
      socket.send(JSON.stringify({ channel: 'error', payload: { code: 'PVM-004' } }));
      socket.close(1008, 'unauthorized');
      return;
    }
    clients.add(socket);
    ctx.log.debug('ws', 'Client connected', { count: clients.size });
    socket.on('close', () => {
      clients.delete(socket);
    });
    socket.send(
      JSON.stringify({
        channel: 'hello',
        payload: { connected: true, channels: ['logs', 'safety', 'ha'] },
      }),
    );
  });

  app.addHook('onClose', async () => {
    for (const client of clients) client.close();
    clients.clear();
  });
}
