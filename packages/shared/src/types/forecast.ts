/** Forecast, load-planning and calendar domain types. */

import type { Device } from './device.js';

export type ForecastMethod = 'time_series' | 'weather_regression' | 'combined';

export const FORECAST_METHODS: ForecastMethod[] = ['time_series', 'weather_regression', 'combined'];

export type ForecastHorizon = 'day' | 'week' | 'total';

/** One forecast point: expected residual PV energy for a time slice. */
export interface ForecastPoint {
  /** ISO timestamp of the slice start. */
  timestamp: string;
  /** Expected PV production in Wh for the slice. */
  expectedProductionWh: number;
  /** Expected consumption in Wh for the slice. */
  expectedConsumptionWh: number;
  /** Residual (production - consumption) in Wh. Negative = deficit. */
  residualWh: number;
  /** Confidence 0..1. */
  confidence: number;
}

export interface Forecast {
  id: string;
  method: ForecastMethod;
  horizon: ForecastHorizon;
  /** ISO timestamp the forecast was generated. */
  generatedAt: string;
  /** Start of the forecast window. */
  start: string;
  /** End of the forecast window. */
  end: string;
  points: ForecastPoint[];
  /** Total residual energy over the window in Wh. */
  totalResidualWh: number;
  /** Total expected production in Wh. */
  totalProductionWh: number;
  /** Total expected consumption in Wh. */
  totalConsumptionWh: number;
  /** Overall confidence 0..1. */
  confidence: number;
}

export interface WeatherSnapshot {
  timestamp: string;
  /** Global horizontal irradiance W/m^2. */
  irradianceWm2: number;
  /** Ambient temperature celsius. */
  temperatureC: number;
  /** Cloud cover 0..1. */
  cloudCover: number;
  /** Optional precipitation probability 0..1. */
  precipitationProbability?: number;
}

export interface ForecastInput {
  method: ForecastMethod;
  horizon: ForecastHorizon;
  history: HistoricalSample[];
  weather: WeatherSnapshot[];
  calendarEvents: CalendarEvent[];
  devices: DeviceForecastInput[];
  settings: ForecastSettings;
}

export interface DeviceForecastInput {
  deviceId: string;
  type: string;
  ratedPowerW?: number;
  /** Typical consumption profile per hour of day (Wh), index 0..23. */
  consumptionProfileWh?: number[];
}

export interface HistoricalSample {
  timestamp: string;
  productionWh: number;
  consumptionWh: number;
  irradianceWm2?: number;
  temperatureC?: number;
}

export interface ForecastSettings {
  /** Weight of newer data, 0..1. Higher = newer data weighted more. */
  recencyWeight: number;
  /** Number of historical days to use. */
  historyDays: number;
  /** Blend factor for the combined method (0 = time series, 1 = weather). */
  combinedWeatherWeight: number;
}

export interface CalendarEvent {
  id: string;
  /** HA calendar entity id this event came from, if any. */
  calendarEntityId?: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  /** PVM event category used by the planner. */
  kind: CalendarEventKind;
  description?: string;
  location?: string;
  /** Optional expected extra consumption in Wh (e.g. EV charging). */
  expectedEnergyWh?: number;
}

export const CALENDAR_EVENT_KINDS = [
  'holiday',
  'work',
  'commute',
  'charging',
  'maintenance',
  'other',
] as const;
export type CalendarEventKind = (typeof CALENDAR_EVENT_KINDS)[number];

export interface CalendarSource {
  id: string;
  name: string;
  /** HA calendar entity id. */
  entityId: string;
  /** Refresh interval in minutes. */
  refreshMinutes: number;
  enabled: boolean;
  lastSyncAt?: string;
  lastError?: string;
}

/** A single scheduled action in the load plan. */
export interface PlanSlot {
  deviceId: string;
  deviceName: string;
  start: string;
  end: string;
  /** Target power in watts. */
  powerW: number;
  priority: number;
  reason: string;
}

export interface LoadPlan {
  id: string;
  generatedAt: string;
  start: string;
  end: string;
  slots: PlanSlot[];
  /** Devices the planner recommends switching off. */
  shutdowns: Array<{ deviceId: string; reason: string }>;
  /** Human readable summary conditions that shaped the plan. */
  conditions: string[];
  /** Deterministic hash of the inputs, for reproducibility. */
  inputHash: string;
}

export interface PlannerSettings {
  /** Safety reserve as fraction of battery capacity (0..1). */
  batteryReserveFraction: number;
  /** Whether comfort (temperature) constraints are hard limits. */
  comfortIsHardLimit: boolean;
  /** Maximum grid import in watts before load shedding kicks in. */
  maxGridImportW: number;
  /** Whether dynamic price signals should shape the plan. */
  usePriceSignals: boolean;
  /** Minimum priority a device must have to be scheduled. */
  minSchedulePriority: number;
}

export interface PlannerInput {
  forecast: Forecast;
  devices: Device[];
  batteryLevelPercent: number;
  batteryCapacityWh: number;
  weather: WeatherSnapshot[];
  calendarEvents: CalendarEvent[];
  settings: PlannerSettings;
}
