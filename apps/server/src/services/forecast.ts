import type {
  Forecast,
  ForecastInput,
  ForecastPoint,
  HistoricalSample,
  WeatherSnapshot,
} from '@pvm/shared';
import { newId, round, startOfHour } from '@pvm/shared';
import type { ForecastRepository } from '../db/repositories/forecast.js';
import type { DevLog } from './devlog.js';

/** Simple ordinary least squares on (x, y). */
export function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number } {
  const n = Math.min(xs.length, ys.length);
  if (n === 0) return { slope: 0, intercept: 0 };
  if (n === 1) return { slope: 0, intercept: ys[0] ?? 0 };
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = (xs[i] ?? 0) - meanX;
    num += dx * ((ys[i] ?? 0) - meanY);
    den += dx * dx;
  }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: meanY - slope * meanX };
}

/** Weighted linear regression, newest samples weighted highest. */
export function weightedRegression(
  xs: number[],
  ys: number[],
  recencyWeight: number,
): { slope: number; intercept: number } {
  const n = Math.min(xs.length, ys.length);
  if (n === 0) return { slope: 0, intercept: 0 };
  const weights = Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 1 : i / (n - 1);
    return 1 + recencyWeight * t;
  });
  const sumW = weights.reduce((a, b) => a + b, 0);
  const meanX = xs.slice(0, n).reduce((a, b, i) => a + b * (weights[i] ?? 1), 0) / sumW;
  const meanY = ys.slice(0, n).reduce((a, b, i) => a + b * (weights[i] ?? 1), 0) / sumW;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    const w = weights[i] ?? 1;
    const dx = (xs[i] ?? 0) - meanX;
    num += w * dx * ((ys[i] ?? 0) - meanY);
    den += w * dx * dx;
  }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: meanY - slope * meanX };
}

/**
 * Deterministic forecast engine.
 *
 * All randomness is avoided; identical inputs always produce identical output,
 * which is required for testability and reproducibility.
 */
export class ForecastService {
  constructor(
    private readonly repo: ForecastRepository,
    private readonly log: DevLog,
  ) {}

  generate(input: ForecastInput): Forecast {
    const horizonHours = input.horizon === 'day' ? 24 : input.horizon === 'week' ? 24 * 7 : 24 * 14;
    const start = startOfHour(new Date());
    const now = Date.now();

    const history = [...input.history].sort(
      (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
    );
    const weather = [...input.weather].sort(
      (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
    );

    const tsModel = this.buildTimeSeriesModel(history, input.settings.recencyWeight);
    const weatherModel = this.buildWeatherModel(history, input.settings.recencyWeight);

    const points: ForecastPoint[] = [];
    for (let i = 0; i < horizonHours; i += 1) {
      const ts = new Date(start.getTime() + i * 3_600_000);
      const hourOfDay = ts.getHours();
      const wx = pickWeather(weather, ts);
      const irradiance = wx?.irradianceWm2 ?? 0;

      let production: number;
      if (input.method === 'time_series') {
        production = tsModel(hourOfDay);
      } else if (input.method === 'weather_regression') {
        production = weatherModel(irradiance, wx?.temperatureC ?? 15);
      } else {
        const w = input.settings.combinedWeatherWeight;
        production =
          w * weatherModel(irradiance, wx?.temperatureC ?? 15) + (1 - w) * tsModel(hourOfDay);
      }
      production = Math.max(0, production);

      const consumption = this.expectedConsumption(input, ts);
      const residual = production - consumption;
      points.push({
        timestamp: ts.toISOString(),
        expectedProductionWh: round(production, 1),
        expectedConsumptionWh: round(consumption, 1),
        residualWh: round(residual, 1),
        confidence: round(this.confidenceFor(i, weather.length), 3),
      });
    }

    const totalProductionWh = round(
      points.reduce((a, p) => a + p.expectedProductionWh, 0),
      1,
    );
    const totalConsumptionWh = round(
      points.reduce((a, p) => a + p.expectedConsumptionWh, 0),
      1,
    );
    const forecast: Forecast = {
      id: newId('fc'),
      method: input.method,
      horizon: input.horizon,
      generatedAt: new Date(now).toISOString(),
      start: start.toISOString(),
      end: new Date(start.getTime() + horizonHours * 3_600_000).toISOString(),
      points,
      totalProductionWh,
      totalConsumptionWh,
      totalResidualWh: round(totalProductionWh - totalConsumptionWh, 1),
      confidence: round(
        points.reduce((a, p) => a + p.confidence, 0) / Math.max(1, points.length),
        3,
      ),
    };
    this.repo.save(forecast);
    this.log.info('forecast', 'Forecast generated', {
      id: forecast.id,
      method: forecast.method,
      horizon: forecast.horizon,
      totalResidualWh: forecast.totalResidualWh,
    });
    return forecast;
  }

  latest(horizon?: string): Forecast | undefined {
    return this.repo.latest(horizon);
  }

  history(limit = 50): Forecast[] {
    return this.repo.history(limit);
  }

  private buildTimeSeriesModel(
    history: HistoricalSample[],
    recencyWeight: number,
  ): (hourOfDay: number) => number {
    // Average production per hour-of-day, weighted by recency.
    const buckets = new Map<number, { sum: number; weight: number }>();
    const n = history.length;
    history.forEach((sample, i) => {
      const hour = new Date(sample.timestamp).getHours();
      const t = n <= 1 ? 1 : i / (n - 1);
      const w = 1 + recencyWeight * t;
      const bucket = buckets.get(hour) ?? { sum: 0, weight: 0 };
      bucket.sum += sample.productionWh * w;
      bucket.weight += w;
      buckets.set(hour, bucket);
    });
    const overall = n > 0 ? history.reduce((a, s) => a + s.productionWh, 0) / n : 0;
    return (hourOfDay: number): number => {
      const bucket = buckets.get(hourOfDay);
      if (!bucket || bucket.weight === 0) return overall;
      return bucket.sum / bucket.weight;
    };
  }

  private buildWeatherModel(
    history: HistoricalSample[],
    recencyWeight: number,
  ): (irradiance: number, temperatureC: number) => number {
    const samples = history.filter((s) => typeof s.irradianceWm2 === 'number');
    if (samples.length === 0) return () => 0;
    const xs = samples.map((s) => s.irradianceWm2 as number);
    const ys = samples.map((s) => s.productionWh);
    const { slope, intercept } = weightedRegression(xs, ys, recencyWeight);
    return (irradiance: number): number => Math.max(0, intercept + slope * irradiance);
  }

  private expectedConsumption(input: ForecastInput, ts: Date): number {
    const hour = ts.getHours();
    let total = 0;
    for (const device of input.devices) {
      if (device.consumptionProfileWh && device.consumptionProfileWh.length === 24) {
        total += device.consumptionProfileWh[hour] ?? 0;
      } else if (device.ratedPowerW) {
        // Assume 20% duty cycle for non-profiled loads.
        total += device.ratedPowerW * 0.2;
      }
    }
    // Calendar-driven extra consumption (e.g. EV charging).
    for (const event of input.calendarEvents) {
      if (event.expectedEnergyWh && within(ts, event.start, event.end)) {
        const hours = Math.max(1, (Date.parse(event.end) - Date.parse(event.start)) / 3_600_000);
        total += event.expectedEnergyWh / hours;
      }
    }
    return total;
  }

  private confidenceFor(step: number, weatherCount: number): number {
    const decay = 1 / (1 + step / 48);
    const weatherBonus = weatherCount > 0 ? 0.15 : 0;
    return Math.min(1, Math.max(0.05, decay * 0.85 + weatherBonus));
  }
}

function pickWeather(weather: WeatherSnapshot[], ts: Date): WeatherSnapshot | undefined {
  const target = ts.getTime();
  let best: WeatherSnapshot | undefined;
  let bestDiff = Infinity;
  for (const w of weather) {
    const diff = Math.abs(Date.parse(w.timestamp) - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = w;
    }
  }
  return best;
}

function within(ts: Date, startIso: string, endIso: string): boolean {
  const t = ts.getTime();
  return t >= Date.parse(startIso) && t <= Date.parse(endIso);
}
