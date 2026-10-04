const API_BASE = import.meta.env.VITE_PVM_API_BASE ?? '/api';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly remediation?: string,
    public readonly severity?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function authToken(): string | null {
  return localStorage.getItem('pvm.token');
}

export function getAuthToken(): string | null {
  return authToken();
}

export function setAuthToken(token: string | null): void {
  if (token) localStorage.setItem('pvm.token', token);
  else localStorage.removeItem('pvm.token');
}

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

/** Notifies subscribers when the API rejects the current token (HTTP 401). */
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

function notifyUnauthorized(): void {
  setAuthToken(null);
  for (const listener of unauthorizedListeners) listener();
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = authToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (res.status === 401) {
    notifyUnauthorized();
    throw new ApiError('PVM-004', 'Authentication failed', 'API token is missing or invalid.');
  }
  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    if (!res.ok) throw new ApiError('PVM-020', `HTTP ${res.status}`);
    return (await res.text()) as unknown as T;
  }

  const body = (await res.json()) as unknown;
  if (!res.ok) {
    const err = (
      body as { error?: { code: string; message: string; remediation?: string; severity?: string } }
    ).error;
    throw new ApiError(
      err?.code ?? 'PVM-020',
      err?.message ?? `HTTP ${res.status}`,
      err?.remediation,
      err?.severity,
    );
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export function wsUrl(): string {
  const base = API_BASE.startsWith('http')
    ? API_BASE.replace(/\/api$/, '')
    : `${window.location.origin}`;
  const ws = base.replace(/^http/, 'ws');
  const token = authToken();
  return `${ws}/ws${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}
