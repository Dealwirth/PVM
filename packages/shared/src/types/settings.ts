import type { ForecastMethod } from './forecast.js';
import type { SecurityMode } from './addon.js';
import type { LogLevel } from './log.js';

/** Application settings domain types. */

export type Language = 'de' | 'en';

export interface HaConnectionSettings {
  url: string;
  token: string;
  /** Reject non-local HA URLs. */
  localOnly: boolean;
  /** WebSocket reconnect backoff base in ms. */
  reconnectBaseMs: number;
  /**
   * Alternate HA base URLs probed when `url` is empty (e.g. pushed by the HA
   * custom component during setup).
   */
  candidateUrls: string[];
}

/** Result of a non-persisting HA connection test (`POST /api/settings/test-ha`). */
export interface HaConnectionTestResult {
  ok: boolean;
  /** Reachable HA base URL (present on success). */
  url?: string;
  /** HA version reported by `GET /api/config` on success. */
  haVersion?: string;
  /** HA instance name on success. */
  locationName?: string;
  /** PVM error code (e.g. PVM-002, PVM-003) on failure. */
  errorCode?: string;
  message?: string;
  /**
   * The URL is public (DuckDNS/Nabu Casa) and was blocked by the local-only
   * guard. The UI can retry with `allowRemote` to verify and allow it in one
   * step instead of showing a dead-end error.
   */
  publicUrl?: boolean;
  /** How the connection is established: PVM→HA API, or HA pushes to PVM. */
  mode?: 'api' | 'integration';
}

export interface PvmApiSettings {
  host: string;
  port: number;
  /** Hashed token is stored; this field is write-only from the UI. */
  token?: string;
  corsOrigins: string[];
}

export interface GeneralSettings {
  language: Language;
  /** IANA timezone or 'auto'. */
  timezone: string;
  /** Unit preferences. */
  units: {
    power: 'W' | 'kW';
    temperature: 'C' | 'F';
    energy: 'Wh' | 'kWh';
  };
  autoCache: boolean;
  autoUpdate: boolean;
  autoStartOnHaStart: boolean;
  shutdownOnError: boolean;
  selfHealing: boolean;
  safetyMode: boolean;
  backupExport: boolean;
  developerMode: boolean;
  /** Operator has dismissed the first-run setup assistant. */
  setupDismissed: boolean;
}

export interface NotificationSettings {
  email?: {
    enabled: boolean;
    address: string;
    smtpUrl: string;
  };
  push?: {
    enabled: boolean;
    webhookUrl: string;
  };
}

export interface LogSettings {
  enabled: boolean;
  level: LogLevel;
  autoLogs: boolean;
  /** Max log file size in MB before rotation. */
  maxFileSizeMb: number;
  /** Threshold: number of ERROR entries in window before alert. */
  errorAlertThreshold: number;
}

export interface ForecastModuleSettings {
  enabled: boolean;
  methods: ForecastMethod[];
  recencyWeight: number;
  historyDays: number;
  combinedWeatherWeight: number;
  /** HA weather entity to use for irradiance/temperature. */
  weatherEntityId?: string;
}

export interface CalendarModuleSettings {
  enabled: boolean;
  /** HA calendar entity ids to sync. */
  entityIds: string[];
  refreshMinutes: number;
}

export interface SafetySettings {
  mode: SecurityMode;
  /** Auto-shutdown on critical errors. */
  autoShutdown: boolean;
  /** Max grid import before load shedding. */
  maxGridImportW: number;
  /** Max device power before shutdown. */
  maxDevicePowerW: number;
  /** Min battery level before plan adjustment (percent). */
  minBatteryPercent: number;
  /** Max temperature before shutdown. */
  maxTemperatureC: number;
}

export interface Settings {
  general: GeneralSettings;
  ha: HaConnectionSettings;
  api: PvmApiSettings;
  notifications: NotificationSettings;
  log: LogSettings;
  forecast: ForecastModuleSettings;
  calendar: CalendarModuleSettings;
  safety: SafetySettings;
  /** Version counter, bumped on each write. */
  revision: number;
  updatedAt: string;
}

/** Which required settings are missing/incomplete. */
export interface RequiredSettingStatus {
  complete: boolean;
  missing: Array<{ key: string; label: string; errorCode: string }>;
  /** Whether the operator has dismissed the first-run setup assistant. */
  setupDismissed: boolean;
}
