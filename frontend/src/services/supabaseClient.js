import { createClient } from '@supabase/supabase-js';

// Anon/public key only — safe for the browser bundle. Uploads use a signed URL issued by the
// backend (services/media-integration), never the service-role key.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
