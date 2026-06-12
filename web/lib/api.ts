export type SessionUser = {
  id: string;
  name: string;
  role: 'ADMIN' | 'BACKEND' | 'TECHNICIAN' | 'SALES' | 'CUSTOMER';
};

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('aw_token');
}

export function getSessionUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('aw_user');
  return raw ? (JSON.parse(raw) as SessionUser) : null;
}

export function setSession(token: string, user: SessionUser, refreshToken?: string) {
  localStorage.setItem('aw_token', token);
  localStorage.setItem('aw_user', JSON.stringify(user));
  if (refreshToken) localStorage.setItem('aw_refresh', refreshToken);
}

export function clearSession() {
  localStorage.removeItem('aw_token');
  localStorage.removeItem('aw_user');
  localStorage.removeItem('aw_refresh');
}

// Single-use rotating refresh: one in-flight refresh shared by all callers.
let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const refreshToken = localStorage.getItem('aw_refresh');
  if (!refreshToken) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      setSession(data.accessToken, data.user, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; _retried?: boolean } = {},
): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api/v1${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 401 && typeof window !== 'undefined') {
    if (!options._retried && (await tryRefresh())) {
      return api<T>(path, { ...options, _retried: true });
    }
    clearSession();
    if (!window.location.pathname.endsWith('/portal/login')) {
      window.location.href = '/portal/login';
    }
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(', ')
      : (data?.message ?? `Request failed (${res.status})`);
    throw new ApiError(res.status, message);
  }
  return data as T;
}
