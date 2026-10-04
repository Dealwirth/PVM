import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { AddonManifest, InstalledAddon, SecurityScanResult } from '@pvm/shared';
import { api, ApiError } from '../lib/api.js';
import { Badge, Card, EmptyState, ErrorBanner, PageHeader, Spinner } from '../components/ui.js';

type StatusFilter = 'all' | 'enabled' | 'disabled' | 'error';

export function StorePage(): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [githubUrl, setGithubUrl] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [scanResult, setScanResult] = useState<SecurityScanResult | null>(null);
  const [installError, setInstallError] = useState<ApiError | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const installed = useQuery({
    queryKey: ['addons'],
    queryFn: () => api.get<InstalledAddon[]>('/addons'),
  });
  const store = useQuery({
    queryKey: ['addons-store'],
    queryFn: () => api.get<AddonManifest[]>('/addons/store'),
  });

  const install = useMutation({
    mutationFn: (source: string) =>
      api.post<{ addon: InstalledAddon; scan: SecurityScanResult }>('/addons/install', { source }),
    onSuccess: (data) => {
      setScanResult(data.scan);
      setInstallError(null);
      void qc.invalidateQueries({ queryKey: ['addons'] });
    },
    onError: (err) => {
      setInstallError(
        err instanceof ApiError ? err : new ApiError('PVM-020', (err as Error).message),
      );
      setScanResult(null);
    },
  });

  const setEnabled = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.post(`/addons/${id}/${enabled ? 'enable' : 'disable'}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['addons'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/addons/${id}`),
    onSuccess: () => {
      setDetailId(null);
      void qc.invalidateQueries({ queryKey: ['addons'] });
    },
  });

  const installedIds = new Set((installed.data ?? []).map((a) => a.id));
  const manifests = store.data ?? [];
  const primary = manifests.filter((m) => m.priority !== 'optional' && m.category !== 'community');
  const secondary = manifests.filter(
    (m) => m.priority === 'optional' || m.category === 'community',
  );

  const visible = (installed.data ?? []).filter((a) => {
    if (statusFilter === 'enabled') return a.enabled;
    if (statusFilter === 'disabled') return !a.enabled;
    if (statusFilter === 'error') return Boolean(a.lastError);
    return true;
  });
  const detail = (installed.data ?? []).find((a) => a.id === detailId) ?? null;

  return (
    <div className="space-y-4">
      <PageHeader title={t('store.title')} subtitle={t('store.subtitle')} />

      <Card title={t('store.installFromGithub')}>
        <div className="flex flex-wrap gap-2">
          <input
            className="pvm-input flex-1"
            placeholder="https://github.com/owner/repo"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            aria-label={t('store.githubUrl')}
          />
          <button
            type="button"
            className="pvm-btn-primary"
            disabled={!githubUrl || install.isPending}
            onClick={() => install.mutate(githubUrl)}
          >
            {t('store.install')}
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500">{t('store.installHint')}</p>
        {install.isPending && <Spinner />}
        {installError && (
          <div className="mt-2">
            <ErrorBanner
              code={installError.code}
              message={installError.message}
              remediation={installError.remediation}
            />
          </div>
        )}
        {scanResult && (
          <div className="mt-2 text-sm">
            <Badge tone={scanResult.passed ? 'success' : 'error'}>
              {scanResult.passed ? t('store.scanPassed') : t('store.scanFailed')} (
              {scanResult.severity})
            </Badge>
            {scanResult.findings.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-xs text-gray-400">
                {scanResult.findings.slice(0, 5).map((f, i) => (
                  <li key={i}>
                    [{f.severity}] {f.message} {f.file ? `(${f.file}:${f.line ?? '?'})` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      <Card
        title={`${t('store.installed')} (${(installed.data ?? []).length})`}
        actions={
          <select
            className="pvm-input w-36"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            aria-label={t('common.filter')}
          >
            <option value="all">{t('common.all')}</option>
            <option value="enabled">{t('common.enabled')}</option>
            <option value="disabled">{t('common.disabled')}</option>
            <option value="error">{t('common.error')}</option>
          </select>
        }
      >
        {installed.isLoading && <Spinner />}
        {!installed.isLoading && visible.length === 0 && (
          <EmptyState message={t('store.noAddons')} />
        )}
        <div className="grid gap-2 md:grid-cols-2">
          {visible.map((addon) => (
            <div key={addon.id} className="rounded-lg border border-ha-border bg-ha-surfaceAlt p-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="text-left font-medium hover:text-ha-primary"
                  onClick={() => setDetailId(detailId === addon.id ? null : addon.id)}
                >
                  {addon.manifest.name}
                </button>
                <Badge tone={addon.lastError ? 'error' : addon.enabled ? 'success' : 'neutral'}>
                  {addon.lastError
                    ? t('common.error')
                    : addon.enabled
                      ? t('common.enabled')
                      : t('common.disabled')}
                </Badge>
              </div>
              <p className="text-xs text-gray-400">
                v{addon.manifest.version} · {addon.manifest.author}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {t('store.permissions')}: {addon.grantedPermissions.join(', ') || '—'}
              </p>
              {addon.availableVersion && (
                <p className="mt-1">
                  <Badge tone="info">
                    {t('store.updateAvailable')}: v{addon.availableVersion}
                  </Badge>
                </p>
              )}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="pvm-btn-ghost"
                  onClick={() => setEnabled.mutate({ id: addon.id, enabled: !addon.enabled })}
                >
                  {addon.enabled ? t('store.disable') : t('store.enable')}
                </button>
                <button
                  type="button"
                  className="pvm-btn-danger"
                  onClick={() => remove.mutate(addon.id)}
                >
                  {t('store.remove')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {detail && <AddonDetails addon={detail} onClose={() => setDetailId(null)} />}

      <Card title={t('store.available')}>
        {store.isLoading && <Spinner />}
        {!store.isLoading && manifests.length === 0 && (
          <EmptyState message={t('store.noAvailable')} />
        )}
        <div className="grid gap-2 md:grid-cols-2">
          {primary.map((m) => (
            <ManifestCard
              key={m.id}
              manifest={m}
              installed={installedIds.has(m.id)}
              onInstall={() => install.mutate(m.id)}
            />
          ))}
        </div>
        <button type="button" className="pvm-btn-ghost mt-3" onClick={() => setShowMore((v) => !v)}>
          {showMore ? t('common.less') : t('common.more')}
        </button>
        {showMore && (
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {secondary.map((m) => (
              <ManifestCard
                key={m.id}
                manifest={m}
                installed={installedIds.has(m.id)}
                onInstall={() => install.mutate(m.id)}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function AddonDetails({
  addon,
  onClose,
}: {
  addon: InstalledAddon;
  onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const logs = useQuery({
    queryKey: ['addon-logs', addon.id],
    queryFn: () => api.get<{ log: string }>(`/addons/${addon.id}/logs`),
  });

  return (
    <Card
      title={`${addon.manifest.name} — ${t('store.details')}`}
      actions={
        <button type="button" className="pvm-btn-ghost" onClick={onClose}>
          {t('common.close')}
        </button>
      }
    >
      <dl className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
        <div>
          <dt className="text-xs text-gray-500">{t('store.version')}</dt>
          <dd>{addon.manifest.version}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">{t('store.author')}</dt>
          <dd>{addon.manifest.author}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">{t('store.category')}</dt>
          <dd>{addon.manifest.category}</dd>
        </div>
        <div className="col-span-2 md:col-span-3">
          <dt className="text-xs text-gray-500">{t('store.source')}</dt>
          <dd className="break-all">{addon.manifest.repositoryUrl ?? addon.installPath}</dd>
        </div>
      </dl>
      {addon.lastError && (
        <div className="mt-3">
          <ErrorBanner code="PVM-011" message={addon.lastError} />
        </div>
      )}
      <div className="mt-3 border-t border-ha-border pt-3">
        <h3 className="pvm-card-title">{t('store.addonLogs')}</h3>
        {logs.isLoading && <Spinner />}
        {!logs.isLoading && !logs.data?.log && <EmptyState message={t('store.noLogs')} />}
        {logs.data?.log && (
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-ha-surfaceAlt p-2 font-mono text-xs text-gray-300">
            {logs.data.log}
          </pre>
        )}
      </div>
    </Card>
  );
}

function ManifestCard({
  manifest,
  installed,
  onInstall,
}: {
  manifest: AddonManifest;
  installed: boolean;
  onInstall: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-ha-border bg-ha-surfaceAlt p-3">
      <div className="flex items-center justify-between">
        <span className="font-medium">{manifest.name}</span>
        {manifest.recommended && <Badge tone="info">{t('store.recommended')}</Badge>}
      </div>
      <p className="mt-1 text-xs text-gray-400">{manifest.description}</p>
      <p className="mt-1 text-xs text-gray-500">
        v{manifest.version} · {manifest.author} · {manifest.category}
      </p>
      <button
        type="button"
        className="pvm-btn-primary mt-2"
        disabled={installed}
        onClick={onInstall}
      >
        {installed ? t('store.installed') : t('store.install')}
      </button>
    </div>
  );
}
