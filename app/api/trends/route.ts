import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { addDays, localDateISO, TREND_WEEKS } from "@/lib/periods";

export const dynamic = "force-dynamic";

// Weekly trend data: habits + resolved (hit/miss) checkins going back far
// enough to cover TREND_WEEKS full weeks. Bucketing into weeks happens
// client-side via lib/periods.weeklyConsistencySeries.
export async function GET() {
  const database = db();
  const cutoff = addDays(localDateISO(), -(TREND_WEEKS * 7 + 7));

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
