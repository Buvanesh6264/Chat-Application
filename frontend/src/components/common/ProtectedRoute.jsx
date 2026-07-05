import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';

export default function ProtectedRoute() {
  const { user, initializing } = useAuth();

  if (initializing) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
