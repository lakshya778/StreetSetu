import { createContext, useContext, useMemo, useState } from 'react';
import api from '../api/client.js';

const SESSION_KEY = 'streetsetu_session';
const TOKEN_KEY = 'streetsetu_token';
const AuthContext = createContext(null);

function readSession() {
  try {
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
  } catch {
    return null;
  }
}

function saveSession(data) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
  localStorage.setItem(TOKEN_KEY, data.token);
  return data.user;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readSession);

  async function login(credentials) {
    const { data } = await api.post('/auth/login', credentials);
    setUser(saveSession(data.data));
  }

  async function register(details) {
    const { data } = await api.post('/auth/register', details);
    setUser(saveSession(data.data));
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }

  const value = useMemo(() => ({ user, login, register, logout }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
