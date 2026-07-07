import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Settings } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import Avatar from '../common/Avatar.jsx';
import Button from '../common/Button.jsx';
import FloatingLabelInput from '../common/FloatingLabelInput.jsx';
import Spinner from '../common/Spinner.jsx';
import { compressImage } from '../../services/imageCompression.js';
import { uploadObject } from '../../services/uploadHelpers.js';
import { updateProfile } from '../../services/api.js';

export default function ProfileView() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);

  if (!user) return null;

  const dirty = name !== user.name || bio !== (user.bio ?? '');

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateProfile({ name, bio });
      updateUser(updated);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const compressed = await compressImage(file);
      const objectKey = await uploadObject('photo', compressed);
      const updated = await updateProfile({ profileImageUrl: objectKey });
      updateUser(updated);
      toast.success('Profile photo updated');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  return (
    <section className="animate-fade-in-up rounded-lg border border-neutral-200 bg-elevated p-6">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar
            size="xl"
            src={user.profileImageUrl}
            name={user.name}
            onClick={() => fileInputRef.current?.click()}
          />
          {uploadingPhoto && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
              <Spinner size="md" />
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoChange}
          />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">{user.name}</h2>
          <p className="text-sm text-ink-muted">{user.phoneNumber}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <FloatingLabelInput
          id="profile-name"
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <FloatingLabelInput
          id="profile-bio"
          label="Bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Button variant="gradient" disabled={!dirty} loading={saving} onClick={handleSave}>
          Save changes
        </Button>
        <Link to="/settings" className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>
    </section>
  );
}
