import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthProvider.jsx';
import { router } from './router.jsx';
import { useUiStore } from './store/uiStore.js';
import LogoutConfirmModal from './components/common/LogoutConfirmModal.jsx';

export default function App() {
  const theme = useUiStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <AuthProvider>
      <Toaster
        position="top-center"
        toastOptions={{ duration: 3000, style: { borderRadius: '8px' } }}
      />
      <RouterProvider router={router} />
      <LogoutConfirmModal />
    </AuthProvider>
  );
}
