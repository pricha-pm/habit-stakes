import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { addDays, localDateISO } from "@/lib/periods";

export const dynamic = "force-dynamic";

// Trend data: habits + resolved (hit/miss) checkins going back a generous
// window (just over a year) so the Trends page can offer week/month/custom
// range presets from a single fetch, with all bucketing done client-side
// via lib/periods.consistencySeries. Payload stays small (a few hundred
// rows at most) for a single-user app, so one wide fetch beats refetching
// on every range change.
export async function GET() {
  const database = db();
  const cutoff = addDays(localDateISO(), -400);

  const [habitsRes, checkinsRes] = await Promise.all([
    database
      .from("habits")
      .select("id, name, cadence, stake_amount, owed_to")
      .eq("active", true)
      .order("created_at"),
    database
      .from("checkins")
      .select("habit_id, period_start, status")
      .in("status", ["hit", "miss"])
      .gte("period_start", cutoff)
      .order("period_start"),
  ]);

  if (habitsRes.error || checkinsRes.error) {
    return NextResponse.json(
      { error: habitsRes.error?.message || checkinsRes.error?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ habits: habitsRes.data, checkins: checkinsRes.data });
}
