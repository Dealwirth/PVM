import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AppContext } from '../context.js';

/** Guard that requires a valid bearer token unless auth is disabled. */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const ctx = request.server.pvm as AppContext;
  if (!ctx.auth.enabled) return; // auth disabled when no secret configured
  const authHeader = request.headers.authorization;
  const payload = ctx.auth.authenticate(authHeader);
  if (!payload) {
    reply.status(401).send({
      error: {
        code: 'PVM-004',
        category: 'security',
        severity: 'critical',
        title: 'PVM-API-Authentifizierung fehlgeschlagen',
        message: 'Ungültiger oder fehlender Bearer-Token.',
        remediation: 'PVM-API-Token prüfen und neu setzen.',
      },
    });
  }
}

export function registerAuthHooks(app: FastifyInstance, publicPaths: string[]): void {
  app.addHook('onRequest', async (request, reply) => {
    const url = request.url.split('?')[0] ?? request.url;
    // Only the API and WebSocket are guarded; static SPA assets stay public.
    if (!url.startsWith('/api') && !url.startsWith('/ws')) return;
    if (publicPaths.some((p) => url === p || url.startsWith(`${p}/`))) return;
    await requireAuth(request, reply);
  });
}
