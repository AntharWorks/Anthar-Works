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

export function setSession(token: string, user: SessionUser) {
  localStorage.setItem('aw_token', token);
  localStorage.setItem('aw_user', JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem('aw_token');
  localStorage.removeItem('aw_user');
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
  options: { method?: string; body?: unknown } = {},
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
