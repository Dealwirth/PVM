import { useQuery } from '@tanstack/react-query';
import type { Settings } from '@pvm/shared';
import { api } from './api.js';

export interface Units {
  power: 'W' | 'kW';
  temperature: 'C' | 'F';
  energy: 'Wh' | 'kWh';
}

const DEFAULT_UNITS: Units = { power: 'W', temperature: 'C', energy: 'Wh' };

/** Reads the user's unit preferences from settings (cached by React Query). */
export function useUnits(): Units {
  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Settings>('/settings'),
    staleTime: 60_000,
  });
  return data?.general.units ?? DEFAULT_UNITS;
}

export function formatPower(watts: number, units: Units): string {
  return units.power === 'kW' ? `${(watts / 1000).toFixed(2)} kW` : `${Math.round(watts)} W`;
}

export function formatEnergy(wh: number, units: Units): string {
  return units.energy === 'kWh' ? `${(wh / 1000).toFixed(1)} kWh` : `${Math.round(wh)} Wh`;
}

export function formatTemperature(celsius: number, units: Units): string {
  const value = units.temperature === 'F' ? (celsius * 9) / 5 + 32 : celsius;
  return `${value.toFixed(1)} °${units.temperature}`;
}
