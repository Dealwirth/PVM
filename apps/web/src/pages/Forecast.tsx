import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Forecast, LoadPlan } from '@pvm/shared';
import { api } from '../lib/api.js';
import { Card, Spinner, Stat } from '../components/ui.js';

export function ForecastPage(): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const forecast = useQuery({
    queryKey: ['forecast'],
    queryFn: () => api.get<Forecast | null>('/forecast/latest'),
  });
  const plan = useQuery({
    queryKey: ['plan'],
    queryFn: () => api.get<LoadPlan | null>('/plan/latest'),
  });

  const runCycle = useMutation({
    mutationFn: () => api.post('/dashboard/run-cycle'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['forecast'] });
      void qc.invalidateQueries({ queryKey: ['plan'] });
    },
  });

  const data = forecast.data;
  const chartData = (data?.points ?? []).map((p) => ({
    time: new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    production: p.expectedProductionWh,
    consumption: p.expectedConsumptionWh,
    residual: p.residualWh,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('forecast.title')}</h1>
        <button
          type="button"
          className="pvm-btn-primary"
          onClick={() => runCycle.mutate()}
          disabled={runCycle.isPending}
        >
          {t('forecast.generate')}
        </button>
      </div>

      {forecast.isLoading && <Spinner />}
      {!data && !forecast.isLoading && <Card>{t('forecast.noData')}</Card>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label={t('forecast.method')} value={data.method} />
            <Stat label={t('forecast.horizon')} value={data.horizon} />
            <Stat
              label={t('dashboard.production')}
              value={`${(data.totalProductionWh / 1000).toFixed(1)} kWh`}
            />
            <Stat
              label={t('forecast.confidence')}
              value={`${(data.confidence * 100).toFixed(0)} %`}
            />
          </div>

          <Card title={t('forecast.title')}>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="prod" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#03a9f4" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#03a9f4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151' }} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="production"
                    stroke="#03a9f4"
                    fill="url(#prod)"
                    name={t('dashboard.production')}
                  />
                  <Area
                    type="monotone"
                    dataKey="consumption"
                    stroke="#ff9800"
                    fillOpacity={0.1}
                    fill="#ff9800"
                    name={t('dashboard.consumption')}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}

      <Card title={t('dashboard.plan')}>
        {plan.isLoading && <Spinner />}
        {plan.data ? (
          <ul className="space-y-1 text-sm">
            {plan.data.slots.map((slot, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded border border-ha-border px-3 py-1"
              >
                <span>
                  {slot.deviceName} — {slot.powerW} W
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(slot.start).toLocaleString()} ({slot.reason})
                </span>
              </li>
            ))}
            {plan.data.shutdowns.map((s, i) => (
              <li key={`sd-${i}`} className="text-xs text-amber-400">
                Abschaltung: {s.reason}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">{t('forecast.noData')}</p>
        )}
      </Card>
    </div>
  );
}
