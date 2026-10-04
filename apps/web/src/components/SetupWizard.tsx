import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api.js';
import { Badge, Spinner } from './ui.js';

type PublicSettings = {
  ha: {
    url: string;
    token: string;
    tokenSet: boolean;
    localOnly: boolean;
    candidateUrls: string[];
  };
};

interface TestResult {
  ok: boolean;
  url?: string;
  haVersion?: string;
  locationName?: string;
  errorCode?: string;
  message?: string;
}

/**
 * First-run setup assistant.
 *
 * Detects the Home Assistant URL automatically (candidates pushed by the HA
 * custom component or the HA_URL env fallback) so the user only has to paste a
 * Long-Lived Access Token. The connection is verified against the real HA API
 * before it is saved; the token is stored server-side only.
 */
export function SetupWizard({ onDone }: { onDone: () => void }): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<PublicSettings>('/settings'),
  });

  const [token, setToken] = useState('');
  const [urlOverride, setUrlOverride] = useState<string>();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [result, setResult] = useState<TestResult>();

  const knownUrl = useMemo(
    () => urlOverride ?? settings.data?.ha.url ?? settings.data?.ha.candidateUrls?.[0] ?? '',
    [urlOverride, settings.data],
  );

  const test = useMutation({
    mutationFn: () =>
      api.post<TestResult>('/settings/test-ha', {
        ...(knownUrl ? { url: knownUrl } : {}),
        ...(token ? { token } : {}),
      }),
    onSuccess: (r) => setResult(r),
  });

  const save = useMutation({
    mutationFn: (detectedUrl?: string) =>
      api.put<PublicSettings>('/settings', {
        ha: {
          ...(token ? { token } : {}),
          ...(detectedUrl ? { url: detectedUrl } : {}),
        },
        general: { setupDismissed: true },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings'] });
      void qc.invalidateQueries({ queryKey: ['settings-required'] });
      onDone();
    },
  });

  const dismiss = useMutation({
    mutationFn: () => api.put<PublicSettings>('/settings', { general: { setupDismissed: true } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings-required'] });
      onDone();
    },
  });

  const connect = async (): Promise<void> => {
    setResult(undefined);
    const res = await test.mutateAsync().catch(() => undefined);
    if (res?.ok) {
      await save.mutateAsync(res.url ?? knownUrl);
    } else if (res) {
      setResult(res);
    }
  };

  const errorCode = result && !result.ok ? (result.errorCode ?? 'PVM-002') : undefined;

  if (settings.isLoading) return <Spinner />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-ha-bg p-4">
      <div className="pvm-card w-full max-w-lg space-y-4">
        <header className="space-y-1">
          <h1 className="text-lg font-semibold">
            {t('setup.title')} <span className="text-xs text-gray-400">{t('app.tagline')}</span>
          </h1>
          <p className="text-sm text-gray-400">{t('setup.intro')}</p>
        </header>

        <ol className="space-y-3">
          <li className="space-y-1">
            <p className="text-sm font-medium text-gray-200">{t('setup.step1')}</p>
            <p className="text-xs text-gray-500">{t('setup.step1Hint')}</p>
          </li>
          <li className="space-y-2">
            <p className="text-sm font-medium text-gray-200">{t('setup.step2')}</p>
            <label className="pvm-label" htmlFor="setup-token">
              {t('setup.tokenLabel')}
            </label>
            <input
              id="setup-token"
              className="pvm-input"
              type="password"
              value={token}
              autoFocus
              placeholder={settings.data?.ha.tokenSet ? '••••••••' : 'eyJ0eXAiOiJKV1Qi…'}
              onChange={(e) => {
                setToken(e.target.value);
                setResult(undefined);
              }}
            />
            <p className="text-xs text-gray-500">{t('setup.tokenHint')}</p>
          </li>
          <li className="space-y-1">
            <p className="text-sm font-medium text-gray-200">{t('setup.step3')}</p>
            <p className="text-xs text-gray-500">{t('setup.step3Hint')}</p>
          </li>
        </ol>

        {knownUrl ? (
          <p className="text-xs text-gray-400">
            {t('setup.detectedUrl')}: <span className="text-gray-200">{knownUrl}</span>
          </p>
        ) : (
          <p className="text-xs text-amber-400">{t('setup.noUrlDetected')}</p>
        )}

        {result && (
          <div
            className={`rounded-lg border p-3 text-sm ${
              result.ok
                ? 'border-green-800 bg-green-950/50 text-green-200'
                : 'border-red-800 bg-red-950/60 text-red-200'
            }`}
          >
            {result.ok ? (
              <span>
                {t('setup.ok')} — {result.locationName ?? 'Home Assistant'}{' '}
                {result.haVersion ? <Badge tone="success">{result.haVersion}</Badge> : null}
              </span>
            ) : (
              <span>
                <span className="pvm-badge bg-red-900 text-red-200">{errorCode}</span>{' '}
                {result.message ?? t('setup.failed')}
              </span>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="pvm-btn-primary"
            disabled={!token || test.isPending || save.isPending}
            onClick={() => void connect()}
          >
            {test.isPending || save.isPending ? t('settings.testing') : t('setup.connect')}
          </button>
          <button
            type="button"
            className="pvm-btn-ghost"
            disabled={dismiss.isPending}
            onClick={() => dismiss.mutate()}
          >
            {t('setup.later')}
          </button>
        </div>

        <button
          type="button"
          className="text-xs text-gray-500 hover:text-gray-300"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? '▾' : '▸'} {t('setup.advanced')}
        </button>
        {showAdvanced && (
          <div className="space-y-1">
            <label className="pvm-label" htmlFor="setup-url">
              {t('settings.haUrl')}
            </label>
            <input
              id="setup-url"
              className="pvm-input"
              defaultValue={settings.data?.ha.url}
              placeholder="http://homeassistant.local:8123"
              onChange={(e) => {
                setUrlOverride(e.target.value);
                setResult(undefined);
              }}
            />
            <p className="text-xs text-gray-500">{t('setup.urlHint')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
