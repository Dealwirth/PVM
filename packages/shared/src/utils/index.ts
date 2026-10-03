/** Small shared helpers: id generation, hashing, unit conversion, time slicing. */

import { createHash, randomUUID } from 'node:crypto';

export function newId(prefix?: string): string {
  const id = randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}

export function stableHash(input: unknown): string {
  const json = JSON.stringify(input, Object.keys(input as object).sort());
  return createHash('sha256').update(json).digest('hex');
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function wattsToKw(w: number): number {
  return w / 1000;
}

export function kwToWatts(kw: number): number {
  return kw * 1000;
}

export function whToKwh(wh: number): number {
  return wh / 1000;
}

export function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32;
}

export function fahrenheitToCelsius(f: number): number {
  return ((f - 32) * 5) / 9;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Round a Date down to the start of the hour. */
export function startOfHour(date: Date): Date {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

/** Build an array of hourly ISO timestamps from start (inclusive) for `hours`. */
export function hourlyTimestamps(start: Date, hours: number): string[] {
  const base = startOfHour(start);
  return Array.from({ length: hours }, (_, i) =>
    new Date(base.getTime() + i * 3_600_000).toISOString(),
  );
}

export function isLocalUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host === '::1' || host.endsWith('.local')) return true;
  if (host === '127.0.0.1' || host.startsWith('127.')) return true;
  // RFC1918 + link-local + CGNAT ranges
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host)) return true;
  return false;
}
