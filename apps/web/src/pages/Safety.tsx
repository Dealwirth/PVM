import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Severity } from '@pvm/shared';
import { api } from '../lib/api.js';
import { Badge, Card, EmptyState, ErrorBanner, PageHeader, Spinner } from '../components/ui.js';

interface SafetyEvent {
  id: string;
  timestamp: string;
  code: string;
  category: string;
  severity: Severity;
  action: string;
  deviceId?: string;
  message: string;
}

const SEV_TONE: Record<Severity, 'neutral' | 'info' | 'warning' | 'error'> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  critical: 'error',
};

export function SafetyPage(): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const events = useQuery({
    queryKey: ['safety'],
    queryFn: () => api.get<SafetyEvent[]>('/safety/events'),
  });

  const evaluate = useMutation({
    mutationFn: () => api.post('/safety/evaluate', { totalPowerW: 0 }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['safety'] }),
  });
  const selfHeal = useMutation({
    mutationFn: () => api.post('/safety/self-heal'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['safety'] }),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('safety.title')}
        subtitle={t('safety.subtitle')}
        actions={
          <>
            <button
              type="button"
              className="pvm-btn-ghost"
              onClick={() => evaluate.mutate()}
              disabled={evaluate.isPending}
            >
              {t('safety.evaluate')}
            </button>
            <button
              type="button"
              className="pvm-btn-primary"
              onClick={() => selfHeal.mutate()}
              disabled={selfHeal.isPending}
            >
              {t('safety.selfHeal')}
            </button>
          </>
        }
      />

      {(evaluate.error || selfHeal.error) && (
        <ErrorBanner message={((evaluate.error ?? selfHeal.error) as Error).message} />
      )}

      <Card title={t('safety.events')}>
        {events.isLoading && <Spinner />}
        {events.error && <ErrorBanner message={(events.error as Error).message} />}
        {!events.isLoading && (events.data ?? []).length === 0 && (
          <EmptyState message={t('safety.noEvents')} />
        )}
        <ul className="space-y-1 text-sm">
          {(events.data ?? []).map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-ha-border px-3 py-1"
            >
              <span className="flex items-center gap-2">
                <Badge tone={SEV_TONE[e.severity]}>{e.code}</Badge>
                <Badge tone="neutral">{t(`safety.severities.${e.severity}`)}</Badge>
                <span>{e.message}</span>
              </span>
              <span className="text-xs text-gray-400">
                {e.action} · {new Date(e.timestamp).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
