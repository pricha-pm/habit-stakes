import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { settled } = await req.json();
  if (typeof settled !== "boolean") {
    return NextResponse.json({ error: "settled must be a boolean" }, { status: 400 });
  }
  const supabase = await createClient();
  const { error } = await supabase.from("ledger_entries").update({ settled }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
