'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');

export interface AuthUser {
  id: number;
  email: string;
  role: 'admin' | 'store';
  storeId: number | null;
  isEditor?: boolean;
  store_name?: string;
  sqm?: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('mh-token');
    if (saved) {
      setToken(saved);
      fetchMe(saved).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function fetchMe(t: string) {
    try {
      const res = await fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) { logout(); return; }
      const data = await res.json();
      setUser({
        id: data.id,
        email: data.email,
        role: data.role,
        storeId: data.store_id ?? data.storeId ?? null,
        isEditor: data.isEditor ?? data.is_editor ?? true,
        store_name: data.store_name,
        sqm: data.sqm,
      });
    } catch {
      logout();
    }
  }

  async function login(email: string, password: string) {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Login fallito');
    }
    const { token: t, user: u } = await res.json();
    localStorage.setItem('mh-token', t);
    setToken(t);
    setUser(u);
  }

  function logout() {
    localStorage.removeItem('mh-token');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

// Typed fetch helper — attaches JWT automatically
export function useApiFetch() {
  const { token, logout } = useAuth();
  return useCallback(async function apiFetch(path: string, init: RequestInit = {}) {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers as object),
        Authorization: `Bearer ${token}`,
      },
    });
    if (res.status === 401) { logout(); throw new Error('Sessione scaduta'); }
    return res;
  }, [token, logout]);
}
