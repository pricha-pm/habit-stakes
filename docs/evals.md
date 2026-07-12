# Eval Architecture

Two different correctness problems, two different machines:
**ledger correctness is deterministic** (classic automated tests);
**nudge correctness is judgment-based** (LLM-as-judge + online feedback).
Don't build one system for both — build a cheap version of each.

## Layer 1 — deterministic tests: ledger + miss detection

Plain Vitest (unit/integration) against a seeded Supabase branch. No AI.

Scenarios:
- miss → exactly one ledger entry, correct amount and friend
- hit → no ledger entry
- auto-converted miss (pending > 3 days) → ledger entry, no note, no nudge
- settled toggle → entry drops out of running balance
- cron edge cases: lapsed period → pending; pending exactly at 3-day boundary
- cron self-healing: skip a run, leave two lapsed periods → next run
  processes both; re-running the same day changes nothing (idempotent)

Invariants:
- running balance = sum of unsettled entries, always
- checkins↔ledger_entries strictly 1:1 for misses

Highest value, lowest cost — write this layer first.

## Layer 2 — retrieval evals

Fixture file of ~20 notes with known similarity relationships
("skipped gym, work ran late" must retrieve "stuck at office, no workout").

Assert:
- expected notes appear in top-3
- below-floor queries produce NO nudge (the grounding floor holds)

This is where the ~0.75 cosine threshold gets tuned empirically — not in
production.

## Layer 3 — LLM-as-judge: nudge quality

Script (`npm run evals`): golden set of (miss note + retrieved notes) pairs →
generate nudges with Haiku → grade each with a stronger model (Sonnet)
against a rubric:

| Criterion    | Standard                                                      | Gate   |
|--------------|---------------------------------------------------------------|--------|
| Groundedness | every factual claim traces to a retrieved note; zero fabrication | 100%  |
| Specificity  | references a concrete past check-in, not vague encouragement  | ~95%   |
| Tone         | no scolding/shame language; self-compassionate                | ~95%   |
| Framing      | never-miss-twice / fresh-start used when context calls for it | report |

Fail the run on any gate miss. Re-run on every prompt change.

## Layer 4 — online eval (already in the schema)

The nudges table logs `retrieved_checkin_ids`, `similarity_scores`, and
`feedback`. Every production nudge is therefore replayable: re-judge past
nudges offline whenever the prompt changes, and correlate judge scores with
real thumbs data to check that the judge itself is calibrated.

## Behavioral monitoring

Whether nudges WORK (vs feel good) is measured by recovery rate via the
`nudge_outcomes` view — see the "Nudge efficacy monitoring" section in
[CLAUDE.md](../CLAUDE.md). Ghost nudges (docs/user-stories.md E2) upgrade
that from directional to causal once real pod members exist.

## Explicitly skipped for v1

Eval dashboards, Braintrust/LangSmith-style platforms, automated prompt
optimization. A fixtures folder, two test files, and one judge script cover
a single-user app completely.
