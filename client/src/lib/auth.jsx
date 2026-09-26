import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, onUnauthorized, setToken } from './api';
import { resetSocket } from './socket';

function makeAuth(scope) {
  const Ctx = createContext(null);

  function Provider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(!!getToken(scope));

    const refresh = useCallback(async () => {
      if (!getToken(scope)) {
        setUser(null);
        setLoading(false);
        return null;
      }
      try {
        const { user } = await api.get('/auth/me', { scope });
        if (scope === 'admin' && user.role !== 'admin') throw new Error('not admin');
        setUser(user);
        return user;
      } catch (err) {
        if (err.status === 401 || err.status === 403 || err.message === 'not admin') {
          setToken(null, scope);
          setUser(null);
        }
        return null;
      } finally {
        setLoading(false);
      }
    }, []);

    useEffect(() => {
      refresh();
      return onUnauthorized((s) => {
        if (s === scope) {
          setToken(null, scope);
          setUser(null);
        }
      });
    }, [refresh]);

    const login = useCallback((token, u) => {
      setToken(token, scope);
      setUser(u);
      if (scope === 'user') resetSocket();
    }, []);

    const logout = useCallback(() => {
      setToken(null, scope);
      setUser(null);
      if (scope === 'user') {
        resetSocket();
        if ('caches' in window) caches.delete('tc-data-v1').catch(() => {});
      }
    }, []);

    const value = useMemo(() => ({ user, loading, login, logout, refresh, setUser }), [user, loading, login, logout, refresh]);
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
  }

  const useIt = () => {
    const v = useContext(Ctx);
    if (!v) throw new Error('Auth provider missing');
    return v;
  };
  return [Provider, useIt];
}

export const [AuthProvider, useAuth] = makeAuth('user');
export const [AdminAuthProvider, useAdminAuth] = makeAuth('admin');
