import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Server-only client (service role). v1 is single-user with no auth, so all
// DB access goes through server routes — never expose this key to the browser.
let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — see .env.example"
      );
    }
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}
