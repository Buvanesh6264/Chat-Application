import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth.js';
import { updatePrivacy } from '../../services/api.js';
import Toggle from '../common/Toggle.jsx';

const VISIBILITY_OPTIONS = ['Everyone', 'Friends', 'Nobody'];

const FIELDS = [
  { key: 'profileVisibility', label: 'Who can see your profile photo, name & bio' },
  { key: 'lastSeenVisibility', label: 'Who can see when you were last online' },
  { key: 'onlineStatusVisibility', label: "Who can see if you're online right now" },
];

// Instant-save, optimistic: every change fires immediately, no separate "Save" button — a
// failed request reverts the field and shows a toast instead.
export default function PrivacySettingsForm() {
  const { user, updateUser } = useAuth();
  const [saving, setSaving] = useState(null);

  const privacySettings = user?.privacySettings ?? {};
  const readReceiptsEnabled = user?.readReceiptsEnabled ?? true;

  const applyChange = async (key, value, previous) => {
    setSaving(key);
    try {
      const result = await updatePrivacy({ [key]: value });
      updateUser({ privacySettings: result.privacySettings, readReceiptsEnabled: result.readReceiptsEnabled });
    } catch (err) {
      updateUser(key === 'readReceiptsEnabled' ? { readReceiptsEnabled: previous } : { privacySettings: { ...privacySettings, [key]: previous } });
      toast.error(err.response?.data?.error?.message || 'Failed to save setting');
    } finally {
      setSaving(null);
    }
  };

  const handleVisibilityChange = (key) => (e) => {
    const value = e.target.value;
    const previous = privacySettings[key];
    updateUser({ privacySettings: { ...privacySettings, [key]: value } });
    applyChange(key, value, previous);
  };

  const handleReadReceiptsChange = (enabled) => {
    const previous = readReceiptsEnabled;
    updateUser({ readReceiptsEnabled: enabled });
    applyChange('readReceiptsEnabled', enabled, previous);
  };

  return (
    <section className="rounded-lg border border-neutral-200 bg-elevated p-6">
      <h3 className="mb-4 font-display text-base font-semibold text-ink">Privacy</h3>

      <div className="flex flex-col gap-4">
        {FIELDS.map(({ key, label }) => (
          <label key={key} className="flex flex-col gap-1">
            <span className="text-sm text-ink">{label}</span>
            <select
              value={privacySettings[key] ?? 'Everyone'}
              disabled={saving === key}
              onChange={handleVisibilityChange(key)}
              className="w-full rounded-md border border-neutral-200 bg-transparent px-3 py-2 text-sm text-ink disabled:opacity-50"
            >
              {VISIBILITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ))}

        <div className="flex items-center justify-between gap-4 border-t border-neutral-200 pt-4">
          <div>
            <p className="text-sm text-ink">Read receipts</p>
            <p className="text-xs text-ink-muted">
              If you turn this off, you won&apos;t see read receipts from others either.
            </p>
          </div>
          <Toggle
            checked={readReceiptsEnabled}
            disabled={saving === 'readReceiptsEnabled'}
            onChange={handleReadReceiptsChange}
            label="Read receipts"
          />
        </div>
      </div>
    </section>
  );
}
