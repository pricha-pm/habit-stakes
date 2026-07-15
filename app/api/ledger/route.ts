import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await db()
    .from("ledger_entries")
    .select("id, amount, owed_to, settled, created_at, habits(name)")
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ entries: data });
}
