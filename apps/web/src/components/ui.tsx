import type { ReactNode } from 'react';

export function Card({
  title,
  children,
  actions,
}: {
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
}): JSX.Element {
  return (
    <section className="pvm-card">
      {(title || actions) && (
        <header className="mb-3 flex items-center justify-between">
          {title && <h2 className="pvm-card-title mb-0">{title}</h2>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'error' | 'info';
}): JSX.Element {
  const tones: Record<string, string> = {
    neutral: 'bg-ha-surfaceAlt text-gray-300',
    success: 'bg-green-900/60 text-green-300',
    warning: 'bg-amber-900/60 text-amber-300',
    error: 'bg-red-900/60 text-red-300',
    info: 'bg-sky-900/60 text-sky-300',
  };
  return <span className={`pvm-badge ${tones[tone]}`}>{children}</span>;
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}): JSX.Element {
  return (
    <div className="pvm-card">
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export function Spinner(): JSX.Element {
  return (
    <div
      className="flex items-center justify-center p-8 text-gray-400"
      role="status"
      aria-live="polite"
    >
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-ha-border border-t-ha-primary" />
    </div>
  );
}

export function ErrorBanner({
  code,
  message,
  remediation,
  onRetry,
}: {
  code?: string;
  message: string;
  remediation?: string;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-red-800 bg-red-950/60 p-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="pvm-badge bg-red-900 text-red-200">{code ?? 'PVM-020'}</span>
        <span className="font-medium text-red-200">{message}</span>
      </div>
      {remediation && <p className="mt-1 text-red-300/80">{remediation}</p>}
      {onRetry && (
        <button type="button" className="pvm-btn-ghost mt-2" onClick={onRetry}>
          Erneut versuchen
        </button>
      )}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}): JSX.Element {
  return (
    <label className="flex items-center justify-between gap-3 py-1">
      <span>
        <span className="text-sm text-gray-200">{label}</span>
        {hint && <span className="block text-xs text-gray-500">{hint}</span>}
      </span>
      <input
        type="checkbox"
        className="h-5 w-5 accent-ha-primary"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
