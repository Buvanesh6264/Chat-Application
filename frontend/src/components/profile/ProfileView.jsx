import { useAuth } from '../../hooks/useAuth.js';
import Avatar from '../common/Avatar.jsx';

// Name/phone/bio/photo are read-only here: there is no PATCH endpoint to edit them
// (backend only exposes privacy-settings updates), so this deliberately renders no form.
export default function ProfileView() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-6">
      <div className="flex items-center gap-4">
        <Avatar size="xl" src={user.profileImageUrl} name={user.name} />
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">{user.name}</h2>
          <p className="text-sm text-neutral-500">{user.phoneNumber}</p>
        </div>
      </div>

      <div className="mt-4">
        {user.bio ? (
          <p className="text-sm text-neutral-900">{user.bio}</p>
        ) : (
          <p className="text-sm text-neutral-500">No bio yet</p>
        )}
      </div>

      <p className="mt-4 text-xs text-neutral-500">
        Profile editing isn&apos;t available yet.
      </p>
    </section>
  );
}
