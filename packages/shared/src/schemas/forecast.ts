import { z } from 'zod';
import { CALENDAR_EVENT_KINDS } from '../types/forecast.js';
import { forecastMethodSchema } from './settings.js';

export const forecastHorizonSchema = z.enum(['day', 'week', 'total']);
// Named to avoid colliding with the calendar-source schema in settings.ts.
export const forecastEventKindSchema = z.enum(CALENDAR_EVENT_KINDS);

export const historicalSampleSchema = z.object({
  timestamp: z.string().min(1).max(50),
  productionWh: z.number().finite(),
  consumptionWh: z.number().finite(),
  irradianceWm2: z.number().finite().optional(),
  temperatureC: z.number().finite().optional(),
});

export const weatherSnapshotSchema = z.object({
  timestamp: z.string().min(1).max(50),
  irradianceWm2: z.number().finite(),
  temperatureC: z.number().finite(),
  cloudCover: z.number().min(0).max(1),
  precipitationProbability: z.number().min(0).max(1).optional(),
});

// Named to avoid colliding with the calendar-source event schema in settings.ts.
export const forecastCalendarEventSchema = z.object({
  id: z.string().min(1).max(255),
  calendarEntityId: z.string().max(255).optional(),
  title: z.string().min(1).max(500),
  start: z.string().min(1).max(50),
  end: z.string().min(1).max(50),
  allDay: z.boolean(),
  kind: forecastEventKindSchema,
  description: z.string().max(5000).optional(),
  location: z.string().max(500).optional(),
  expectedEnergyWh: z.number().finite().optional(),
});

export const deviceForecastInputSchema = z.object({
  deviceId: z.string().min(1).max(255),
  type: z.string().min(1).max(100),
  ratedPowerW: z.number().nonnegative().max(100_000_000).optional(),
  consumptionProfileWh: z.array(z.number().finite()).max(24).optional(),
});

export const forecastSettingsSchema = z.object({
  recencyWeight: z.number().min(0).max(1),
  historyDays: z.number().int().min(1).max(3650),
  combinedWeatherWeight: z.number().min(0).max(1),
});

export const forecastInputSchema = z.object({
  method: forecastMethodSchema,
  horizon: forecastHorizonSchema,
  history: z.array(historicalSampleSchema).max(100_000),
  weather: z.array(weatherSnapshotSchema).max(100_000),
  calendarEvents: z.array(forecastCalendarEventSchema).max(10_000),
  devices: z.array(deviceForecastInputSchema).max(10_000),
  settings: forecastSettingsSchema,
});

export type ForecastInputSchema = z.infer<typeof forecastInputSchema>;
