const API = import.meta.env.VITE_API_URL ?? '/api';
export const ADMIN_UNAUTHORIZED_EVENT = 'license-manager:admin-unauthorized';

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('content-type', 'application/json');
  const response = await fetch(`${API}${path}`, { ...init, headers, credentials: 'include' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (response.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event(ADMIN_UNAUTHORIZED_EVENT));
    throw new Error(body.error ?? `Request failed (${response.status})`);
  }
  return response.json();
}
