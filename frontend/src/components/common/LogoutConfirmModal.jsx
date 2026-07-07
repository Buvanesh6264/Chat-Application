import Modal from './Modal.jsx';
import Button from './Button.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useUiStore } from '../../store/uiStore.js';
import { router } from '../../router.jsx';

// Mounted once at the app root (App.jsx, outside <RouterProvider>) so both entry points — the
// persistent header menu in ChatLayout and the Settings page row — can open it via the same
// `logout-confirm` modal id regardless of which route is currently mounted. Being outside the
// router tree means no useNavigate() context, so this navigates via the router instance's own
// imperative `.navigate()` instead.
export default function LogoutConfirmModal() {
  const { logout } = useAuth();

  const handleConfirm = async () => {
    try {
      await logout();
    } finally {
      useUiStore.getState().closeModal();
      router.navigate('/login', { replace: true });
    }
  };

  return (
    <Modal id="logout-confirm" title="Log out?">
      <p className="text-sm text-ink-muted">Are you sure you want to log out?</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => useUiStore.getState().closeModal()}>
          Cancel
        </Button>
        <Button variant="danger" onClick={handleConfirm}>
          Log out
        </Button>
      </div>
    </Modal>
  );
}
