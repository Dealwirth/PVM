import { z } from 'zod';
import {
  CONTROL_CAPABILITIES,
  DEVICE_STATUSES,
  DEVICE_TYPES,
  ENTITY_ROLES,
  SENSOR_MASKS,
} from '../types/device.js';

export const deviceTypeSchema = z.enum(DEVICE_TYPES);
export const sensorMaskSchema = z.enum(SENSOR_MASKS);
export const deviceStatusSchema = z.enum(DEVICE_STATUSES);
export const controlCapabilitySchema = z.enum(CONTROL_CAPABILITIES);
export const entityRoleSchema = z.enum(ENTITY_ROLES);

export const deviceEntitySchema = z.object({
  entityId: z.string().min(1).max(255),
  role: entityRoleSchema,
  name: z.string().min(1).max(255),
  unit: z.string().max(50).optional(),
  deviceClass: z.string().max(100).optional(),
  stateClass: z.string().max(100).optional(),
  value: z.union([z.number(), z.string(), z.boolean(), z.null()]).optional(),
  controllable: z.boolean().default(false),
  domain: z.string().min(1).max(100),
});

export const deviceCreateSchema = z.object({
  name: z.string().min(1).max(255),
  type: deviceTypeSchema,
  priority: z.number().int().min(0).max(100).optional(),
  sensorMask: sensorMaskSchema.optional(),
  capabilities: z.array(controlCapabilitySchema).optional(),
  entities: z
    .array(deviceEntitySchema.partial().extend({ entityId: z.string().min(1).max(255) }))
    .optional(),
  ratedPowerW: z.number().nonnegative().max(10_000_000).optional(),
  minPowerW: z.number().nonnegative().max(10_000_000).optional(),
  allowAutoShutdown: z.boolean().optional(),
  controllable: z.boolean().optional(),
  tags: z.array(z.string().max(50)).max(50).optional(),
  location: z.string().max(255).optional(),
  haDeviceId: z.string().max(255).optional(),
  manuallyAdded: z.boolean().optional(),
});

export const deviceUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: deviceTypeSchema.optional(),
  status: deviceStatusSchema.optional(),
  priority: z.number().int().min(0).max(100).optional(),
  sensorMask: sensorMaskSchema.optional(),
  capabilities: z.array(controlCapabilitySchema).optional(),
  entities: z.array(deviceEntitySchema).optional(),
  ratedPowerW: z.number().nonnegative().max(10_000_000).optional(),
  minPowerW: z.number().nonnegative().max(10_000_000).optional(),
  allowAutoShutdown: z.boolean().optional(),
  controllable: z.boolean().optional(),
  tags: z.array(z.string().max(50)).max(50).optional(),
  location: z.string().max(255).optional(),
});

export const deviceCommandSchema = z.object({
  capability: controlCapabilitySchema,
  value: z.union([z.number(), z.boolean(), z.string().max(255)]),
  source: z.enum(['user', 'planner', 'safety', 'self_healing', 'api']).default('api'),
  reason: z.string().max(500).optional(),
});

export type DeviceCreateSchema = z.infer<typeof deviceCreateSchema>;
export type DeviceUpdateSchema = z.infer<typeof deviceUpdateSchema>;
export type DeviceCommandSchema = z.infer<typeof deviceCommandSchema>;
