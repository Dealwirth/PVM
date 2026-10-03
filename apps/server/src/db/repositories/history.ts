import type { HistoricalSample, WeatherSnapshot } from '@pvm/shared';
import type { Db } from '../index.js';

export interface HistoryRecordInput {
  deviceId: string;
  timestamp: string;
  powerW?: number;
  energyWh?: number;
  temperatureC?: number;
  state?: string;
  raw?: Record<string, unknown>;
}

export interface DeviceHistoryPoint {
  timestamp: string;
  powerW?: number;
  energyWh?: number;
  temperatureC?: number;
  state?: string;
}

export class HistoryRepository {
  constructor(private readonly db: Db) {}

  add(record: HistoryRecordInput): void {
    this.db
      .prepare(
        `INSERT INTO history (device_id, timestamp, power_w, energy_wh, temperature_c, state, raw)
         VALUES (@deviceId, @timestamp, @powerW, @energyWh, @temperatureC, @state, @raw)`,
      )
      .run({
        deviceId: record.deviceId,
        timestamp: record.timestamp,
        powerW: record.powerW ?? null,
        energyWh: record.energyWh ?? null,
        temperatureC: record.temperatureC ?? null,
        state: record.state ?? null,
        raw: record.raw ? JSON.stringify(record.raw) : null,
      });
  }

  addMany(records: HistoryRecordInput[]): void {
    const insert = this.db.transaction((rows: HistoryRecordInput[]) => {
      for (const row of rows) this.add(row);
    });
    insert(records);
  }

  forDevice(deviceId: string, since?: string, until?: string): DeviceHistoryPoint[] {
    const clauses = ['device_id = ?'];
    const params: unknown[] = [deviceId];
    if (since) {
      clauses.push('timestamp >= ?');
      params.push(since);
    }
    if (until) {
      clauses.push('timestamp <= ?');
      params.push(until);
    }
    const rows = this.db
      .prepare(`SELECT * FROM history WHERE ${clauses.join(' AND ')} ORDER BY timestamp ASC`)
      .all(...params) as Array<{
      timestamp: string;
      power_w: number | null;
      energy_wh: number | null;
      temperature_c: number | null;
      state: string | null;
    }>;
    return rows.map((r) => ({
      timestamp: r.timestamp,
      powerW: r.power_w ?? undefined,
      energyWh: r.energy_wh ?? undefined,
      temperatureC: r.temperature_c ?? undefined,
      state: r.state ?? undefined,
    }));
  }

  addProduction(sample: HistoricalSample): void {
    this.db
      .prepare(
        `INSERT INTO production_history (timestamp, production_wh, consumption_wh, irradiance_wm2, temperature_c)
         VALUES (@timestamp, @productionWh, @consumptionWh, @irradiance, @temperature)`,
      )
      .run({
        timestamp: sample.timestamp,
        productionWh: sample.productionWh,
        consumptionWh: sample.consumptionWh,
        irradiance: sample.irradianceWm2 ?? null,
        temperature: sample.temperatureC ?? null,
      });
  }

  productionHistory(sinceDays: number): HistoricalSample[] {
    const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString();
    const rows = this.db
      .prepare('SELECT * FROM production_history WHERE timestamp >= ? ORDER BY timestamp ASC')
      .all(since) as Array<{
      timestamp: string;
      production_wh: number;
      consumption_wh: number;
      irradiance_wm2: number | null;
      temperature_c: number | null;
    }>;
    return rows.map((r) => ({
      timestamp: r.timestamp,
      productionWh: r.production_wh,
      consumptionWh: r.consumption_wh,
      irradianceWm2: r.irradiance_wm2 ?? undefined,
      temperatureC: r.temperature_c ?? undefined,
    }));
  }

  saveWeather(snapshot: WeatherSnapshot): void {
    this.db
      .prepare(
        `INSERT INTO production_history (timestamp, production_wh, consumption_wh, irradiance_wm2, temperature_c)
         VALUES (@timestamp, 0, 0, @irradiance, @temperature)`,
      )
      .run({
        timestamp: snapshot.timestamp,
        irradiance: snapshot.irradianceWm2,
        temperature: snapshot.temperatureC,
      });
  }
}
