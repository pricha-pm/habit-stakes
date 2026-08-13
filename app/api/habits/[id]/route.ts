import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// Soft delete: sets active=false rather than removing the row. A hard
// delete would cascade through checkins -> ledger_entries -> nudges,
// erasing real settled/outstanding money history for that habit. Every
// habit-list query already filters on active=true, so this makes the
// habit disappear everywhere it should while the ledger keeps its history.
// The session client + RLS means this update silently affects zero rows if
// the habit isn't yours, rather than needing a manual ownership check.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from("habits").update({ active: false }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
