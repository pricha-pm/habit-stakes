import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { feedback } = await req.json();
  if (feedback !== "up" && feedback !== "down") {
    return NextResponse.json({ error: "Feedback must be up or down" }, { status: 400 });
  }
  const { error } = await db().from("nudges").update({ feedback }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
