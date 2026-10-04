import type { FastifyInstance } from 'fastify';
import type { HaSnapshot } from '@pvm/shared';
import {
  addonInstallSchema,
  forecastInputSchema,
  haDetectSchema,
  haIngestSchema,
  haTestSchema,
  idParamSchema,
  logFilterSchema,
  normalizeUrlInput,
  plannerSettingsSchema,
  settingsPatchSchema,
  validateHaServicePayload,
} from '@pvm/shared';
import type { AppContext } from '../../context.js';
import { TOKEN_MASK } from '../../services/settings.js';
import { VERSION } from '../../services/backup.js';

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  const ctx = (): AppContext => app.pvm;

  app.get('/settings', async () => ctx().settings.toPublic());
  app.get('/settings/required', async () => ctx().settings.requiredStatus());

  app.put('/settings', async (request) => {
    const patch = settingsPatchSchema.parse(request.body);
    // Never overwrite the stored token with the UI placeholder.
    if (patch.ha?.token === TOKEN_MASK) delete patch.ha.token;
    // Accept scheme-less input (e.g. "homeassistant.local:8123").
    if (patch.ha?.url) {
      const normalized = normalizeUrlInput(patch.ha.url);
      if (normalized) patch.ha.url = normalized;
    }
    let updated = ctx().settings.update(patch);

    // Auto-detect the HA URL when it is still unknown (candidates are pushed
    // by the HA custom component, or come from the HA_URL env fallback).
    if (!updated.ha.url) {
      const detected = await ctx().settings.detectHa();
      if (detected.ok && detected.url) {
        updated = ctx().settings.update({ ha: { url: detected.url } });
      }
    }

    ctx().ha.configure({
      url: updated.ha.url,
      token: updated.ha.token,
      localOnly: updated.ha.localOnly,
    });
    ctx().log.setLevel(updated.log.level);
    return ctx().settings.toPublic();
  });

  // Non-persisting connection test used by the setup wizard. Accepts an
  // optional url/token so the user can verify before saving.
  app.post('/settings/test-ha', async (request) => {
    const body = haTestSchema.parse(request.body ?? {});
    return ctx().settings.testHaConnection(body);
  });
}

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  const ctx = (): AppContext => app.pvm;
  app.get('/dashboard', async () => ctx().dashboard.summary());
  app.post('/dashboard/run-cycle', async () => ctx().dashboard.runPlanningCycle());
}

export async function forecastRoutes(app: FastifyInstance): Promise<void> {
  const ctx = (): AppContext => app.pvm;
  app.get('/forecast/latest', async (request) => {
    const query = request.query as { horizon?: string };
    return ctx().forecast.latest(query.horizon) ?? null;
  });
  app.get('/forecast/history', async (request) => {
    const query = request.query as { limit?: string };
    return ctx().forecast.history(query.limit ? Number(query.limit) : 50);
  });
  app.post('/forecast/generate', async (request) => {
    const body = forecastInputSchema.parse(request.body);
    return ctx().forecast.generate(body);
  });
}

export async function plannerRoutes(app: FastifyInstance): Promise<void> {
  const ctx = (): AppContext => app.pvm;
  app.get('/plan/latest', async () => ctx().planner.latest() ?? null);
  app.get('/plan/history', async (request) => {
    const query = request.query as { limit?: string };
    return ctx().planner.history(query.limit ? Number(query.limit) : 50);
  });
  app.post('/plan/generate', async (request) => {
    const body = request.body as Parameters<AppContext['planner']['plan']>[0];
    return ctx().planner.plan(body);
  });
  app.post('/plan/settings', async (request) => {
    return plannerSettingsSchema.parse(request.body);
  });
}

export async function calendarRoutes(app: FastifyInstance): Promise<void> {
  const ctx = (): AppContext => app.pvm;
  app.get('/calendar/sources', async () => ctx().calendar.listSources());
  app.post('/calendar/sources', async (request, reply) => {
    const body = request.body as Parameters<AppContext['calendar']['addSource']>[0];
    reply.status(201);
    return ctx().calendar.addSource(body);
  });
  app.delete('/calendar/sources/:id', async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    ctx().calendar.removeSource(id);
    reply.status(204);
    return null;
  });
  app.post('/calendar/sync', async () => ({ synced: await ctx().calendar.syncAll() }));
  app.get('/calendar/events', async (request) => {
    const query = request.query as { start?: string; end?: string };
    if (query.start && query.end) return ctx().calendar.eventsBetween(query.start, query.end);
    return ctx().calendar.allEvents();
  });
}

export async function logRoutes(app: FastifyInstance): Promise<void> {
  const ctx = (): AppContext => app.pvm;
  app.get('/logs', async (request) => {
    const filter = logFilterSchema.parse(request.query);
    return ctx().log.query(filter);
  });
  app.get('/logs/export', async (request, reply) => {
    const query = request.query as { format?: 'json' | 'csv' };
    const filter = logFilterSchema.parse(request.query);
    if (query.format === 'csv') {
      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', 'attachment; filename="devlog.csv"');
      return ctx().log.exportCsv(filter);
    }
    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', 'attachment; filename="devlog.json"');
    return ctx().log.exportJson(filter);
  });

  app.get('/logs/stats', async () => ctx().log.stats());
  app.delete('/logs', async (_request, reply) => {
    ctx().log.clear();
    reply.status(204);
    return null;
  });
}

export async function addonRoutes(app: FastifyInstance): Promise<void> {
  const ctx = (): AppContext => app.pvm;
  app.get('/addons', async () => ctx().addons.list());
  app.get('/addons/store', async () => ctx().addons.browse());
  app.get('/addons/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return ctx().addons.get(id);
  });
  app.get('/addons/:id/logs', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return { log: ctx().addons.readAddonLog(id) };
  });
  app.post('/addons/install', async (request, reply) => {
    const body = addonInstallSchema.parse(request.body);
    const result = await ctx().addons.install(body.source, body.version, body.config);
    reply.status(201);
    return result;
  });
  app.post('/addons/:id/update', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return ctx().addons.update(id);
  });
  app.post('/addons/:id/enable', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return ctx().addons.setEnabled(id, true);
  });
  app.post('/addons/:id/disable', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return ctx().addons.setEnabled(id, false);
  });
  app.put('/addons/:id/config', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const config = (request.body as { config: Record<string, unknown> }).config ?? {};
    return ctx().addons.updateConfig(id, config);
  });
  app.delete('/addons/:id', async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    ctx().addons.remove(id);
    reply.status(204);
    return null;
  });
}

export async function safetyRoutes(app: FastifyInstance): Promise<void> {
  const ctx = (): AppContext => app.pvm;
  app.get('/safety/events', async (request) => {
    const query = request.query as { limit?: string };
    return ctx().safety.list(query.limit ? Number(query.limit) : 200);
  });
  app.post('/safety/evaluate', async (request) => {
    const body = request.body as { totalPowerW: number };
    return ctx().safety.evaluateLoad(body.totalPowerW);
  });
  app.post('/safety/self-heal', async () => ctx().safety.selfHeal());
}

export async function haRoutes(app: FastifyInstance): Promise<void> {
  const ctx = (): AppContext => app.pvm;
  app.get('/ha/status', async () => ctx().ha.getState());
  app.get('/ha/config', async () => ctx().ha.getConfig());
  app.get('/ha/states', async () => ctx().ha.getStates());
  app.get('/ha/services', async () => ctx().ha.getServices());
  app.get('/ha/history/:entityId', async (request) => {
    const params = request.params as { entityId: string };
    const query = request.query as { start: string; end?: string };
    return ctx().ha.getHistory(params.entityId, query.start, query.end);
  });

  // Invoked by the Home Assistant custom component (pvm.* services).
  app.post('/ha/services/:service', async (request) => {
    const { service } = request.params as { service: string };
    const payload = validateHaServicePayload(service, request.body ?? {}) as Record<
      string,
      unknown
    >;
    return ctx().haServiceCall(service, payload);
  });

  // Called by the HA custom component during setup so the user only has to
  // enter the HA token in PVM. The component hands over the HA base URL(s) it
  // can derive and (optionally) the HA token it already holds, then PVM probes
  // them and stores the first reachable URL. The component is authenticated
  // with the PVM API token and only forwards HA's own URLs, so a deliberately
  // public (DuckDNS/Nabu Casa) URL is allowed here.
  app.post('/ha/internal/detect', async (request) => {
    const input = haDetectSchema.parse(request.body ?? {});
    const candidates = [...(input.url ? [input.url] : []), ...(input.candidates ?? [])];
    const result = await ctx().settings.detectHa(candidates, input.token, true);
    if (result.ok && result.url) {
      ctx().settings.update({ ha: { url: result.url } });
      ctx().ha.configure({ url: result.url });
      ctx().log.info('ha', 'HA URL auto-detected', { url: result.url });
    }
    return result;
  });

  // API-free path: the HA custom component pushes a full snapshot of the data
  // it already has (states, services, registries). PVM then works without ever
  // reaching HA over the network. Used when PVM cannot reach HA directly.
  app.post('/ha/internal/ingest', { bodyLimit: 64 * 1024 * 1024 }, async (request) => {
    const input = haIngestSchema.parse(request.body ?? {});
    return ctx().settings.ingestSnapshot({
      takenAt: input.takenAt ?? new Date().toISOString(),
      haVersion: input.haVersion,
      locationName: input.locationName,
      haUrl: input.haUrl,
      states: input.states as HaSnapshot['states'],
      services: input.services as HaSnapshot['services'],
      deviceRegistry: input.deviceRegistry as HaSnapshot['deviceRegistry'],
      entityRegistry: input.entityRegistry as HaSnapshot['entityRegistry'],
      areaRegistry: input.areaRegistry as HaSnapshot['areaRegistry'],
    });
  });
}

export async function errorRoutes(app: FastifyInstance): Promise<void> {
  app.get('/errors/catalog', async () => {
    const { ERROR_CATALOG } = await import('@pvm/shared');
    return ERROR_CATALOG;
  });
}

export async function backupRoutes(app: FastifyInstance): Promise<void> {
  const ctx = (): AppContext => app.pvm;

  // Summary of what a backup would contain, for the UI preview.
  app.get('/backup/info', async () => ({
    counts: ctx().backup.counts(),
    version: VERSION,
  }));

  // Download a full backup. Secrets (HA token) are excluded unless requested.
  app.get('/backup/export', async (request, reply) => {
    const query = request.query as { secrets?: string };
    const includesSecrets = query.secrets === 'true';
    const backup = ctx().backup.export(includesSecrets);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="pvm-backup-${stamp}.json"`);
    return backup;
  });

  // Restore a backup. Replaces all current data in a single transaction.
  app.post('/backup/import', { bodyLimit: 64 * 1024 * 1024 }, async (request) => {
    const result = ctx().backup.import(
      request.body as Parameters<AppContext['backup']['import']>[0],
    );
    // The restore wrote settings straight to the DB; refresh the in-memory
    // cache and re-apply them to the HA client.
    ctx().settings.reload();
    return result;
  });
}
