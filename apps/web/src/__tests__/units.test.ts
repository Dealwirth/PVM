import { describe, expect, it } from 'vitest';
import { formatEnergy, formatPower, formatTemperature, type Units } from '../lib/units.js';

const W: Units = { power: 'W', temperature: 'C', energy: 'Wh' };
const METRIC_BIG: Units = { power: 'kW', temperature: 'F', energy: 'kWh' };

describe('unit formatting', () => {
  it('formats power in W and kW', () => {
    expect(formatPower(1234.5, W)).toBe('1235 W');
    expect(formatPower(1234.5, METRIC_BIG)).toBe('1.23 kW');
  });

  it('formats energy in Wh and kWh', () => {
    expect(formatEnergy(1234.5, W)).toBe('1235 Wh');
    expect(formatEnergy(1234.5, METRIC_BIG)).toBe('1.2 kWh');
  });

  it('formats temperature in Celsius and Fahrenheit', () => {
    expect(formatTemperature(21.5, W)).toBe('21.5 °C');
    expect(formatTemperature(0, METRIC_BIG)).toBe('32.0 °F');
    expect(formatTemperature(100, METRIC_BIG)).toBe('212.0 °F');
  });
});
