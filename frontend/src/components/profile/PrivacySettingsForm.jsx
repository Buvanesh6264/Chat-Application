import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth.js';
import { updatePrivacy } from '../../services/api.js';
import Button from '../common/Button.jsx';

const VISIBILITY_OPTIONS = ['Everyone', 'Friends', 'Nobody'];

// Exactly the 3 real enum fields the backend supports — there is no readReceiptsEnabled
// toggle here on purpose, since there's no endpoint to change it.
const FIELDS = [
  { key: 'profileVisibility', label: 'Who can see your profile photo, name & bio' },
  { key: 'lastSeenVisibility', label: 'Who can see when you were last online' },
  { key: 'onlineStatusVisibility', label: "Who can see if you're online right now" },
];

export default function PrivacySettingsForm() {
  const { user, updateUser } = useAuth();
  const [values, setValues] = useState({
    profileVisibility: user?.privacySettings?.profileVisibility ?? 'Everyone',
    lastSeenVisibility: user?.privacySettings?.lastSeenVisibility ?? 'Everyone',
    onlineStatusVisibility: user?.privacySettings?.onlineStatusVisibility ?? 'Everyone',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (key) => (e) => {
    setValues((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updatePrivacy(values);
      updateUser({ privacySettings: result });
      toast.success('Privacy settings saved');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save privacy settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-6">
      <h3 className="mb-4 text-base font-semibold text-neutral-900">Privacy</h3>

      <div className="flex flex-col gap-4">
        {FIELDS.map(({ key, label }) => (
          <label key={key} className="flex flex-col gap-1">
            <span className="text-sm text-neutral-900">{label}</span>
            <select
              value={values[key]}
              onChange={handleChange(key)}
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900"
            >
              {VISIBILITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <Button className="mt-4" loading={saving} onClick={handleSave}>
        Save
      </Button>
    </section>
  );
}
