import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { PvmError } from '@pvm/shared';
import type { AppContext } from '../context.js';

/** Convert any thrown value into a consistent JSON error envelope. */
export function errorHandler(error: unknown, request: FastifyRequest, reply: FastifyReply): void {
  const ctx = request.server.pvm as AppContext | undefined;

  if (error instanceof PvmError) {
    ctx?.log.error(
      'api',
      `Request failed: ${error.code}`,
      {
        path: request.url,
        method: request.method,
      },
      error.code,
    );
    reply.status(statusFor(error)).send({ error: error.toJSON() });
    return;
  }

  if (error instanceof ZodError) {
    const validation = new PvmError('PVM-015', { issues: error.issues });
    reply.status(400).send({ error: validation.toJSON() });
    return;
  }

  const fastifyError = error as { statusCode?: number; message?: string };
  if (fastifyError.statusCode === 429) {
    const rate = new PvmError('PVM-019', {});
    reply.status(429).send({ error: rate.toJSON() });
    return;
  }

  ctx?.log.error(
    'api',
    'Unhandled error',
    {
      path: request.url,
      error: (error as Error).message,
      stack: (error as Error).stack,
    },
    'PVM-020',
  );

  const unknown = new PvmError('PVM-020', { message: (error as Error).message });
  reply.status(500).send({ error: unknown.toJSON() });
}

function statusFor(error: PvmError): number {
  switch (error.code) {
    case 'PVM-003':
    case 'PVM-004':
      return 401;
    case 'PVM-015':
      return 400;
    case 'PVM-005':
    case 'PVM-011':
      return 404;
    case 'PVM-019':
      return 429;
    case 'PVM-012':
    case 'PVM-016':
      return 403;
    default:
      return 500;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    pvm: AppContext;
  }
}

export type { FastifyInstance };
