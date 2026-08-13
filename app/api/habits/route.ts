import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json();
  const { name, cadence, stake_amount, owed_to, implementation_intention } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (cadence !== "daily" && cadence !== "weekly") {
    return NextResponse.json({ error: "Cadence must be daily or weekly" }, { status: 400 });
  }

  // A stake is optional, but it's all-or-nothing: a dollar amount with no
  // one to owe (or vice versa) isn't a valid state.
  const hasStakeInput = stake_amount !== undefined && stake_amount !== null && stake_amount !== "";
  const hasFriendInput = !!owed_to?.trim();
  if (hasStakeInput !== hasFriendInput) {
    return NextResponse.json(
      { error: "A stake needs both an amount and a friend to owe — or leave both blank" },
      { status: 400 }
    );
  }

  let stake: number | null = null;
  if (hasStakeInput) {
    stake = Number(stake_amount);
    if (!Number.isFinite(stake) || stake <= 0) {
      return NextResponse.json({ error: "Stake must be a positive amount" }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from("habits")
    .insert({
      owner_id: user.id,
      name: name.trim(),
      cadence,
      stake_amount: stake,
      owed_to: hasFriendInput ? owed_to.trim() : null,
      implementation_intention: implementation_intention?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ habit: data }, { status: 201 });
}
