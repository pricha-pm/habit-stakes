import { db } from "./db";

type StakedHabit = { id: string; stake_amount: number; owed_to: string };

/**
 * Creates the ledger entry for a missed check-in. Idempotent: checkin_id is
 * unique on ledger_entries, so a duplicate insert is a no-op — a miss can
 * never double-bill. Caller must only invoke this for habits that actually
 * carry a stake (stake_amount and owed_to both set) — habits tracked
 * without money never reach here.
 */
export async function billMiss(checkinId: string, habit: StakedHabit): Promise<void> {
  const { error } = await db().from("ledger_entries").insert({
    habit_id: habit.id,
    checkin_id: checkinId,
    owed_to: habit.owed_to,
    amount: habit.stake_amount,
  });
  // 23505 = unique_violation: entry already exists, which is fine
  if (error && error.code !== "23505") {
    throw new Error(`ledger insert failed: ${error.message}`);
  }
}
