import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import type { LogLevel } from '@pvm/shared';

loadEnv();

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1' || value === 'yes';
}

function int(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface ServerConfig {
  env: string;
  host: string;
  port: number;
  logLevel: LogLevel;
  apiSecret: string;
  dbPath: string;
  dataDir: string;
  addonsDir: string;
  logsDir: string;
  haUrl: string;
  haToken: string;
  haLocalOnly: boolean;
  corsOrigins: string[];
  rateLimitMax: number;
  rateLimitWindowMs: number;
  notifications: {
    smtpUrl?: string;
    emailFrom?: string;
    emailTo?: string;
    pushWebhookUrl?: string;
  };
}

export function loadConfig(): ServerConfig {
  const dataDir = resolve(process.env.PVM_DATA_DIR ?? './data');
  const cfg: ServerConfig = {
    env: process.env.NODE_ENV ?? 'development',
    host: process.env.PVM_HOST ?? '0.0.0.0',
    port: int(process.env.PVM_PORT, 7000),
    logLevel: (process.env.PVM_LOG_LEVEL as LogLevel) ?? 'INFO',
    apiSecret: process.env.PVM_API_SECRET ?? '',
    dbPath: resolve(process.env.PVM_DB_PATH ?? `${dataDir}/pvm.sqlite`),
    dataDir,
    addonsDir: resolve(process.env.PVM_ADDONS_DIR ?? `${dataDir}/addons`),
    logsDir: resolve(process.env.PVM_LOGS_DIR ?? `${dataDir}/logs`),
    haUrl: (process.env.HA_URL ?? '').replace(/\/+$/, ''),
    haToken: process.env.HA_TOKEN ?? '',
    haLocalOnly: bool(process.env.HA_LOCAL_ONLY, true),
    corsOrigins: list(process.env.PVM_CORS_ORIGINS),
    rateLimitMax: int(process.env.PVM_RATE_LIMIT_MAX, 300),
    rateLimitWindowMs: int(process.env.PVM_RATE_LIMIT_WINDOW, 60_000),
    notifications: {
      smtpUrl: process.env.PVM_SMTP_URL,
      emailFrom: process.env.PVM_EMAIL_FROM,
      emailTo: process.env.PVM_EMAIL_TO,
      pushWebhookUrl: process.env.PVM_PUSH_WEBHOOK_URL,
    },
  };

  for (const dir of [cfg.dataDir, cfg.addonsDir, cfg.logsDir]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  return cfg;
}
