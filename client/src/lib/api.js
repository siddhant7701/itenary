// Thin fetch wrapper for the Itenary API.
// Two independent sessions: `user` (traveller app) and `admin` (admin panel).
const KEYS = { user: 'tc_token', admin: 'tc_admin_token' };

// When the web app is hosted separately from the API (e.g. Vercel + Render), VITE_API_URL points at the API
// server, e.g. https://itenary-api.onrender.com. Empty = same origin (local dev, single-server deploys).
export const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

/** Resolve server-relative asset paths like /uploads/abc.jpg against the API origin. */
export const assetUrl = (u) => (u && API_ORIGIN && u.startsWith('/uploads/') ? API_ORIGIN + u : u);

export class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export function getToken(scope = 'user') {
  try {
    return localStorage.getItem(KEYS[scope]);
  } catch {
    return null;
  }
}

export function setToken(token, scope = 'user') {
  try {
    if (token) localStorage.setItem(KEYS[scope], token);
    else localStorage.removeItem(KEYS[scope]);
  } catch {
    // storage unavailable (private mode) — session lasts for this tab only
  }
}

const listeners = new Set();
/** Subscribe to 401s so auth providers can sign out. */
export const onUnauthorized = (fn) => (listeners.add(fn), () => listeners.delete(fn));

export async function api(path, { method = 'GET', body, scope = 'user', form, signal } = {}) {
  const token = getToken(scope);
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`${API_ORIGIN}/api${path}`, { method, headers, body: payload, signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, navigator.onLine ? 'Could not reach Itenary. Please try again.' : 'You are offline. We will retry when you are back online.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) listeners.forEach((fn) => fn(scope));
    throw new ApiError(res.status, data.error || `Request failed (${res.status})`, data);
  }
  return data;
}

api.get = (path, opts) => api(path, { ...opts, method: 'GET' });
api.post = (path, body, opts) => api(path, { ...opts, method: 'POST', body });
api.patch = (path, body, opts) => api(path, { ...opts, method: 'PATCH', body });
api.del = (path, opts) => api(path, { ...opts, method: 'DELETE' });

/** Same helpers bound to the admin session. */
export const adminApi = {
  get: (path) => api(path, { scope: 'admin' }),
  post: (path, body) => api(path, { method: 'POST', body, scope: 'admin' }),
  patch: (path, body) => api(path, { method: 'PATCH', body, scope: 'admin' }),
  del: (path, body) => api(path, { method: 'DELETE', body, scope: 'admin' }),
};
