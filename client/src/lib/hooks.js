import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

/**
 * Fetch JSON from the API. `path` may be null to skip.
 * Returns { data, loading, error, reload, setData }.
 */
export function useFetch(path, { scope = 'user', deps = [] } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState(null);
  const ctrl = useRef(null);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!path) return;
      ctrl.current?.abort();
      const c = new AbortController();
      ctrl.current = c;
      if (!silent) setLoading(true);
      try {
        const d = await api(path, { scope, signal: c.signal });
        setData(d);
        setError(null);
      } catch (err) {
        if (err.name !== 'AbortError') setError(err);
      } finally {
        if (!c.signal.aborted) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, scope, ...deps],
  );

  useEffect(() => {
    load();
    return () => ctrl.current?.abort();
  }, [load]);

  const reload = useCallback(() => load({ silent: true }), [load]);
  return { data, loading, error, reload, setData };
}

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** localStorage-backed state for per-device conveniences (never for shared state). */
export function useLocalState(key, initial) {
  const [v, setV] = useState(() => {
    try {
      const s = localStorage.getItem(key);
      return s == null ? initial : JSON.parse(s);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      // ignore
    }
  }, [key, v]);
  return [v, setV];
}

export function useMediaQuery(query) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const fn = () => setMatch(m.matches);
    m.addEventListener('change', fn);
    return () => m.removeEventListener('change', fn);
  }, [query]);
  return match;
}
