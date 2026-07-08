import { Link } from 'react-router-dom';
import { ArrowLeft, LogOut, Moon, Sun } from 'lucide-react';
import PrivacySettingsForm from '../components/profile/PrivacySettingsForm.jsx';
import { useUiStore } from '../store/uiStore.js';

export default function SettingsPage() {
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);

  return (
    <div className="mx-auto flex min-h-full max-w-2xl animate-fade-in-up flex-col gap-6 bg-panel-detail p-6">
      <div className="flex items-center gap-3">
        <Link to="/chats" aria-label="Back" className="icon-btn">
          <ArrowLeft className="h-5 w-5 text-ink" />
        </Link>
        <h1 className="font-display text-xl font-semibold text-ink">Settings</h1>
      </div>

      <section className="flex items-center justify-between rounded-lg border border-neutral-200 bg-elevated p-6">
        <div className="flex items-center gap-2 text-sm text-ink">
          {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          Appearance — {theme === 'dark' ? 'Dark' : 'Light'} mode
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-ink hover:bg-neutral-50 dark:hover:bg-surface"
        >
          Switch to {theme === 'dark' ? 'light' : 'dark'}
        </button>
      </section>

      <PrivacySettingsForm />

      <section className="rounded-lg border border-neutral-200 bg-elevated p-6">
        <button
          type="button"
          onClick={() => useUiStore.getState().openModal('logout-confirm')}
          className="flex w-full items-center gap-2 text-sm font-medium text-danger"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </section>
    </div>
  );
}
