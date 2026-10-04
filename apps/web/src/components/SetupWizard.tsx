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
  publicUrl?: boolean;
  mode?: 'api' | 'integration';
}

/**
 * How the user reaches Home Assistant. Each choice only guides the URL field
 * and the security default; the real connection is always verified against the
 * live HA API before anything is saved.
 */
type ConnectionType = 'auto' | 'local' | 'duckdns' | 'nabu' | 'docker' | 'manual';

const CONNECTION_TYPES: ConnectionType[] = ['auto', 'local', 'duckdns', 'nabu', 'docker', 'manual'];

/** Non-local connection types must not be blocked by the local-only guard. */
const REMOTE_TYPES: ConnectionType[] = ['duckdns', 'nabu'];

/**
 * First-run setup assistant.
 *
 * Works with every common way of reaching Home Assistant (local IP/mDNS,
 * DuckDNS, Nabu Casa, Docker host, or a manually typed URL) and explains what
 * each choice does. The token is stored server-side only.
 */
export function SetupWizard({ onDone }: { onDone: () => void }): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<PublicSettings>('/settings'),
  });

  const [token, setToken] = useState('');
  const [url, setUrl] = useState<string>();
  const [connType, setConnType] = useState<ConnectionType>('auto');
  const [showHelp, setShowHelp] = useState(false);
  const [showImpact, setShowImpact] = useState(false);
  const [result, setResult] = useState<TestResult>();
  const [remoteAllowed, setRemoteAllowed] = useState(false);

  const knownUrl = useMemo(
    () => url ?? settings.data?.ha.url ?? settings.data?.ha.candidateUrls?.[0] ?? '',
    [url, settings.data],
  );

  const test = useMutation({
    mutationFn: (opts: { allowRemote?: boolean } = {}) =>
      api.post<TestResult>('/settings/test-ha', {
        ...(knownUrl ? { url: knownUrl } : {}),
        ...(token ? { token } : {}),
        ...(opts.allowRemote ? { allowRemote: true } : {}),
      }),
  });

  // API-free path: succeeds only if the HA integration is already pushing data.
  const testIntegration = useMutation({
    mutationFn: () => api.post<TestResult>('/settings/test-ha', { requireIntegration: true }),
  });

  const save = useMutation({
    mutationFn: (detectedUrl?: string) =>
      api.put<PublicSettings>('/settings', {
        ha: {
          ...(token ? { token } : {}),
          ...(detectedUrl ? { url: detectedUrl } : {}),
          ...(REMOTE_TYPES.includes(connType) ? { localOnly: false } : {}),
        },
        general: { setupDismissed: true },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings'] });
      void qc.invalidateQueries({ queryKey: ['settings-required'] });
      onDone();
    },
  });

  // Finish setup in integration mode: no HA token needed, PVM gets its data
  // pushed by the Home Assistant integration.
  const finishIntegration = useMutation({
    mutationFn: () => api.put<PublicSettings>('/settings', { general: { setupDismissed: true } }),
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

  // Verify the HA connection, auto-allowing a blocked public URL (PVM-016) in
  // one step, then fall back to the API-free integration mode when HA cannot be
  // reached directly.
  const connect = async (): Promise<void> => {
    setResult(undefined);
    let res = await test.mutateAsync({}).catch(() => undefined);
    // A blocked public URL is not a dead end: verify it and allow it in one
    // step, then keep going. The server only drops the local-only guard once the
    // URL actually verified, so a failed attempt cannot weaken it.
    if (res && !res.ok && (res.publicUrl || res.errorCode === 'PVM-016')) {
      setRemoteAllowed(true);
      res = await test.mutateAsync({ allowRemote: true }).catch(() => undefined);
    }
    if (res?.ok) {
      await save.mutateAsync(res.url ?? knownUrl);
      return;
    }
    // The direct API did not work: if the HA integration is already pushing
    // data to PVM, finish setup in integration mode (no HA token required).
    const integ = await testIntegration.mutateAsync().catch(() => undefined);
    if (integ?.ok) {
      await finishIntegration.mutateAsync();
      return;
    }
    if (res) setResult(res);
  };

  const connectViaIntegration = async (): Promise<void> => {
    setResult(undefined);
    const integ = await testIntegration.mutateAsync().catch(() => undefined);
    if (integ?.ok) await finishIntegration.mutateAsync();
    else if (integ) setResult(integ);
  };

  const errorCode = result && !result.ok ? (result.errorCode ?? 'PVM-002') : undefined;
  const remoteBlocked = errorCode === 'PVM-016';

  const selectType = (type: ConnectionType): void => {
    setConnType(type);
    setResult(undefined);
    setUrl(undefined);
  };

  if (settings.isLoading) return <Spinner />;

  const urlPlaceholder = t(`setup.connTypes.${connType}.placeholder`);

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

          <li className="space-y-2">
            <p className="text-sm font-medium text-gray-200">{t('setup.step3')}</p>
            <p className="text-xs text-gray-500">{t('setup.step3Hint')}</p>
            <div className="flex flex-wrap gap-1.5">
              {CONNECTION_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    connType === type
                      ? 'border-ha-primary bg-ha-primary/20 text-gray-100'
                      : 'border-ha-border text-gray-400 hover:text-gray-200'
                  }`}
                  onClick={() => selectType(type)}
                >
                  {t(`setup.connTypes.${type}.label`)}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500">{t(`setup.connTypes.${connType}.hint`)}</p>
            <label className="pvm-label" htmlFor="setup-url">
              {t('settings.haUrl')}
            </label>
            <input
              id="setup-url"
              className="pvm-input"
              value={url ?? settings.data?.ha.url ?? ''}
              placeholder={urlPlaceholder}
              onChange={(e) => {
                setUrl(e.target.value);
                setResult(undefined);
              }}
            />
            {knownUrl ? (
              <p className="text-xs text-gray-400">
                {t('setup.detectedUrl')}: <span className="text-gray-200">{knownUrl}</span>
              </p>
            ) : (
              <p className="text-xs text-amber-400">{t('setup.noUrlDetected')}</p>
            )}
          </li>

          <li className="space-y-1">
            <p className="text-sm font-medium text-gray-200">{t('setup.step4')}</p>
            <p className="text-xs text-gray-500">{t('setup.step4Hint')}</p>
          </li>
        </ol>

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

        {remoteAllowed && !remoteBlocked && (
          <p className="text-xs text-green-300">{t('setup.remoteAllowed')}</p>
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
            disabled={testIntegration.isPending || finishIntegration.isPending}
            onClick={() => void connectViaIntegration()}
          >
            {testIntegration.isPending ? t('settings.testing') : t('setup.connectIntegration')}
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
        <p className="text-xs text-gray-500">{t('setup.connectIntegrationHint')}</p>

        <div className="space-y-2">
          <button
            type="button"
            className="text-xs text-gray-500 hover:text-gray-300"
            onClick={() => setShowHelp((v) => !v)}
          >
            {showHelp ? '▾' : '▸'} {t('setup.helpTitle')}
          </button>
          {showHelp && (
            <dl className="space-y-2 rounded-lg border border-gray-800 bg-gray-950/40 p-3 text-xs text-gray-400">
              <div>
                <dt className="font-medium text-gray-300">{t('setup.helpLocalTitle')}</dt>
                <dd>{t('setup.helpLocalText')}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-300">{t('setup.helpDuckdnsTitle')}</dt>
                <dd>{t('setup.helpDuckdnsText')}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-300">{t('setup.helpNabuTitle')}</dt>
                <dd>{t('setup.helpNabuText')}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-300">{t('setup.helpDockerTitle')}</dt>
                <dd>{t('setup.helpDockerText')}</dd>
              </div>
            </dl>
          )}

          <button
            type="button"
            className="text-xs text-gray-500 hover:text-gray-300"
            onClick={() => setShowImpact((v) => !v)}
          >
            {showImpact ? '▾' : '▸'} {t('setup.impactTitle')}
          </button>
          {showImpact && (
            <dl className="space-y-2 rounded-lg border border-gray-800 bg-gray-950/40 p-3 text-xs text-gray-400">
              <div>
                <dt className="font-medium text-gray-300">{t('setup.impactTokenTitle')}</dt>
                <dd>{t('setup.impactTokenText')}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-300">{t('setup.impactRemoteTitle')}</dt>
                <dd>{t('setup.impactRemoteText')}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-300">{t('setup.impactTestTitle')}</dt>
                <dd>{t('setup.impactTestText')}</dd>
              </div>
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}
