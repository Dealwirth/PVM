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
}
