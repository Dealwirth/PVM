import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Severity } from '@pvm/shared';
import { api } from '../lib/api.js';
import { Badge, Card, Spinner } from '../components/ui.js';

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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('safety.title')}</h1>
        <div className="flex gap-2">
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
        </div>
      </div>

      <Card title={t('safety.events')}>
        {events.isLoading && <Spinner />}
        {(events.data ?? []).length === 0 && <p className="text-sm text-gray-400">—</p>}
        <ul className="space-y-1 text-sm">
          {(events.data ?? []).map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between rounded border border-ha-border px-3 py-1"
            >
              <span className="flex items-center gap-2">
                <Badge tone={SEV_TONE[e.severity]}>{e.code}</Badge>
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
