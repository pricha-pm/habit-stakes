import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";

// Grounding floor: retrieved notes below this cosine similarity are ignored.
// If nothing clears it, NO nudge is generated — never a generic one.
const SIMILARITY_FLOOR = Number(process.env.NUDGE_SIMILARITY_FLOOR || 0.75);
const TOP_K = 3;

type RetrievedNote = {
  id: string;
  habit_id: string;
  note: string;
  status: string;
  period_start: string;
  similarity: number;
};

export const NUDGE_SYSTEM = `You write short recovery nudges for a habit tracker, \
grounded ONLY in the user's own past check-in notes provided to you.

Rules:
- 2-3 sentences maximum.
- Reference at least one retrieved past check-in SPECIFICALLY (what happened, \
roughly when). Every factual claim must trace to a provided note — never \
invent events.
- Tone: self-compassionate and pattern-observing, never scolding or shaming. \
The stakes already deliver the sting; you deliver the recovery path.
- Use "never miss twice" framing and, where it fits, fresh-start framing \
("new week starts Monday — that's the one that counts").
- If the retrieved notes show a past recovery after a similar situation, \
point to it as evidence they bounce back.
- No greetings, no sign-offs, no emoji. Just the nudge.`;

/**
 * Runs the retrieval-grounded nudge pipeline for a missed check-in with a
 * note. Returns the created nudge row, or null when no past note clears the
 * grounding floor (by design: silence over generic).
 */
export async function generateNudge(params: {
  checkinId: string;
  habitName: string;
  note: string;
  embedding: number[];
}): Promise<{ id: string; generated_text: string } | null> {
  const { checkinId, habitName, note, embedding } = params;

  const { data: matches, error } = await db().rpc("match_checkins", {
    query_embedding: embedding,
    match_count: TOP_K,
    exclude_checkin: checkinId,
  });
  if (error) {
    console.error("match_checkins failed:", error.message);
    return null;
  }

  const grounded = ((matches ?? []) as RetrievedNote[]).filter(
    (m) => m.similarity >= SIMILARITY_FLOOR
  );
  if (grounded.length === 0) return null; // grounding floor: stay silent

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("ANTHROPIC_API_KEY not set — skipping nudge generation");
    return null;
  }

  const anthropic = new Anthropic({ apiKey });
  const retrievedBlock = grounded
    .map(
      (m, i) =>
        `${i + 1}. [${m.period_start}] (${m.status}, similarity ${m.similarity.toFixed(2)}): ${m.note}`
    )
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 300,
    system: NUDGE_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Habit: ${habitName}\n\nToday's missed check-in note: ${note}\n\nRetrieved past check-in notes (most similar first):\n${retrievedBlock}`,
      },
    ],
  });

  const block = response.content[0];
  if (!block || block.type !== "text") return null;
  const generatedText = block.text.trim();

  const { data: nudge, error: insertError } = await db()
    .from("nudges")
    .insert({
      checkin_id: checkinId,
      generated_text: generatedText,
      retrieved_checkin_ids: grounded.map((m) => m.id),
      similarity_scores: grounded.map((m) => m.similarity),
    })
    .select("id, generated_text")
    .single();
  if (insertError) {
    console.error("nudge insert failed:", insertError.message);
    return null;
  }
  return nudge;
}
