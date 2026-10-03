import type { FastifyInstance } from 'fastify';
import {
  deviceCommandSchema,
  deviceCreateSchema,
  deviceUpdateSchema,
  idParamSchema,
} from '@pvm/shared';
import type { AppContext } from '../../context.js';

export async function deviceRoutes(app: FastifyInstance): Promise<void> {
  const ctx = (): AppContext => app.pvm;

  app.get('/devices', async (request) => {
    const query = request.query as Record<string, string | undefined>;
    return ctx().devices.list({
      type: query.type as never,
      status: query.status as never,
      sensorMask: query.sensorMask as never,
      minPriority: query.minPriority ? Number(query.minPriority) : undefined,
      search: query.search,
      tag: query.tag,
    });
  });

  app.get('/devices/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return ctx().devices.get(id);
  });

  app.post('/devices', async (request, reply) => {
    const input = deviceCreateSchema.parse(request.body);
    const device = ctx().devices.create(input);
    reply.status(201);
    return device;
  });

  app.put('/devices/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const patch = deviceUpdateSchema.parse(request.body);
    return ctx().devices.update(id, patch);
  });

  app.delete('/devices/:id', async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    ctx().devices.remove(id);
    reply.status(204);
    return null;
  });

  app.get('/devices/:id/history', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const query = request.query as { since?: string; until?: string };
    return ctx().devices.historyFor(id, query.since, query.until);
  });

  app.post('/devices/:id/refresh', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return ctx().devices.refreshValues(id);
  });

  app.post('/devices/:id/command', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const command = deviceCommandSchema.parse(request.body);
    return ctx().devices.execute({ ...command, deviceId: id });
  });

  app.get('/discovery', async () => ctx().devices.discover());

  app.post('/discovery/adopt', async (request, reply) => {
    const body = request.body as {
      device: Parameters<AppContext['devices']['adopt']>[0];
      overrides?: Record<string, unknown>;
    };
    const device = ctx().devices.adopt(body.device, body.overrides ?? {});
    reply.status(201);
    return device;
  });
}
