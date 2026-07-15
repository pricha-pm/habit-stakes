import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { embed, EMBEDDING_MODEL } from "@/lib/embeddings";
import { billMiss } from "@/lib/ledger";
import { generateNudge } from "@/lib/nudge";
import { currentPeriodStart, periodStartFor, Cadence } from "@/lib/periods";

export const dynamic = "force-dynamic";

// Record a check-in: current period (two taps) or resolving a pending
// backfill. On a miss: bill the ledger, and if there's a note, run the
// retrieval-grounded nudge pipeline.
export async function POST(req: Request) {
  const body = await req.json();
  const { habit_id, period_start, status } = body;
  const note: string | null = body.note?.trim() || null;

  if (status !== "hit" && status !== "miss") {
    return NextResponse.json({ error: "Status must be hit or miss" }, { status: 400 });
  }

  const database = db();
  const { data: habit, error: habitError } = await database
    .from("habits")
    .select("*")
    .eq("id", habit_id)
    .single();
  if (habitError || !habit) {
    return NextResponse.json({ error: "Habit not found" }, { status: 404 });
  }

  const cadence = habit.cadence as Cadence;
  const current = currentPeriodStart(cadence);
  const target = period_start || current;

  if (periodStartFor(cadence, target) !== target) {
    return NextResponse.json({ error: "period_start not aligned to cadence" }, { status: 400 });
  }
  if (target > current) {
    return NextResponse.json({ error: "Cannot check in for a future period" }, { status: 400 });
  }

  // Embed the note (hit or miss) before writing, so the row lands complete.
  const embedding = note ? await embed(note) : null;

  // Resolve an existing pending row, or insert fresh. The unique
  // (habit_id, period_start) constraint prevents double check-ins.
  const { data: existing } = await database
    .from("checkins")
    .select("id, status")
    .eq("habit_id", habit_id)
    .eq("period_start", target)
    .maybeSingle();

  let checkinId: string;
  if (existing) {
    if (existing.status !== "pending") {
      return NextResponse.json(
        { error: "This period is already checked in" },
        { status: 409 }
      );
    }
    const { error } = await database
      .from("checkins")
      .update({
        status,
        note,
        note_embedding: embedding,
        embedding_model: embedding ? EMBEDDING_MODEL : null,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    checkinId = existing.id;
  } else {
    const { data, error } = await database
      .from("checkins")
      .insert({
        habit_id,
        period_start: target,
        status,
        note,
        note_embedding: embedding,
        embedding_model: embedding ? EMBEDDING_MODEL : null,
        resolved_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) {
      const code = error.code === "23505" ? 409 : 500;
      return NextResponse.json({ error: error.message }, { status: code });
    }
    checkinId = data.id;
  }

  let owed: { to: string; amount: number } | null = null;
  let nudge: { id: string; generated_text: string } | null = null;

  if (status === "miss") {
    await billMiss(checkinId, habit);
    owed = { to: habit.owed_to, amount: Number(habit.stake_amount) };

    if (note && embedding) {
      try {
        nudge = await generateNudge({
          checkinId,
          habitName: habit.name,
          note,
          embedding,
        });
      } catch (e) {
        // A nudge failure must never fail the check-in itself
        console.error("nudge pipeline failed:", e);
      }
    }
  }

  return NextResponse.json({ checkin_id: checkinId, status, owed, nudge });
}
