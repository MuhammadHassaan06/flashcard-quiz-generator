import { createClient } from "@supabase/supabase-js";

// Client-side (browser) instance — uses the public anon key, safe to expose.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Server-side instance — uses the service role key, NEVER import this file
// from a client component. Only use inside app/api/** route handlers.
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
