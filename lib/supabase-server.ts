import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Session-scoped client for Route Handlers and Server Components. Runs
// queries as the signed-in user (via their session cookie), so Postgres
// row-level security is what actually enforces "only your own data" --
// not a manually-added .eq("owner_id", ...) that's easy to forget on a new
// route. Use lib/db.ts (service role, bypasses RLS) only for the cron job,
// which has no user session and must see every user's habits.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component render, where cookies can't be
            // written -- fine, middleware refreshes the session cookie on
            // every request anyway.
          }
        },
      },
    }
  );
}
