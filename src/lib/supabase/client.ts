import { createBrowserClient } from "@supabase/ssr";

// Browser client: uses the signed-in staff member's own JWT. The anon key is public by design;
// every table is protected by RLS and every admin action by has_permission() inside the database.
export function supabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example)");
  return createBrowserClient(url, key);
}
