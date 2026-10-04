import { z } from 'zod';
import { FORECAST_METHODS } from '../types/forecast.js';
import type { ForecastMethod } from '../types/forecast.js';
import { CALENDAR_EVENT_KINDS } from '../types/forecast.js';
import { LOG_LEVELS } from '../types/log.js';
import { ADDON_PERMISSIONS, SECURITY_MODES } from '../types/addon.js';

const forecastMethodTuple = FORECAST_METHODS as [ForecastMethod, ...ForecastMethod[]];

export const languageSchema = z.enum(['de', 'en']);
export const logLevelSchema = z.enum(LOG_LEVELS);
export const securityModeSchema = z.enum(SECURITY_MODES);
export const forecastMethodSchema = z.enum(forecastMethodTuple);
export const calendarEventKindSchema = z.enum(CALENDAR_EVENT_KINDS);
export const addonPermissionSchema = z.enum(ADDON_PERMISSIONS);

export const haConnectionSchema = z.object({
  url: z.string().url().max(500),
  token: z.string().max(2000),
  localOnly: z.boolean(),
  reconnectBaseMs: z.number().int().min(1000).max(600_000),
  candidateUrls: z.array(z.string().url().max(500)).max(20).default([]),
});

export const apiSettingsSchema = z.object({
  host: z.string().max(255),
  port: z.number().int().min(1).max(65535),
  token: z.string().max(2000).optional(),
  corsOrigins: z.array(z.string().max(500)).max(50),
});

export const generalSettingsSchema = z.object({
  language: languageSchema,
  timezone: z.string().max(100),
  units: z.object({
    power: z.enum(['W', 'kW']),
    temperature: z.enum(['C', 'F']),
    energy: z.enum(['Wh', 'kWh']),
  }),
  autoCache: z.boolean(),
  autoUpdate: z.boolean(),
  autoStartOnHaStart: z.boolean(),
  shutdownOnError: z.boolean(),
  selfHealing: z.boolean(),
  safetyMode: z.boolean(),
  backupExport: z.boolean(),
  developerMode: z.boolean(),
  setupDismissed: z.boolean().default(false),
});

export const notificationSettingsSchema = z.object({
  email: z
    .object({
      enabled: z.boolean(),
      address: z.string().max(320),
      smtpUrl: z.string().max(500),
    })
    .optional(),
  push: z
    .object({
      enabled: z.boolean(),
      webhookUrl: z.string().max(500),
    })
    .optional(),
});

export const logSettingsSchema = z.object({
  enabled: z.boolean(),
  level: logLevelSchema,
  autoLogs: z.boolean(),
  maxFileSizeMb: z.number().int().min(1).max(10_000),
  errorAlertThreshold: z.number().int().min(1).max(10_000),
});

export const forecastModuleSettingsSchema = z.object({
  enabled: z.boolean(),
  methods: z.array(forecastMethodSchema),
  recencyWeight: z.number().min(0).max(1),
  historyDays: z.number().int().min(1).max(3650),
  combinedWeatherWeight: z.number().min(0).max(1),
  weatherEntityId: z.string().max(255).optional(),
});

export const calendarModuleSettingsSchema = z.object({
  enabled: z.boolean(),
  entityIds: z.array(z.string().max(255)).max(50),
  refreshMinutes: z.number().int().min(1).max(10_080),
});

export const safetySettingsSchema = z.object({
  mode: securityModeSchema,
  autoShutdown: z.boolean(),
  maxGridImportW: z.number().nonnegative().max(10_000_000),
  maxDevicePowerW: z.number().nonnegative().max(10_000_000),
  minBatteryPercent: z.number().min(0).max(100),
  maxTemperatureC: z.number().min(-100).max(200),
});

export const settingsSchema = z.object({
  general: generalSettingsSchema,
  ha: haConnectionSchema,
  api: apiSettingsSchema,
  notifications: notificationSettingsSchema,
  log: logSettingsSchema,
  forecast: forecastModuleSettingsSchema,
  calendar: calendarModuleSettingsSchema,
  safety: safetySettingsSchema,
  revision: z.number().int().nonnegative(),
  updatedAt: z.string(),
});

/** Partial settings patch used by PUT /api/settings. */
export const settingsPatchSchema = z
  .object({
    general: generalSettingsSchema.partial().optional(),
    ha: haConnectionSchema.partial().optional(),
    api: apiSettingsSchema.partial().optional(),
    notifications: notificationSettingsSchema.partial().optional(),
    log: logSettingsSchema.partial().optional(),
    forecast: forecastModuleSettingsSchema.partial().optional(),
    calendar: calendarModuleSettingsSchema.partial().optional(),
    safety: safetySettingsSchema.partial().optional(),
  })
  .strict();

export const calendarEventSchema = z.object({
  title: z.string().min(1).max(500),
  start: z.string(),
  end: z.string(),
  allDay: z.boolean().default(false),
  kind: calendarEventKindSchema.default('other'),
  description: z.string().max(5000).optional(),
  location: z.string().max(500).optional(),
  expectedEnergyWh: z.number().optional(),
});

export const plannerSettingsSchema = z.object({
  batteryReserveFraction: z.number().min(0).max(1),
  comfortIsHardLimit: z.boolean(),
  maxGridImportW: z.number().nonnegative(),
  usePriceSignals: z.boolean(),
  minSchedulePriority: z.number().int().min(0).max(100),
});

export const addonInstallSchema = z.object({
  source: z.string().min(1).max(1000),
  version: z.string().max(100).optional(),
  config: z.record(z.unknown()).optional(),
});

export const loginSchema = z.object({
  token: z.string().min(1).max(2000),
});

/** Body for POST /api/settings/test-ha (non-persisting connection test). */
export const haTestSchema = z
  .object({
    url: z.string().max(500).optional(),
    token: z.string().max(2000).optional(),
    /** Verify a deliberately public URL (DuckDNS/Nabu Casa) despite local-only. */
    allowRemote: z.boolean().optional(),
    /** Only accept a working HA→PVM push connection; never probe PVM→HA. */
    requireIntegration: z.boolean().optional(),
  })
  .strict();

/**
 * Body for POST /api/ha/internal/ingest: a Home Assistant snapshot pushed by
 * the HA custom component (the API-free path).
 */
export const haIngestSchema = z
  .object({
    takenAt: z.string().max(100).optional(),
    haVersion: z.string().max(100).optional(),
    locationName: z.string().max(500).optional(),
    haUrl: z.string().max(500).optional(),
    states: z.array(z.record(z.unknown())).max(50_000).optional(),
    services: z.array(z.record(z.unknown())).max(2_000).optional(),
    deviceRegistry: z.array(z.record(z.unknown())).max(10_000).optional(),
    entityRegistry: z.array(z.record(z.unknown())).max(50_000).optional(),
    areaRegistry: z.array(z.record(z.unknown())).max(10_000).optional(),
  })
  .strict();

/**
 * Body for POST /api/ha/internal/detect, used by the HA custom component to
 * hand PVM the HA base URL(s) and, optionally, the HA token it already holds.
 */
export const haDetectSchema = z
  .object({
    url: z.string().max(500).optional(),
    token: z.string().max(2000).optional(),
    candidates: z.array(z.string().max(500)).max(20).optional(),
  })
  .strict();

export type HaTestInput = z.infer<typeof haTestSchema>;
export type HaIngestInput = z.infer<typeof haIngestSchema>;
export type HaDetectInput = z.infer<typeof haDetectSchema>;

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;
export type PlannerSettingsSchema = z.infer<typeof plannerSettingsSchema>;
export type AddonInstallSchema = z.infer<typeof addonInstallSchema>;
