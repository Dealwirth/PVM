import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { BackupCounts, BackupImportResult, PvmBackup } from '@pvm/shared';
import { api, downloadFile } from '../lib/api.js';
import { Badge, Card, ErrorBanner } from './ui.js';

type BackupInfo = { counts: BackupCounts; version: string };

/**
 * Backup & restore card.
 *
 * Lets the operator download a full JSON backup and restore one later. The UI
 * explains what is (and is not) included so non-experts understand the impact
 * before they act. The "Backup/Export" master switch in the general settings
 * gates the actions; when it is off the card offers a one-click enable.
 */
export function BackupCard({
  enabled,
  onEnable,
}: {
  enabled: boolean;
  onEnable: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const fileInput = useRef<HTMLInputElement>(null);

  const info = useQuery({
    queryKey: ['backup-info'],
    queryFn: () => api.get<BackupInfo>('/backup/info'),
  });

  const exportBackup = useMutation({
    mutationFn: () =>
      downloadFile(
        `/backup/export?secrets=${includeSecrets ? 'true' : 'false'}`,
        `pvm-backup-${new Date().toISOString().slice(0, 10)}.json`,
      ),
    onSuccess: () => setMessage({ ok: true, text: t('settings.backup.exportSuccess') }),
    onError: (err) =>
      setMessage({
        ok: false,
        text: `${t('settings.backup.importError')}: ${(err as Error).message}`,
      }),
  });

  const importBackup = useMutation({
    mutationFn: (backup: PvmBackup) => api.post<BackupImportResult>('/backup/import', backup),
    onSuccess: () => {
      setMessage({ ok: true, text: t('settings.backup.importSuccess') });
      // A restore replaces all data; reload so every page shows fresh values.
      window.location.reload();
    },
    onError: (err) =>
      setMessage({
        ok: false,
        text: `${t('settings.backup.importError')}: ${(err as Error).message}`,
      }),
  });

  const onFile = async (file: File | undefined): Promise<void> => {
    setMessage(undefined);
    if (!file) return;
    if (!window.confirm(t('settings.backup.importConfirm'))) {
      if (fileInput.current) fileInput.current.value = '';
      return;
    }
    try {
      const backup = JSON.parse(await file.text()) as PvmBackup;
      importBackup.mutate(backup);
    } catch {
      setMessage({ ok: false, text: t('settings.backup.importError') });
    }
  };

  const c = info.data?.counts;

  return (
    <Card title={t('settings.backup.title')}>
      <div className="space-y-3">
        <p className="text-sm text-gray-400">{t('settings.backup.description')}</p>

        <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3 text-xs text-gray-400">
          <p className="font-medium text-gray-300">{t('settings.backup.includesTitle')}</p>
          <p className="mt-1">{t('settings.backup.includesText')}</p>
          <p className="mt-1 text-amber-300/90">{t('settings.backup.excludesText')}</p>
        </div>

        {c && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-400 md:grid-cols-3">
            <div className="flex justify-between">
              <dt>{t('settings.backup.countsDevices')}</dt>
              <dd className="text-gray-200">{c.devices}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{t('settings.backup.countsHistory')}</dt>
              <dd className="text-gray-200">{c.history}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{t('settings.backup.countsPlans')}</dt>
              <dd className="text-gray-200">{c.plans}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{t('settings.backup.countsCalendar')}</dt>
              <dd className="text-gray-200">{c.calendarEvents}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{t('settings.backup.countsAddons')}</dt>
              <dd className="text-gray-200">{c.addons}</dd>
            </div>
          </dl>
        )}

        <label className="flex items-start gap-2 text-xs text-gray-300">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-ha-primary"
            checked={includeSecrets}
            onChange={(e) => setIncludeSecrets(e.target.checked)}
          />
          <span>
            {t('settings.backup.exportWithSecrets')}
            <span className="block text-gray-500">
              {t('settings.backup.exportWithSecretsHint')}
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="pvm-btn-primary"
            disabled={!enabled || exportBackup.isPending}
            onClick={() => exportBackup.mutate()}
          >
            {exportBackup.isPending ? t('common.loading') : t('settings.backup.exportButton')}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <button
            type="button"
            className="pvm-btn-ghost"
            disabled={!enabled || importBackup.isPending}
            onClick={() => fileInput.current?.click()}
          >
            {importBackup.isPending ? t('common.loading') : t('settings.backup.importButton')}
          </button>
          {includeSecrets && enabled && (
            <Badge tone="warning">{t('settings.backup.secretsIncluded')}</Badge>
          )}
        </div>

        {!enabled && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-800 bg-gray-950/40 p-3 text-xs text-gray-400">
            <span>{t('settings.backup.disabledHint')}</span>
            <button type="button" className="pvm-btn-ghost" onClick={onEnable}>
              {t('settings.backup.enableButton')}
            </button>
          </div>
        )}

        <p className="text-xs text-gray-500">{t('settings.backup.importHint')}</p>

        {message && (
          <p className={`text-xs ${message.ok ? 'text-green-300' : 'text-red-300'}`}>
            {message.text}
          </p>
        )}
        {importBackup.isError && (
          <ErrorBanner code="PVM-021" message={t('settings.backup.importError')} />
        )}
      </div>
    </Card>
  );
}
