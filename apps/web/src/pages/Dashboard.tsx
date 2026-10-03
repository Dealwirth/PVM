import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api.js';
import { Card, ErrorBanner, Spinner, Stat } from '../components/ui.js';

interface DashboardSummary {
  generatedAt: string;
  ha: { connected: boolean; url: string; haVersion?: string };
  devices: {
    total: number;
    active: number;
    error: number;
    byType: Record<string, number>;
    totalPowerW: number;
  };
  forecast?: {
    method: string;
    horizon: string;
    totalProductionWh: number;
    totalConsumptionWh: number;
    totalResidualWh: number;
    confidence: number;
  };
  plan?: { slots: number; shutdowns: number; start: string; end: string };
  safety: { recentReactions: number; mode: string };
  log: { recentErrors: number };
  requiredSettings: { complete: boolean; missing: Array<{ key: string; label: string }> };
}

export function DashboardPage(): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const summary = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardSummary>('/dashboard'),
    refetchInterval: 10_000,
  });
  const runCycle = useMutation({
    mutationFn: () => api.post('/dashboard/run-cycle'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['dashboard'] }),
  });

  if (summary.isLoading) return <Spinner />;
  if (summary.error) {
    return (
      <ErrorBanner
        message={(summary.error as Error).message}
        onRetry={() => void summary.refetch()}
      />
    );
  }
  const data = summary.data!;
  const kwh = (wh: number): string => `${(wh / 1000).toFixed(1)} kWh`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('dashboard.title')}</h1>
        <button
          type="button"
          className="pvm-btn-primary"
          onClick={() => runCycle.mutate()}
          disabled={runCycle.isPending}
        >
          {t('dashboard.runCycle')}
        </button>
      </div>

      {!data.requiredSettings.complete && (
        <ErrorBanner
          code="PVM-001"
          message={t('settings.missing')}
          remediation={data.requiredSettings.missing.map((m) => m.label).join(', ')}
        />
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label={t('dashboard.totalPower')}
          value={`${data.devices.totalPowerW.toFixed(0)} W`}
        />
        <Stat
          label={t('dashboard.deviceCount')}
          value={data.devices.total}
          hint={`${data.devices.active} ${t('common.active')}`}
        />
        <Stat
          label={t('dashboard.residual')}
          value={data.forecast ? kwh(data.forecast.totalResidualWh) : '—'}
        />
        <Stat
          label={t('dashboard.production')}
          value={data.forecast ? kwh(data.forecast.totalProductionWh) : '—'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t('dashboard.plan')}>
          {data.plan ? (
            <ul className="space-y-1 text-sm text-gray-300">
              <li>{data.plan.slots} Slots</li>
              <li>{data.plan.shutdowns} Abschaltungen</li>
              <li>
                {new Date(data.plan.start).toLocaleString()} –{' '}
                {new Date(data.plan.end).toLocaleString()}
              </li>
            </ul>
          ) : (
            <p className="text-sm text-gray-400">{t('dashboard.noForecast')}</p>
          )}
        </Card>
        <Card title={t('nav.safety')}>
          <ul className="space-y-1 text-sm text-gray-300">
            <li>Modus: {data.safety.mode}</li>
            <li>{data.safety.recentReactions} Ereignisse (24h)</li>
            <li>{data.log.recentErrors} Fehler (60s)</li>
            <li>
              HA: {data.ha.connected ? `verbunden (${data.ha.haVersion ?? '?'})` : 'getrennt'}
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
