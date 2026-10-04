import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import type { AppContext } from '../context.js';
import { errorHandler } from './errors.js';
import { registerAuthHooks } from './auth.js';
import { deviceRoutes } from './routes/devices.js';
import {
  addonRoutes,
  backupRoutes,
  calendarRoutes,
  dashboardRoutes,
  errorRoutes,
  forecastRoutes,
  haRoutes,
  logRoutes,
  plannerRoutes,
  safetyRoutes,
  settingsRoutes,
} from './routes/misc.js';
import { registerWebSocket } from './websocket.js';

export async function buildApp(ctx: AppContext): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    bodyLimit: 2 * 1024 * 1024,
    trustProxy: true,
  });

  app.decorate('pvm', ctx);

  await app.register(helmet, {
    contentSecurityPolicy: false, // SPA served by the same origin configures its own CSP
  });

  await app.register(cors, {
    origin: ctx.config.corsOrigins.length > 0 ? ctx.config.corsOrigins : false,
    credentials: true,
  });

  await app.register(rateLimit, {
    max: ctx.config.rateLimitMax,
    timeWindow: ctx.config.rateLimitWindowMs,
  });

  await app.register(websocket);

  app.setErrorHandler(errorHandler);

  app.get('/api/health', async () => ({
    status: 'ok',
    version: '1.3.0',
    ha: ctx.ha.getState(),
    uptimeSeconds: Math.round(process.uptime()),
  }));

  app.post('/api/auth/login', async (request) => {
    const { token } = request.body as { token?: string };
    const payload = ctx.auth.authenticate(token ? `Bearer ${token}` : undefined);
    if (!payload) {
      return { ok: false, token: null };
    }
    return { ok: true, token: ctx.auth.issue(payload.sub, payload.role) };
  });

  registerAuthHooks(app, ['/api/health', '/api/auth/login', '/ws']);

  await app.register(
    async (api) => {
      await deviceRoutes(api);
      await settingsRoutes(api);
      await dashboardRoutes(api);
      await forecastRoutes(api);
      await plannerRoutes(api);
      await calendarRoutes(api);
      await logRoutes(api);
      await addonRoutes(api);
      await safetyRoutes(api);
      await haRoutes(api);
      await errorRoutes(api);
      await backupRoutes(api);
    },
    { prefix: '/api' },
  );

  registerWebSocket(app, ctx);

  // Serve the built web UI when present (single-container deployment).
  const webDist = findWebDist();
  if (webDist) {
    await app.register(fastifyStatic, { root: webDist, prefix: '/' });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api') || request.url.startsWith('/ws')) {
        reply.status(404).send({ error: { code: 'PVM-020', message: 'Not found' } });
        return;
      }
      reply.sendFile('index.html');
    });
  }

  return app;
}

/** Locate the built web bundle across dev and container layouts. */
function findWebDist(): string | null {
  const candidates = [
    process.env.PVM_WEB_DIR,
    resolve(process.cwd(), '../web/dist'),
    resolve(process.cwd(), 'apps/web/dist'),
    resolve(process.cwd(), 'web/dist'),
    resolve(process.cwd(), 'dist/web'),
  ].filter((p): p is string => Boolean(p));
  return candidates.find((p) => existsSync(join(p, 'index.html'))) ?? null;
}
