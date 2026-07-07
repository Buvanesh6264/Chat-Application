import { useEffect, useState } from 'react';
import { getUserProfile } from '../services/api.js';

// Fetches a user's profile via GET /users/:id/profile, which already enforces privacy
// server-side (services/privacy.js) — this hook just surfaces loading/error state to components.
export const usePrivacy = (userId) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getUserProfile(userId)
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { profile, loading, error };
};
