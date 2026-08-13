// One-time: assign existing owner-less habits (the original seeded data,
// created before real accounts existed) to a real account. Run this once,
// after signing in via the magic link for the first time.
//
// Run: npx tsx scripts/assign-ownership.ts you@example.com

import { db } from "../lib/db";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx scripts/assign-ownership.ts you@example.com");
    process.exit(1);
  }

  const { data: profile, error: profileError } = await db()
    .from("profiles")
    .select("id, email")
    .eq("email", email)
    .single();
  if (profileError || !profile) {
    console.error(
      `No profile found for ${email} — sign in via the magic link first, then re-run this.`
    );
    process.exit(1);
  }

  const { data, error } = await db()
    .from("habits")
    .update({ owner_id: profile.id })
    .is("owner_id", null)
    .select("id, name");
  if (error) {
    console.error("FAILED:", error.message);
    process.exit(1);
  }

  console.log(`Assigned ${data.length} habit(s) to ${email}:`);
  for (const h of data) console.log(`  ${h.name}`);
}

main();
