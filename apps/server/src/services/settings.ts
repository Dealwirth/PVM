import type { RequiredSettingStatus, Settings, SettingsPatch } from '@pvm/shared';
import { PvmError } from '@pvm/shared';
import type { SettingsRepository } from '../db/repositories/settings.js';
import type { ServerConfig } from '../config.js';
import type { DevLog } from './devlog.js';

export function defaultSettings(config: ServerConfig): Settings {
  return {
    general: {
      language: 'de',
      timezone: 'auto',
      units: { power: 'W', temperature: 'C', energy: 'kWh' },
      autoCache: true,
      autoUpdate: false,
      autoStartOnHaStart: true,
      shutdownOnError: true,
      selfHealing: true,
      safetyMode: true,
      backupExport: false,
      developerMode: false,
    },
    ha: {
      url: config.haUrl,
      token: config.haToken,
      localOnly: config.haLocalOnly,
      reconnectBaseMs: 5000,
    },
    api: {
      host: config.host,
      port: config.port,
      corsOrigins: config.corsOrigins,
    },
    notifications: {},
    log: {
      enabled: true,
      level: config.logLevel,
      autoLogs: true,
      maxFileSizeMb: 100,
      errorAlertThreshold: 10,
    },
    forecast: {
      enabled: true,
      methods: ['combined'],
      recencyWeight: 0.6,
      historyDays: 30,
      combinedWeatherWeight: 0.5,
    },
    calendar: {
      enabled: true,
      entityIds: [],
      refreshMinutes: 60,
    },
    safety: {
      mode: 'strict',
      autoShutdown: true,
      maxGridImportW: 11_000,
      maxDevicePowerW: 22_000,
      minBatteryPercent: 10,
      maxTemperatureC: 80,
    },
    revision: 0,
    updatedAt: new Date().toISOString(),
  };
}

function deepMerge<T>(base: T, patch: unknown): T {
  if (patch === undefined) return base;
  if (Array.isArray(patch) || typeof patch !== 'object' || patch === null) {
    return patch as T;
  }
  if (typeof base !== 'object' || base === null || Array.isArray(base)) {
    return patch as T;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    out[key] = deepMerge((base as Record<string, unknown>)[key], value);
  }
  return out as T;
}

export class SettingsService {
  private cached?: Settings;

  constructor(
    private readonly repo: SettingsRepository,
    private readonly config: ServerConfig,
    private readonly log: DevLog,
  ) {}

  get(): Settings {
    if (this.cached) return this.cached;
    const stored = this.repo.get();
    if (stored) {
      this.cached = stored;
      return stored;
    }
    const initial = defaultSettings(this.config);
    this.repo.save(initial);
    this.cached = initial;
    return initial;
  }

  update(patch: SettingsPatch): Settings {
    const current = this.get();
    const merged = deepMerge(current, patch);
    merged.revision = current.revision + 1;
    merged.updatedAt = new Date().toISOString();
    this.repo.save(merged);
    this.cached = merged;
    this.log.info('settings', 'Settings updated', { revision: merged.revision });
    return merged;
  }

  /** Settings required before the store and device control may be used. */
  requiredStatus(): RequiredSettingStatus {
    const s = this.get();
    const missing: RequiredSettingStatus['missing'] = [];
    if (!s.ha.url) missing.push({ key: 'ha.url', label: 'HA-Host (URL)', errorCode: 'PVM-001' });
    if (!s.ha.token) {
      missing.push({ key: 'ha.token', label: 'HA Long-Lived Access Token', errorCode: 'PVM-001' });
    }
    if (!s.general.language) {
      missing.push({ key: 'general.language', label: 'Sprache', errorCode: 'PVM-001' });
    }
    if (!s.general.timezone) {
      missing.push({ key: 'general.timezone', label: 'Zeitzone', errorCode: 'PVM-001' });
    }
    return { complete: missing.length === 0, missing };
  }

  /** Throw if required settings are missing (guard for store/control). */
  assertRequired(): void {
    const status = this.requiredStatus();
    if (!status.complete) {
      throw new PvmError('PVM-001', { missing: status.missing });
    }
  }

  /** Redact secrets before sending settings to the UI. */
  toPublic(): Settings & { ha: { token: string }; api: { token?: string } } {
    const s = this.get();
    return {
      ...s,
      ha: { ...s.ha, token: s.ha.token ? '••••••••' : '' },
      api: { ...s.api, token: undefined },
    };
  }
}
