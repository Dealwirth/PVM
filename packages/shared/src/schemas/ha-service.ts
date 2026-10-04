import { z } from 'zod';
import { forecastHorizonSchema } from './forecast.js';

/**
 * Payload validation for the ``pvm.*`` Home Assistant service bridge
 * (``POST /api/ha/services/:service``). The HA component forwards a filtered
 * subset of the service call data, so each schema is a loose object that
 * ignores unknown keys while still validating the values it forwards.
 */
const deviceId = z.string().min(1).max(255);

export const setDeviceStateSchema = z.object({
  device_id: deviceId,
  state: z.union([z.string().max(255), z.boolean(), z.number().finite()]),
});

export const setDevicePowerSchema = z.object({
  device_id: deviceId,
  power: z.number().finite().min(0).max(100_000_000),
});

export const setDeviceTemperatureSchema = z.object({
  device_id: deviceId,
  temperature: z.number().finite().min(-100).max(500),
});

const planSlotSchema = z.object({
  deviceId: z.string().min(1).max(255),
  deviceName: z.string().max(255),
  start: z.string().min(1).max(50),
  end: z.string().min(1).max(50),
  powerW: z.number().finite(),
  priority: z.number().int().min(0).max(100),
  reason: z.string().max(1000),
});

export const loadPlanSchema = z.object({
  id: z.string().min(1).max(255),
  generatedAt: z.string().min(1).max(50),
  start: z.string().min(1).max(50),
  end: z.string().min(1).max(50),
  slots: z.array(planSlotSchema).max(10_000),
  shutdowns: z
    .array(
      z.object({
        deviceId: z.string().min(1).max(255),
        reason: z.string().max(1000),
      }),
    )
    .max(10_000),
  conditions: z.array(z.string().max(1000)).max(10_000),
  inputHash: z.string().min(1).max(255),
});

export const updatePlanSchema = z.object({ plan: loadPlanSchema });

export const getForecastSchema = z.object({ horizon: forecastHorizonSchema.optional() });

export const getHistorySchema = z.object({
  device_id: deviceId,
  start: z.string().max(50).optional(),
  end: z.string().max(50).optional(),
});

/**
 * Per-service payload schemas. Services without an entry (e.g. ``get_devices``,
 * ``run_planning_cycle``) accept no meaningful payload and are not validated.
 */
export const HA_SERVICE_SCHEMAS: Record<string, z.ZodTypeAny> = {
  set_device_state: setDeviceStateSchema,
  set_device_power: setDevicePowerSchema,
  set_device_temperature: setDeviceTemperatureSchema,
  update_plan: updatePlanSchema,
  get_forecast: getForecastSchema,
  get_history: getHistorySchema,
};

export function validateHaServicePayload(service: string, payload: unknown): unknown {
  const schema = HA_SERVICE_SCHEMAS[service];
  return schema ? schema.parse(payload) : payload;
}
