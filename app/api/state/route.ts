import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { addDays, consistencyPct, currentPeriodStart, localDateISO, Cadence } from "@/lib/periods";

export const dynamic = "force-dynamic";

// Everything the home screen needs in one fetch: habits with consistency %
// and today's status, pending confirmations, and per-friend unsettled totals.
export async function GET() {
  const database = db();

  const [habitsRes, checkinsRes, ledgerRes] = await Promise.all([
    database.from("habits").select("*").eq("active", true).order("created_at"),
    database
      .from("checkins")
      .select("id, habit_id, period_start, status, note, created_at")
      .gte("period_start", addDays(localDateISO(), -45))
      .order("period_start", { ascending: false }),
    database.from("ledger_entries").select("owed_to, amount").eq("settled", false),
  ]);

  if (habitsRes.error || checkinsRes.error || ledgerRes.error) {
    const msg =
      habitsRes.error?.message || checkinsRes.error?.message || ledgerRes.error?.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const habits = habitsRes.data;
  const checkins = checkinsRes.data;

  const habitStates = habits.map((h) => {
    const own = checkins.filter((c) => c.habit_id === h.id);
    const current = currentPeriodStart(h.cadence as Cadence);
    const currentCheckin = own.find((c) => c.period_start === current) ?? null;
    const pending = own.filter((c) => c.status === "pending");
    return {
      ...h,
      consistency_pct: consistencyPct(own),
      current_period_start: current,
      current_checkin: currentCheckin,
      pending_checkins: pending,
    };
  });

  const owedTotals: Record<string, number> = {};
  for (const e of ledgerRes.data) {
    owedTotals[e.owed_to] = (owedTotals[e.owed_to] || 0) + Number(e.amount);
  }

  return NextResponse.json({ habits: habitStates, owed_totals: owedTotals });
}
