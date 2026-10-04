import type {
  HaConnectionTestResult,
  RequiredSettingStatus,
  Settings,
  SettingsPatch,
} from '@pvm/shared';
import { PvmError, isLocalUrl, normalizeUrlInput } from '@pvm/shared';
import type { SettingsRepository } from '../db/repositories/settings.js';
import type { ServerConfig } from '../config.js';
import type { HaClient } from '../ha/client.js';
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
      setupDismissed: false,
    },
    ha: {
      url: config.haUrl,
      token: config.haToken,
      localOnly: config.haLocalOnly,
      reconnectBaseMs: 5000,
      candidateUrls: [],
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
    private readonly ha: HaClient,
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
    // The UI receives a masked token; treat that as "set" so the required
    // banner clears once the user has saved a token.
    if (!s.ha.token || s.ha.token === TOKEN_MASK) {
      missing.push({ key: 'ha.token', label: 'HA Long-Lived Access Token', errorCode: 'PVM-001' });
    }
    if (!s.general.language) {
      missing.push({ key: 'general.language', label: 'Sprache', errorCode: 'PVM-001' });
    }
    if (!s.general.timezone) {
      missing.push({ key: 'general.timezone', label: 'Zeitzone', errorCode: 'PVM-001' });
    }
    return { complete: missing.length === 0, missing, setupDismissed: s.general.setupDismissed };
  }

  /**
   * Test a Home Assistant URL/token pair without persisting it.
   *
   * Sends a real ``GET /api/config`` request through the HA client so the user
   * gets an immediate, trustworthy answer (and an error code) before saving.
   * An empty token or the masked placeholder falls back to the stored token.
   */
  async testHaConnection(input: { url?: string; token?: string }): Promise<HaConnectionTestResult> {
    const s = this.get();
    const rawToken = input.token ?? '';
    const token = rawToken && rawToken !== TOKEN_MASK ? rawToken : s.ha.token;
    if (!token) {
      return { ok: false, errorCode: 'PVM-001', message: 'HA-Token fehlt.' };
    }
    const url = normalizeUrlInput(input.url ?? '');
    if (url) return this.probe(url, token);
    // No URL supplied: try the stored URL, then any known candidates.
    return this.detectHa([s.ha.url], token);
  }

  /**
   * Probe candidate HA base URLs and return the first reachable one.
   *
   * Candidates come from the explicit list, the stored candidates pushed by the
   * HA custom component and the `HA_URL` env fallback. When `localOnly` is set,
   * non-local candidates are not skipped silently: if none of the local
   * candidates work but a non-local one exists, the user gets an actionable
   * `PVM-016` result instead of an opaque "not found".
   */
  async detectHa(extra: string[] = [], tokenOverride?: string): Promise<HaConnectionTestResult> {
    const s = this.get();
    const token = tokenOverride ?? s.ha.token;
    if (!token) {
      return { ok: false, errorCode: 'PVM-001', message: 'HA-Token fehlt.' };
    }
    const seen = new Set<string>();
    const local: string[] = [];
    const remote: string[] = [];
    for (const raw of [...extra, ...(s.ha.candidateUrls ?? []), s.ha.url, this.config.haUrl]) {
      const url = normalizeUrlInput(raw ?? '');
      if (!url || seen.has(url)) continue;
      seen.add(url);
      (isLocalUrl(url) ? local : remote).push(url);
    }
    const ordered = s.ha.localOnly ? local : [...local, ...remote];
    let last: HaConnectionTestResult = {
      ok: false,
      errorCode: 'PVM-002',
      message: 'Keine erreichbare HA-Instanz gefunden.',
    };
    for (const url of ordered) {
      const result = await this.probe(url, token);
      if (result.ok) return result;
      last = result;
    }
    // Nothing local worked but a non-local candidate exists: tell the user
    // exactly why (and how to allow it) instead of hiding it behind PVM-002.
    if (s.ha.localOnly && remote.length > 0) {
      return {
        ok: false,
        errorCode: 'PVM-016',
        url: remote[0],
        message: `Die HA-Adresse ${remote[0]} ist nicht lokal und wurde blockiert.`,
      };
    }
    return last;
  }

  private async probe(url: string, token: string): Promise<HaConnectionTestResult> {
    if (this.get().ha.localOnly && !isLocalUrl(url)) {
      return {
        ok: false,
        errorCode: 'PVM-016',
        url,
        message: `Die HA-Adresse ${url} ist nicht lokal und wurde blockiert.`,
      };
    }
    const result = await this.ha.testConnection({ url, token });
    if (result.ok) {
      return {
        ok: true,
        url,
        haVersion: result.config?.version,
        locationName: result.config?.location_name,
      };
    }
    return {
      ok: false,
      errorCode: result.errorCode ?? this.errorCodeFor(result.error),
      message: result.error,
    };
  }

  private errorCodeFor(message?: string): string {
    if (!message) return 'PVM-002';
    const match = /PVM-\d{3}/.exec(message);
    return match ? match[0] : 'PVM-002';
  }

  /** Throw if required settings are missing (guard for store/control). */
  assertRequired(): void {
    const status = this.requiredStatus();
    if (!status.complete) {
      throw new PvmError('PVM-001', { missing: status.missing });
    }
  }

  /** Redact secrets before sending settings to the UI. */
  toPublic(): Settings & { ha: { token: string; tokenSet: boolean } } {
    const s = this.get();
    return {
      ...s,
      ha: {
        ...s.ha,
        token: s.ha.token ? TOKEN_MASK : '',
        tokenSet: Boolean(s.ha.token) && s.ha.token !== TOKEN_MASK,
      },
      api: { ...s.api, token: undefined },
    };
  }
}

/** Placeholder returned to the UI instead of the raw HA token. */
export const TOKEN_MASK = '••••••••';
