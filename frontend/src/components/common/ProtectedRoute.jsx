import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useSocket } from '../../hooks/useSocket.js';
import { useSocketListeners } from '../../hooks/useSocketListeners.js';

export default function ProtectedRoute() {
  const { user, initializing } = useAuth();
  // Both hooks must run unconditionally (rules of hooks); they already no-op without a
  // user/socket, so it's safe to call them during the initializing/no-user render paths too.
  const socket = useSocket();
  useSocketListeners(socket);

  if (initializing) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
