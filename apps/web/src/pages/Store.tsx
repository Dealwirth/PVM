import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { AddonManifest, InstalledAddon, SecurityScanResult } from '@pvm/shared';
import { api, ApiError } from '../lib/api.js';
import { Badge, Card, ErrorBanner, Spinner } from '../components/ui.js';

export function StorePage(): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [githubUrl, setGithubUrl] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [scanResult, setScanResult] = useState<SecurityScanResult | null>(null);
  const [installError, setInstallError] = useState<ApiError | null>(null);

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
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['addons'] }),
  });

  const installedIds = new Set((installed.data ?? []).map((a) => a.id));
  const manifests = store.data ?? [];
  const primary = manifests.filter((m) => m.priority !== 'optional' && m.category !== 'community');
  const secondary = manifests.filter(
    (m) => m.priority === 'optional' || m.category === 'community',
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t('store.title')}</h1>

      <Card title={t('store.installFromGithub')}>
        <div className="flex flex-wrap gap-2">
          <input
            className="pvm-input flex-1"
            placeholder="https://github.com/owner/repo"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
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

      <Card title={t('store.installed')}>
        {installed.isLoading && <Spinner />}
        {(installed.data ?? []).length === 0 && <p className="text-sm text-gray-400">—</p>}
        <div className="grid gap-2 md:grid-cols-2">
          {(installed.data ?? []).map((addon) => (
            <div key={addon.id} className="rounded-lg border border-ha-border bg-ha-surfaceAlt p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{addon.manifest.name}</span>
                <Badge tone={addon.enabled ? 'success' : 'neutral'}>
                  {addon.enabled ? t('common.enabled') : t('common.disabled')}
                </Badge>
              </div>
              <p className="text-xs text-gray-400">
                v{addon.manifest.version} · {addon.manifest.author}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {t('store.securityMode')}: {addon.grantedPermissions.join(', ') || '—'}
              </p>
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

      <Card title={t('store.available')}>
        {store.isLoading && <Spinner />}
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
