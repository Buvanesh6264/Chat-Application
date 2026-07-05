import { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { login as apiLogin, signup as apiSignup, logout as apiLogout, setAccessToken } from '../services/api.js';

const AuthContext = createContext(null);

// Auth session only — chat/presence/typing state lives in Zustand stores (store/), not here.
// initializing starts false: there's no GET /users/me endpoint yet to restore a session from the
// httpOnly refresh cookie on mount (build order step 4/5). Once that endpoint exists, add a mount
// effect here that attempts a silent refresh and flips this true/false around it.
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(false);

  const login = useCallback(async (phoneNumber, password) => {
    const { user: loggedInUser, accessToken } = await apiLogin(phoneNumber, password);
    setAccessToken(accessToken);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const signup = useCallback(async (name, phoneNumber, password) => {
    const { user: newUser, accessToken } = await apiSignup(name, phoneNumber, password);
    setAccessToken(accessToken);
    setUser(newUser);
    return newUser;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, initializing, login, signup, logout, setInitializing }),
    [user, initializing, login, signup, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
};
