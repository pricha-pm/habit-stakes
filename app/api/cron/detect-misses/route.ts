import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { billMiss } from "@/lib/ledger";
import { lapsedPeriodStarts, Cadence } from "@/lib/periods";

export const dynamic = "force-dynamic";

// Daily miss-detection cron. Idempotent and self-healing: every run
// processes ALL unprocessed lapsed periods since each habit's creation (the
// unique (habit_id, period_start) constraint makes re-inserts no-ops), so a
// skipped run heals on the next one. Every run logs to cron_runs so silent
// failure is queryable.
export async function GET(req: Request) {
  // Vercel cron sends "Authorization: Bearer <CRON_SECRET>" automatically
  // when the CRON_SECRET env var is set.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const database = db();
  const { data: habits, error: habitsError } = await database
    .from("habits")
    .select("id, cadence, stake_amount, owed_to, created_at")
    .eq("active", true);
  if (habitsError) {
    return NextResponse.json({ error: habitsError.message }, { status: 500 });
  }

  let pendingCreated = 0;

  // 1. Mark every lapsed period without a check-in as pending.
  for (const habit of habits) {
    const createdISO = habit.created_at.slice(0, 10);
    const lapsed = lapsedPeriodStarts(habit.cadence as Cadence, createdISO);
    if (lapsed.length === 0) continue;

    const { data: existing } = await database
      .from("checkins")
      .select("period_start")
      .eq("habit_id", habit.id)
      .in("period_start", lapsed);
    const covered = new Set((existing ?? []).map((c) => c.period_start));
    const missing = lapsed.filter((p) => !covered.has(p));
    if (missing.length === 0) continue;

    const { error, count } = await database
      .from("checkins")
      .upsert(
        missing.map((period_start) => ({
          habit_id: habit.id,
          period_start,
          status: "pending",
        })),
        { onConflict: "habit_id,period_start", ignoreDuplicates: true, count: "exact" }
      );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    pendingCreated += count ?? missing.length;
  }

  // 2. Auto-convert pendings older than 3 days to misses (no note, no
  //    nudge — nothing to ground a nudge in). Ledger still increments.
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: stale, error: staleError } = await database
    .from("checkins")
    .select("id, habit_id")
    .eq("status", "pending")
    .lt("created_at", cutoff);
  if (staleError) {
    return NextResponse.json({ error: staleError.message }, { status: 500 });
  }

  const habitById = new Map(habits.map((h) => [h.id, h]));
  let autoConverted = 0;
  for (const checkin of stale ?? []) {
    const habit = habitById.get(checkin.habit_id);
    if (!habit) continue;
    const { error } = await database
      .from("checkins")
      .update({ status: "miss", auto_converted: true, resolved_at: new Date().toISOString() })
      .eq("id", checkin.id)
      .eq("status", "pending"); // guard against a concurrent user confirmation
    if (error) continue;
    await billMiss(checkin.id, habit);
    autoConverted++;
  }

  // 3. Observability: log the run.
  const periodsProcessed = pendingCreated + autoConverted;
  await database.from("cron_runs").insert({ periods_processed: periodsProcessed });

  return NextResponse.json({
    pending_created: pendingCreated,
    auto_converted: autoConverted,
  });
}
