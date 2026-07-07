import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import Spinner from './Spinner.jsx';

// Mirrors ProtectedRoute.jsx: must wait for the silent refresh-token check (`initializing`)
// before deciding, so a logged-in user isn't shown /login for a flash on reload.
export default function PublicOnlyRoute() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50">
        <Spinner size="lg" />
      </div>
    );
  }
  if (user) return <Navigate to="/chats" replace />;
  return <Outlet />;
}
