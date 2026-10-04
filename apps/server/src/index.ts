import { loadConfig } from './config.js';
import { openDatabase } from './db/index.js';
import { createContext } from './context.js';
import { buildApp } from './api/app.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const db = openDatabase(config.dbPath);
  const ctx = createContext(config, db);

  if (!ctx.auth.enabled) {
    ctx.log.warn(
      'security',
      'PVM_API_SECRET is missing or too short; API authentication is DISABLED.',
      {},
    );
  }

  const app = await buildApp(ctx);

  const shutdown = async (signal: string): Promise<void> => {
    ctx.log.info('system', `Received ${signal}, shutting down`);
    ctx.ha.stopStateStream();
    await app.close();
    db.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await app.listen({ host: config.host, port: config.port });
    ctx.log.info('system', 'PVM server started', { host: config.host, port: config.port });
    // Best-effort: start the HA state stream if configured.
    if (ctx.settings.get().ha.url && ctx.settings.get().ha.token) {
      ctx.ha.startStateStream();
    }
  } catch (err) {
    ctx.log.fatal(
      'system',
      'Failed to start server',
      { error: (err as Error).message },
      'PVM-020',
      (err as Error).stack,
    );
    process.exit(1);
  }
}

void main();
