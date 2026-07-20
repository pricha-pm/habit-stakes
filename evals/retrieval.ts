// Layer 2 retrieval eval: embeds the fixture notes and checks that related
// notes clear the similarity floor while unrelated ones rank below related
// ones. Runs entirely in-process (no DB) — this is where the floor gets
// tuned, not in production. Requires OPENAI_API_KEY.
//
// Run: npx tsx evals/retrieval.ts

import { readFileSync } from "node:fs";
import { embed } from "../lib/embeddings";

const FLOOR = Number(process.env.NUDGE_SIMILARITY_FLOOR || 0.5);

function cosine(a: number[], b: number[]): number {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function main() {
  const fixtures = JSON.parse(readFileSync("evals/fixtures/notes.json", "utf8"));

  console.log(`Embedding ${fixtures.notes.length} fixture notes…`);
  const noteEmbeddings = new Map<string, number[]>();
  for (const note of fixtures.notes) {
    const e = await embed(note.text);
    if (!e) throw new Error("Embedding failed — is OPENAI_API_KEY set?");
    noteEmbeddings.set(note.id, e);
  }

  let failures = 0;
  for (const c of fixtures.cases) {
    const queryEmbedding = await embed(c.query);
    if (!queryEmbedding) throw new Error("Embedding failed");

    const scored = fixtures.notes
      .map((n: { id: string }) => ({
        id: n.id,
        sim: cosine(queryEmbedding, noteEmbeddings.get(n.id)!),
      }))
      .sort((a: { sim: number }, b: { sim: number }) => b.sim - a.sim);

    const top3 = scored.slice(0, 3).map((s: { id: string }) => s.id);
    const bySim = Object.fromEntries(scored.map((s: { id: string; sim: number }) => [s.id, s.sim]));

    console.log(`\nQuery: "${c.query}"`);
    for (const s of scored.slice(0, 5)) {
      const aboveFloor = s.sim >= FLOOR ? "✓" : " ";
      console.log(`  ${aboveFloor} ${s.sim.toFixed(3)}  ${s.id}`);
    }

    // At least one expected-related note in top 3 and above the floor
    const relatedHit = c.expect_related.some(
      (id: string) => top3.includes(id) && bySim[id] >= FLOOR
    );
    if (!relatedHit) {
      console.log(`  FAIL: none of [${c.expect_related}] in top-3 above floor ${FLOOR}`);
      failures++;
    }
    // Unrelated notes must rank below every expected-related note
    const minRelated = Math.min(...c.expect_related.map((id: string) => bySim[id]));
    for (const id of c.expect_unrelated) {
      if (bySim[id] >= minRelated) {
        console.log(`  FAIL: unrelated "${id}" (${bySim[id].toFixed(3)}) outranks a related note`);
        failures++;
      }
    }
  }

  console.log(failures === 0 ? "\nRetrieval eval PASSED" : `\nRetrieval eval FAILED (${failures})`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
