import { useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { setAuthToken, getAuthToken } from '../lib/api.js';

/** A guarded endpoint used to detect whether the server requires a token. */
async function probeAuth(): Promise<boolean> {
  const headers: Record<string, string> = {};
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch('/api/settings/required', { headers });
  return res.status !== 401;
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

  if (probe.isLoading) {
    return <div className="p-8 text-center text-gray-400">{t('common.loading')}</div>;
  }

  if (probe.data) return <>{children}</>;

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    setError(undefined);
    try {
      const res = await fetch('/api/auth/login', {
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
