import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/client.js';
import {
  clearStoredSession,
  formatSessionExpiry,
  getStoredToken,
  saveStoredSession,
} from '../lib/sessionStorage.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState(
    () => localStorage.getItem('sessionExpiresAt') || null
  );
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const data = await authApi.me();
    setUser(data.user);
    return data.user;
  }, []);

  const persistSession = useCallback(({ token, expiresAt }) => {
    saveStoredSession({ token, expiresAt });
    setSessionExpiresAt(expiresAt || null);
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }

    authApi
      .me()
      .then((data) => setUser(data.user))
      .catch(() => {
        clearStoredSession();
        setSessionExpiresAt(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!sessionExpiresAt || !user) return undefined;

    const msUntilExpiry = new Date(sessionExpiresAt).getTime() - Date.now();
    if (msUntilExpiry <= 0) {
      clearStoredSession();
      setUser(null);
      setSessionExpiresAt(null);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      clearStoredSession();
      setUser(null);
      setSessionExpiresAt(null);
    }, msUntilExpiry);

    return () => window.clearTimeout(timer);
  }, [sessionExpiresAt, user]);

  const value = useMemo(
    () => ({
      user,
      loading,
      sessionExpiresAt,
      sessionExpiresLabel: formatSessionExpiry(sessionExpiresAt),
      isAuthenticated: Boolean(user),
      mustChangePassword: Boolean(user?.mustChangePassword),
      async login(email, password) {
        const data = await authApi.login(email, password);
        persistSession(data);
        setUser(data.user);
        return data.user;
      },
      async register(name, email, password) {
        const data = await authApi.register(name, email, password);
        persistSession(data);
        setUser(data.user);
        return data.user;
      },
      async refreshUser() {
        return refreshUser();
      },
      async updateProfile(name) {
        const data = await authApi.updateProfile(name);
        setUser(data.user);
        return data.user;
      },
      async changePassword(currentPassword, newPassword) {
        const data = await authApi.changePassword(currentPassword, newPassword);
        setUser(data.user);
        return data.user;
      },
      async logout() {
        try {
          await authApi.logout();
        } catch {
          // ignore network errors on logout
        }
        clearStoredSession();
        setSessionExpiresAt(null);
        setUser(null);
      },
    }),
    [user, loading, sessionExpiresAt, persistSession, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
