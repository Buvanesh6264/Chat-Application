import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
  login as apiLogin,
  signup as apiSignup,
  logout as apiLogout,
  refreshSession,
  setAccessToken,
} from '../services/api.js';

const AuthContext = createContext(null);

const CACHED_USER_KEY = 'chatapp:user';

// Auth session only — chat/presence/typing state lives in Zustand stores (store/), not here.
// The user object (never the token) is cached in localStorage so a page reload can attempt a
// silent refresh instead of dropping straight to the login screen.
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // Must start true whenever a cached user exists, computed synchronously here rather than in the
  // mount effect below — ProtectedRoute reads `initializing` on its very first render, which
  // happens before any effect runs. Starting false would let it redirect to /login on that first
  // render, before the restore attempt below ever gets a chance to run.
  const [initializing, setInitializing] = useState(() => !!localStorage.getItem(CACHED_USER_KEY));

  const login = useCallback(async (phoneNumber, password) => {
    const { user: loggedInUser, accessToken } = await apiLogin(phoneNumber, password);
    setAccessToken(accessToken);
    setUser(loggedInUser);
    localStorage.setItem(CACHED_USER_KEY, JSON.stringify(loggedInUser));
    return loggedInUser;
  }, []);

  const signup = useCallback(async (name, phoneNumber, password) => {
    const { user: newUser, accessToken } = await apiSignup(name, phoneNumber, password);
    setAccessToken(accessToken);
    setUser(newUser);
    localStorage.setItem(CACHED_USER_KEY, JSON.stringify(newUser));
    return newUser;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setAccessToken(null);
    setUser(null);
    localStorage.removeItem(CACHED_USER_KEY);
  }, []);

  // Merges a partial update (e.g. a privacy-settings PATCH response) into the cached user object.
  // There's no GET /users/me to refetch from, so this is how the cache stays consistent with
  // server-side changes made in the current session.
  const updateUser = useCallback((partial) => {
    setUser((current) => {
      if (!current) return current;
      const updated = { ...current, ...partial };
      localStorage.setItem(CACHED_USER_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // On mount, try to restore a session from the cached user + the httpOnly refresh cookie.
  useEffect(() => {
    const cached = localStorage.getItem(CACHED_USER_KEY);
    if (!cached) return;

    let cachedUser;
    try {
      cachedUser = JSON.parse(cached);
    } catch {
      localStorage.removeItem(CACHED_USER_KEY);
      return;
    }

    setInitializing(true);
    refreshSession()
      .then(({ accessToken }) => {
        setAccessToken(accessToken);
        setUser(cachedUser);
      })
      .catch(() => {
        localStorage.removeItem(CACHED_USER_KEY);
        setUser(null);
      })
      .finally(() => setInitializing(false));
  }, []);

  const value = useMemo(
    () => ({ user, initializing, login, signup, logout, updateUser, setInitializing }),
    [user, initializing, login, signup, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
};
