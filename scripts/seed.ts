// Seeds the single-user v1 dataset: two habits and ~3 weeks of history with
// notes, so the nudge pipeline has something to retrieve from day one.
// Embeds notes when OPENAI_API_KEY is set; otherwise leaves embeddings null
// (backfill by re-running once the key exists — rows are upserted).
//
// Run: npx tsx scripts/seed.ts

import { db } from "../lib/db";
import { embed, EMBEDDING_MODEL } from "../lib/embeddings";
import { addDays, localDateISO } from "../lib/periods";

const today = localDateISO();
const day = (offset: number) => addDays(today, offset);

const HABITS = [
  {
    name: "Gym",
    cadence: "daily",
    stake_amount: 5,
    owed_to: "Sam",
    implementation_intention: "After I finish my last meeting, I will go to the gym",
    history: [
      { offset: -21, status: "hit", note: "solid session, legs day" },
      { offset: -20, status: "hit", note: null },
      { offset: -19, status: "miss", note: "work ran late, skipped the gym" },
      { offset: -18, status: "hit", note: "back at it after missing yesterday, felt great" },
      { offset: -17, status: "hit", note: null },
      { offset: -16, status: "miss", note: "stuck at the office until 9pm, no workout" },
      { offset: -15, status: "hit", note: null },
      { offset: -14, status: "hit", note: "short session but showed up" },
      { offset: -12, status: "hit", note: null },
      { offset: -11, status: "miss", note: "big deadline this week, no time to exercise" },
      { offset: -10, status: "hit", note: "made time despite the deadline, 30 minutes" },
      { offset: -8, status: "hit", note: null },
      { offset: -7, status: "miss", note: "friends came over, we ended up going out instead" },
      { offset: -6, status: "hit", note: null },
      { offset: -5, status: "hit", note: null },
      { offset: -4, status: "hit", note: "almost skipped but did a short 20 minute session anyway" },
      { offset: -3, status: "hit", note: null },
      { offset: -2, status: "miss", note: "slept terribly, couldn't get myself there" },
      { offset: -1, status: "hit", note: null },
    ],
  },
  {
    name: "Read 20 pages",
    cadence: "daily",
    stake_amount: 2,
    owed_to: "Sam",
    implementation_intention: "After I get into bed, I will read 20 pages",
    history: [
      { offset: -14, status: "hit", note: "read 25 pages, new personal best" },
      { offset: -13, status: "hit", note: null },
      { offset: -12, status: "hit", note: null },
      { offset: -11, status: "miss", note: "exhausted, fell asleep with the book on my chest" },
      { offset: -10, status: "hit", note: null },
      { offset: -9, status: "hit", note: null },
      { offset: -8, status: "hit", note: "getting into the new book, hard to stop" },
      { offset: -7, status: "hit", note: null },
      { offset: -6, status: "miss", note: "doomscrolled instead of reading, annoyed at myself" },
      { offset: -5, status: "hit", note: "phone in the other room, worked like a charm" },
      { offset: -4, status: "hit", note: null },
      { offset: -3, status: "hit", note: null },
      { offset: -2, status: "hit", note: null },
      { offset: -1, status: "hit", note: null },
    ],
  },
] as const;

async function main() {
  const database = db();

  for (const h of HABITS) {
    const createdAt = new Date(
      `${day(Math.min(...h.history.map((x) => x.offset)))}T08:00:00Z`
    ).toISOString();

    const { data: habit, error } = await database
      .from("habits")
      .insert({
        name: h.name,
        cadence: h.cadence,
        stake_amount: h.stake_amount,
        owed_to: h.owed_to,
        implementation_intention: h.implementation_intention,
        created_at: createdAt,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    console.log(`habit: ${habit.name} (${habit.id})`);

    for (const entry of h.history) {
      const embedding = entry.note ? await embed(entry.note) : null;
      const { data: checkin, error: checkinError } = await database
        .from("checkins")
        .upsert(
          {
            habit_id: habit.id,
            period_start: day(entry.offset),
            status: entry.status,
            note: entry.note,
            note_embedding: embedding,
            embedding_model: embedding ? EMBEDDING_MODEL : null,
            resolved_at: new Date().toISOString(),
          },
          { onConflict: "habit_id,period_start" }
        )
        .select("id")
        .single();
      if (checkinError) throw new Error(checkinError.message);

      if (entry.status === "miss") {
        const { error: ledgerError } = await database.from("ledger_entries").insert({
          habit_id: habit.id,
          checkin_id: checkin.id,
          owed_to: h.owed_to,
          amount: h.stake_amount,
        });
        if (ledgerError && ledgerError.code !== "23505") throw new Error(ledgerError.message);
      }
    }
    console.log(`  ${h.history.length} check-ins seeded`);
  }
  console.log("Done.");
}

main();
