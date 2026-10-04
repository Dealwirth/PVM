import { useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { setAuthToken, getAuthToken, getApiBase, api } from '../lib/api.js';
import { SetupWizard } from './SetupWizard.js';

/** Result of the guarded probe: is auth required, or is the backend down? */
type ProbeResult = { reachable: true; authRequired: boolean } | { reachable: false };

/** A guarded endpoint used to detect whether the server requires a token. */
async function probeAuth(): Promise<ProbeResult> {
  const headers: Record<string, string> = {};
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(`${getApiBase()}/settings/required`, { headers });
    // 401 => the server is up but wants a token; anything else => reachable.
    return { reachable: true, authRequired: res.status === 401 };
  } catch {
    // Network error: the PVM backend is not reachable at all (PVM-002).
    return { reachable: false };
  }
}

interface LoginResponse {
  ok: boolean;
  token: string | null;
}

/**
 * Gate that requires a PVM API token when the server enforces authentication.
 * When no token is configured server-side, the guarded probe succeeds and the app renders directly.
 */
export function LoginGate({ children }: { children: ReactNode }): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const probe = useQuery({
    queryKey: ['auth-probe'],
    queryFn: probeAuth,
    retry: false,
    staleTime: Infinity,
  });

  const reachable = probe.data?.reachable === true;
  const authRequired = probe.data?.reachable === true ? probe.data.authRequired : false;

  const required = useQuery({
    queryKey: ['settings-required'],
    queryFn: () =>
      api.get<{
        complete: boolean;
        missing: Array<{ key: string; label: string }>;
        setupDismissed: boolean;
      }>('/settings/required'),
    enabled: reachable && !authRequired,
  });

  const [wizardDismissed, setWizardDismissed] = useState(false);

  if (probe.isLoading) {
    return <div className="p-8 text-center text-gray-400">{t('common.loading')}</div>;
  }

  if (reachable && !authRequired) {
    // Wait for the required-settings probe before deciding whether to show
    // the first-run setup assistant.
    if (required.isLoading) {
      return <div className="p-8 text-center text-gray-400">{t('common.loading')}</div>;
    }
    const showWizard =
      required.data && !required.data.complete && !required.data.setupDismissed && !wizardDismissed;
    if (showWizard) {
      return <SetupWizard onDone={() => setWizardDismissed(true)} />;
    }
    return <>{children}</>;
  }

  if (!reachable) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ha-bg p-4">
        <div className="pvm-card w-full max-w-lg space-y-3">
          <h1 className="text-lg font-semibold">
            {t('app.name')} <span className="text-xs text-gray-400">{t('app.tagline')}</span>
          </h1>
          <div className="rounded-lg border border-red-800 bg-red-950/60 p-3 text-sm text-red-200">
            <span className="pvm-badge bg-red-900 text-red-200">PVM-002</span>{' '}
            {t('login.backendUnreachable')}
          </div>
          <p className="text-sm text-gray-300">{t('login.backendReachableSteps')}</p>
          <ol className="list-decimal space-y-1 pl-5 text-xs text-gray-400">
            <li>{t('login.backendStep1')}</li>
            <li>{t('login.backendStep2')}</li>
            <li>{t('login.backendStep3')}</li>
          </ol>
          <p className="text-xs text-gray-500">
            {t('login.apiBase')}: <span className="text-gray-300">{getApiBase()}</span>
          </p>
          <button
            type="button"
            className="pvm-btn-primary w-full"
            onClick={() => void qc.invalidateQueries({ queryKey: ['auth-probe'] })}
          >
            {t('login.retry')}
          </button>
        </div>
      </div>
    );
  }

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    setError(undefined);
    try {
      const res = await fetch(`${getApiBase()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const body = (await res.json()) as LoginResponse;
      if (body.ok && body.token) {
        setAuthToken(body.token);
        await qc.invalidateQueries({ queryKey: ['auth-probe'] });
      } else {
        setError(t('login.invalid'));
      }
    } catch {
      setError(t('login.unreachable'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ha-bg p-4">
      <form
        className="pvm-card w-full max-w-sm space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <h1 className="text-lg font-semibold">
          {t('app.name')} <span className="text-xs text-gray-400">{t('app.tagline')}</span>
        </h1>
        <p className="text-sm text-gray-400">{t('login.hint')}</p>
        <div>
          <label className="pvm-label" htmlFor="pvm-token">
            {t('login.token')}
          </label>
          <input
            id="pvm-token"
            className="pvm-input"
            type="password"
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              setError(undefined);
            }}
            autoFocus
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button type="submit" className="pvm-btn-primary w-full" disabled={!token || submitting}>
          {t('login.submit')}
        </button>
      </form>
    </div>
  );
}
