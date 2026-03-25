'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getMe, guestLogin, loginUser, logoutUser, registerUser, setAuthToken, type SessionUser } from '@/lib/api';
import { getStoredDisplayName, setStoredDisplayName } from '@/lib/guest';

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  loginAsGuest: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string, confirmPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const res = await getMe();
    setUser(res.user);
    if (res.user?.username) setStoredDisplayName(res.user.username);
  };

  useEffect(() => {
    refresh().catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  const loginAsGuest = async () => {
    const res = await guestLogin();
    setAuthToken(res.token);
    setUser(res.user);
    setStoredDisplayName(getStoredDisplayName() || res.user.username);
  };

  const login = async (identifier: string, password: string) => {
    const guestToken = typeof window !== 'undefined' ? localStorage.getItem('cloudcanvas-auth-token') : null;
    const res = await loginUser({ identifier, password, guestToken, guestDisplayName: getStoredDisplayName() || undefined });
    setAuthToken(res.token);
    setUser({ ...res.user, role: 'user' });
    setStoredDisplayName(getStoredDisplayName() || res.user.username);
  };

  const register = async (email: string, username: string, password: string, confirmPassword: string) => {
    const guestToken = typeof window !== 'undefined' ? localStorage.getItem('cloudcanvas-auth-token') : null;
    const res = await registerUser({ email, username, password, confirmPassword, guestToken, guestDisplayName: getStoredDisplayName() || undefined });
    setAuthToken(res.token);
    setUser({ ...res.user, role: 'user' });
    setStoredDisplayName(getStoredDisplayName() || res.user.username);
  };

  const logout = async () => {
    await logoutUser();
    setAuthToken(null);
    setStoredDisplayName('');
    setUser(null);
  };

  const value = useMemo<AuthContextValue>(() => ({ user, loading, loginAsGuest, login, register, logout, refresh }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
