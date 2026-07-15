import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json();
  const { name, cadence, stake_amount, owed_to, implementation_intention } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (cadence !== "daily" && cadence !== "weekly") {
    return NextResponse.json({ error: "Cadence must be daily or weekly" }, { status: 400 });
  }
  const stake = Number(stake_amount);
  if (!Number.isFinite(stake) || stake <= 0) {
    return NextResponse.json({ error: "Stake must be a positive amount" }, { status: 400 });
  }
  if (!owed_to?.trim()) {
    return NextResponse.json(
      { error: "Name the friend you'll owe — that's the whole point" },
      { status: 400 }
    );
  }

  const { data, error } = await db()
    .from("habits")
    .insert({
      name: name.trim(),
      cadence,
      stake_amount: stake,
      owed_to: owed_to.trim(),
      implementation_intention: implementation_intention?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ habit: data }, { status: 201 });
}
