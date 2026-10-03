import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { LogEntry, LogLevel } from '@pvm/shared';
import { api } from '../lib/api.js';
import { Badge, Card, Spinner } from '../components/ui.js';
import { useRealtime } from '../hooks/useRealtime.js';

const LEVEL_TONE: Record<LogLevel, 'neutral' | 'info' | 'warning' | 'error'> = {
  DEBUG: 'neutral',
  INFO: 'info',
  WARN: 'warning',
  ERROR: 'error',
  FATAL: 'error',
};

export function DevLogPage(): JSX.Element {
  const { t } = useTranslation();
  const [level, setLevel] = useState<LogLevel | ''>('');
  const [live, setLive] = useState<LogEntry[]>([]);
  const [liveEnabled, setLiveEnabled] = useState(true);

  const logs = useQuery({
    queryKey: ['logs', level],
    queryFn: () => api.get<LogEntry[]>(`/logs?limit=500${level ? `&level=${level}` : ''}`),
  });

  useRealtime((msg) => {
    if (msg.channel === 'logs' && liveEnabled) {
      setLive((prev) => [msg.payload as LogEntry, ...prev].slice(0, 300));
    }
  });

  useEffect(() => {
    if (logs.data) setLive(logs.data.slice(0, 300));
  }, [logs.data]);

  const download = (format: 'json' | 'csv'): void => {
    const token = localStorage.getItem('pvm.token');
    const url = `/api/logs/export?format=${format}${level ? `&level=${level}` : ''}`;
    void fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => r.text())
      .then((text) => {
        const blob = new Blob([text], { type: format === 'csv' ? 'text/csv' : 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `devlog.${format}`;
        a.click();
        URL.revokeObjectURL(a.href);
      });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t('devlog.title')}</h1>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-gray-400">
            <input
              type="checkbox"
              className="accent-ha-primary"
              checked={liveEnabled}
              onChange={(e) => setLiveEnabled(e.target.checked)}
            />
            {t('devlog.live')}
          </label>
          <select
            className="pvm-input w-32"
            value={level}
            onChange={(e) => setLevel(e.target.value as LogLevel | '')}
          >
            <option value="">{t('common.all')}</option>
            {(['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'] as LogLevel[]).map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <button type="button" className="pvm-btn-ghost" onClick={() => download('json')}>
            {t('devlog.exportJson')}
          </button>
          <button type="button" className="pvm-btn-ghost" onClick={() => download('csv')}>
            {t('devlog.exportCsv')}
          </button>
        </div>
      </div>

      <Card>
        {logs.isLoading && <Spinner />}
        <div className="max-h-[70vh] overflow-auto font-mono text-xs">
          {live.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-2 border-b border-ha-border/40 py-1"
            >
              <span className="w-40 shrink-0 text-gray-500">
                {new Date(entry.timestamp).toLocaleString()}
              </span>
              <Badge tone={LEVEL_TONE[entry.level]}>{entry.level}</Badge>
              <span className="w-24 shrink-0 text-gray-400">{entry.category}</span>
              <span className="text-gray-200">{entry.message}</span>
              {entry.errorCode && <span className="text-red-400">{entry.errorCode}</span>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
