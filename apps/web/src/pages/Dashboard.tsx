import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api.js';
import { useUnits, formatEnergy, formatPower } from '../lib/units.js';
import {
  Badge,
  Card,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Spinner,
  Stat,
} from '../components/ui.js';

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
  const units = useUnits();
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

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
        actions={
          <button
            type="button"
            className="pvm-btn-primary"
            onClick={() => runCycle.mutate()}
            disabled={runCycle.isPending}
          >
            {runCycle.isPending ? t('dashboard.running') : t('dashboard.runCycle')}
          </button>
        }
      />

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
          value={formatPower(data.devices.totalPowerW, units)}
        />
        <Stat
          label={t('dashboard.deviceCount')}
          value={data.devices.total}
          hint={`${data.devices.active} ${t('common.active')}`}
        />
        <Stat
          label={t('dashboard.residual')}
          value={data.forecast ? formatEnergy(data.forecast.totalResidualWh, units) : '—'}
          hint={t('forecast.residualHint')}
        />
        <Stat
          label={t('dashboard.production')}
          value={data.forecast ? formatEnergy(data.forecast.totalProductionWh, units) : '—'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t('dashboard.plan')}>
          {data.plan ? (
            <ul className="space-y-1 text-sm text-gray-300">
              <li>
                {t('dashboard.slots')}: {data.plan.slots}
              </li>
              <li>
                {t('dashboard.shutdowns')}: {data.plan.shutdowns}
              </li>
              <li>
                {t('dashboard.period')}: {new Date(data.plan.start).toLocaleString()} –{' '}
                {new Date(data.plan.end).toLocaleString()}
              </li>
            </ul>
          ) : (
            <EmptyState message={t('dashboard.planEmpty')} />
          )}
        </Card>
        <Card title={t('dashboard.systemStatus')}>
          <ul className="space-y-2 text-sm text-gray-300">
            <li className="flex items-center justify-between">
              <span>HA</span>
              <Badge tone={data.ha.connected ? 'success' : 'error'}>
                {data.ha.connected
                  ? `${t('app.connected')}${data.ha.haVersion ? ` (${data.ha.haVersion})` : ''}`
                  : t('app.offline')}
              </Badge>
            </li>
            <li className="flex items-center justify-between">
              <span>{t('dashboard.mode')}</span>
              <span>{data.safety.mode}</span>
            </li>
            <li className="flex items-center justify-between">
              <span>{t('dashboard.events24h')}</span>
              <span>{data.safety.recentReactions}</span>
            </li>
            <li className="flex items-center justify-between">
              <span>{t('dashboard.errors60s')}</span>
              <Badge tone={data.log.recentErrors > 0 ? 'warning' : 'success'}>
                {data.log.recentErrors}
              </Badge>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
