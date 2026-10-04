import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { CalendarEvent, CalendarSource } from '@pvm/shared';
import { api } from '../lib/api.js';
import { Badge, Card, EmptyState, ErrorBanner, PageHeader, Spinner } from '../components/ui.js';

export function CalendarPage(): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [entityId, setEntityId] = useState('');
  const [name, setName] = useState('');
  const [refreshMinutes, setRefresh] = useState(60);

  const sources = useQuery({
    queryKey: ['calendar-sources'],
    queryFn: () => api.get<CalendarSource[]>('/calendar/sources'),
  });
  const events = useQuery({
    queryKey: ['calendar-events'],
    queryFn: () => api.get<CalendarEvent[]>('/calendar/events'),
  });

  const addSource = useMutation({
    mutationFn: () =>
      api.post('/calendar/sources', {
        name: name || entityId,
        entityId,
        refreshMinutes,
        enabled: true,
      }),
    onSuccess: () => {
      setEntityId('');
      setName('');
      void qc.invalidateQueries({ queryKey: ['calendar-sources'] });
    },
  });
  const sync = useMutation({
    mutationFn: () => api.post<{ synced: number }>('/calendar/sync'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['calendar-events'] });
      void qc.invalidateQueries({ queryKey: ['calendar-sources'] });
    },
  });
  const removeSource = useMutation({
    mutationFn: (id: string) => api.delete(`/calendar/sources/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['calendar-sources'] }),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('calendar.title')}
        subtitle={t('calendar.subtitle')}
        actions={
          <button
            type="button"
            className="pvm-btn-primary"
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
          >
            {t('calendar.sync')}
          </button>
        }
      />

      <Card title={t('calendar.addSource')}>
        <div className="flex flex-wrap gap-2">
          <input
            className="pvm-input flex-1"
            placeholder="calendar.family"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            aria-label={t('calendar.entityId')}
          />
          <input
            className="pvm-input w-40"
            placeholder={t('common.name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label={t('common.name')}
          />
          <input
            className="pvm-input w-32"
            type="number"
            min={1}
            value={refreshMinutes}
            onChange={(e) => setRefresh(Number(e.target.value))}
            aria-label={t('calendar.refresh')}
          />
          <button
            type="button"
            className="pvm-btn-primary"
            disabled={!entityId || addSource.isPending}
            onClick={() => addSource.mutate()}
          >
            {t('common.add')}
          </button>
        </div>
        {addSource.error && <ErrorBanner message={(addSource.error as Error).message} />}
      </Card>

      <Card title={t('calendar.events')}>
        {sources.isLoading && <Spinner />}
        {sources.error && <ErrorBanner message={(sources.error as Error).message} />}
        <div className="mb-3 space-y-1">
          {(sources.data ?? []).map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded border border-ha-border px-3 py-1 text-sm"
            >
              <span>
                {s.name} <span className="text-xs text-gray-500">({s.entityId})</span>
                {s.lastError && (
                  <span className="ml-2 text-xs text-red-400">
                    {t('calendar.lastError')}: {s.lastError}
                  </span>
                )}
              </span>
              <button
                type="button"
                className="pvm-btn-ghost"
                onClick={() => removeSource.mutate(s.id)}
              >
                {t('common.delete')}
              </button>
            </div>
          ))}
        </div>
        {!sources.isLoading && (sources.data ?? []).length === 0 && (
          <EmptyState message={t('calendar.noSources')} />
        )}

        {events.isLoading && <Spinner />}
        {!events.isLoading && (events.data ?? []).length === 0 && (
          <EmptyState message={t('calendar.noEvents')} />
        )}
        <ul className="space-y-1 text-sm">
          {(events.data ?? []).map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between rounded border border-ha-border px-3 py-1"
            >
              <span>{e.title}</span>
              <span className="flex items-center gap-2 text-xs text-gray-400">
                <Badge tone="info">{t(`calendar.kinds.${e.kind}`)}</Badge>
                {new Date(e.start).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
