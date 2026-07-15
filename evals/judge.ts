// Layer 3 LLM-as-judge eval: generates nudges with Haiku against a golden
// set, then grades each with a stronger model (Sonnet) on groundedness,
// specificity, tone, and framing. Gates: groundedness 100%, tone/specificity
// ~95%. Requires ANTHROPIC_API_KEY.
//
// Run: npm run evals

import Anthropic from "@anthropic-ai/sdk";
import { NUDGE_SYSTEM } from "../lib/nudge";

type GoldenCase = {
  name: string;
  habit: string;
  missNote: string;
  retrieved: { period_start: string; status: string; note: string; similarity: number }[];
};

const GOLDEN: GoldenCase[] = [
  {
    name: "work-pattern with past recovery",
    habit: "Gym",
    missNote: "skipped again, meetings ran until 8",
    retrieved: [
      { period_start: "2026-06-12", status: "miss", note: "work ran late, no gym", similarity: 0.86 },
      { period_start: "2026-06-13", status: "hit", note: "back at it after missing yesterday, felt great", similarity: 0.78 },
    ],
  },
  {
    name: "sleep pattern, no recovery evidence",
    habit: "Morning run",
    missNote: "slept through the alarm again",
    retrieved: [
      { period_start: "2026-06-20", status: "miss", note: "couldn't get up, went to bed way too late", similarity: 0.83 },
    ],
  },
  {
    name: "single weak-ish match",
    habit: "Journal",
    missNote: "friends were over late, forgot completely",
    retrieved: [
      { period_start: "2026-06-25", status: "miss", note: "social evening, journaling slipped my mind", similarity: 0.77 },
    ],
  },
];

const JUDGE_RUBRIC = `You are grading a habit-tracker recovery nudge against the
source material that generated it. Grade each criterion strictly true/false:

- groundedness: EVERY factual claim about the past traces to a provided
  retrieved note. Any invented event, date, or detail = false.
- specificity: the nudge references at least one concrete past check-in
  (what happened / when), not vague encouragement.
- tone: self-compassionate and pattern-observing; zero scolding, shame,
  guilt-tripping, or "you should have" language.
- framing: uses never-miss-twice and/or fresh-start framing where it fits
  (grade leniently — only false if the nudge actively contradicts them).

Respond with ONLY a JSON object:
{"groundedness": bool, "specificity": bool, "tone": bool, "framing": bool, "reason": "one sentence"}`;

async function main() {
  const anthropic = new Anthropic();
  const results: Record<string, boolean>[] = [];

  for (const c of GOLDEN) {
    const retrievedBlock = c.retrieved
      .map(
        (m, i) =>
          `${i + 1}. [${m.period_start}] (${m.status}, similarity ${m.similarity.toFixed(2)}): ${m.note}`
      )
      .join("\n");

    // Generate with the production model + prompt
    const gen = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 300,
      system: NUDGE_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Habit: ${c.habit}\n\nToday's missed check-in note: ${c.missNote}\n\nRetrieved past check-in notes (most similar first):\n${retrievedBlock}`,
        },
      ],
    });
    const nudgeBlock = gen.content[0];
    const nudge = nudgeBlock.type === "text" ? nudgeBlock.text.trim() : "";

    // Judge with a stronger model
    const judged = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 300,
      system: JUDGE_RUBRIC,
      messages: [
        {
          role: "user",
          content: `Retrieved notes provided to the generator:\n${retrievedBlock}\n\nToday's miss note: ${c.missNote}\n\nGenerated nudge:\n${nudge}`,
        },
      ],
    });
    const judgeBlock = judged.content[0];
    const raw = judgeBlock.type === "text" ? judgeBlock.text.trim() : "{}";
    const verdict = JSON.parse(raw.replace(/^```(json)?|```$/g, ""));
    results.push(verdict);

    console.log(`\n=== ${c.name}`);
    console.log(`nudge: ${nudge}`);
    console.log(`verdict: ${JSON.stringify(verdict)}`);
  }

  const rate = (k: string) =>
    results.filter((r) => r[k]).length / results.length;
  console.log(`\ngroundedness: ${(rate("groundedness") * 100).toFixed(0)}% (gate: 100%)`);
  console.log(`specificity:  ${(rate("specificity") * 100).toFixed(0)}% (gate: ~95%)`);
  console.log(`tone:         ${(rate("tone") * 100).toFixed(0)}% (gate: ~95%)`);
  console.log(`framing:      ${(rate("framing") * 100).toFixed(0)}% (report only)`);

  const pass = rate("groundedness") === 1 && rate("tone") >= 0.95 && rate("specificity") >= 0.95;
  console.log(pass ? "\nNudge eval PASSED" : "\nNudge eval FAILED");
  process.exit(pass ? 0 : 1);
}

main();
