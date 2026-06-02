import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshUser = async () => {
    const data = await authApi.me();
    setUser(data.user);
    return data.user;
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    authApi
      .me()
      .then((data) => setUser(data.user))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      async login(email, password) {
        const data = await authApi.login(email, password);
        localStorage.setItem('token', data.token);
        setUser(data.user);
        return data.user;
      },
      async register(name, email, password) {
        const data = await authApi.register(name, email, password);
        localStorage.setItem('token', data.token);
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
      logout() {
        localStorage.removeItem('token');
        setUser(null);
      },
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
