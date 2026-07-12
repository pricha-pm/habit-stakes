# Habit Stakes — Claude Code Context

## What this is
A habit tracker with real (manually-settled) stakes and retrieval-grounded
coaching nudges. v1 is single-user with seeded/fake pod data — real friends
get added once the mechanic is validated. Locked scope lives in
`sessions/2026-07-06.md`.

## Defaults (inherited from vibeos)
- Stack: Next.js, Tailwind, Supabase, Vercel
- Primary build environment: Claude Code in VS Code
- Auth: none for v1 (single seeded user); magic link once real pod members are added
- Deploy target: Vercel

## Locked v1 scope
- Stakes: manual reconciliation (app tracks who owes what; settling happens outside the app)
- Counterparty is a REAL friend (named in `owed_to`), settled via Venmo outside
  the app — this is what makes the loss-aversion mechanic testable in v1
- Habits: user-defined (name, cadence, stake amount) — no other config
- Cadence: daily or weekly only ("custom" dropped — underspecified, not happy-path)
- Miss detection (hybrid grace + backfill): a Vercel cron marks lapsed cadence
  periods as `pending`; user confirms hit/miss (with optional note) on next app
  open; pending older than 3 days auto-converts to a miss
- Nudges: fire only on a missed check-in with a note, via embedding retrieval
  over ALL of that user's past check-in notes (hits and misses)
- Nudge grounding floor: if no retrieved note clears the similarity threshold
  (start ~0.75 cosine, tune live), skip the nudge entirely — never send a
  generic one. Ledger still increments. Auto-converted misses have no note, so
  they never nudge — consistent by design.
- Providers: Claude (Haiku) via Anthropic API for nudge generation; Voyage or
  OpenAI for embeddings (single env key, decide at build time)
- Pod: just me, seeded data — no invite/multi-user auth flow yet

## Evidence-backed UX principles (researched 2026-07-07)
- NO streak counters that reset to zero. Show a rolling 30-day consistency %
  instead. (Lally 2010: one missed rep doesn't derail habit formation; streak
  resets trigger the abstinence violation effect → abandonment.)
- Habit creation includes ONE optional implementation-intention field:
  "After I [existing routine], I will [habit]" — echoed back on the pending-
  confirmation screen. (Gollwitzer & Sheeran meta-analysis, d=.65.)
- On a miss, the friend's name is visually prominent: "You now owe Sam $5",
  never just "−$5". (Deposit contracts + social accountability stack.)
- Nudge tone: self-compassionate, pattern-observing, never scolding. Stakes
  deliver the sting; nudges deliver the recovery path. Use "never miss twice"
  and fresh-start framing ("new week starts Monday — that's the one that
  counts"). (Marlatt & Gordon; Dai/Milkman fresh-start effect.)
- Soft cap of 3 active habits, with a "research says start small" note.
- Check-in is two taps (hit/miss); note stays optional. No push notifications
  (already out of scope — this is a feature, not a gap).

## v1.5 candidates (on the record, NOT in v1)
- Miss-reason classification: on note save, Haiku tags the check-in with a
  failure mode (work | sleep | travel | social | motivation), stored as a
  column on checkins. Unlocks aggregate pattern surfacing in nudges ("6 of
  your last 8 misses cite work"). Build only if v1 thumbs-up/down data shows
  grounded nudges are landing.

## Explicitly out of scope for v1
- Real payment integration (Stripe/Venmo API)
- Multi-user auth / invite flow
- Mobile app
- Nudges on successful check-ins
- Email/push notifications

## How to work with me on this
- Discovery is done — don't revisit product decisions, build against the locked scope above
- Scope aggressively — if it's not in the happy path, it's out
- Keep responses short, I'm in build mode

---

## Ready-to-paste build prompt

```
Build a habit-stakes tracker web app.

Stack: Next.js, Tailwind, Supabase (Postgres + pgvector extension), deploy target Vercel.

Features to build (v1, single seeded user, no auth):
1. Habit creation form: name, cadence (daily or weekly), stake amount, and
   ONE optional implementation-intention field ("After I [existing routine],
   I will [habit]"), stored on the habit and echoed back on the pending-
   confirmation screen. Soft cap of 3 active habits with a "research says
   start small" note.
2. Check-in flow: mark a habit hit or missed for the current cadence period,
   with an optional free-text note. Two taps max for a no-note check-in.
   Embed EVERY note (hit or miss) on save.
3. Miss detection, hybrid: a Vercel cron (daily) marks any lapsed cadence
   period without a check-in as status=pending. On next app open, the user
   sees pending periods and confirms hit or miss with an optional note.
   Pending older than 3 days auto-converts to miss (no note, no nudge).
4. On a missed check-in WITH a note: embed the note, run pgvector similarity
   search over all past check-in notes (hits and misses), take the top 3
   above a cosine-similarity floor (~0.75, tunable). If nothing clears the
   floor, skip the nudge — never generate a generic one. Otherwise generate
   a short nudge (Claude Haiku) that references the retrieved entries
   specifically. Nudge tone: self-compassionate and pattern-observing, never
   scolding — use "never miss twice" and fresh-start framing ("new week
   starts Monday"). Log the nudge with retrieved check-in IDs and their
   similarity scores.
5. Ledger view: running balance of stake amounts owed per habit to a real
   named friend (manual reconciliation — no payment movement, just a running
   total and a per-entry "mark settled" toggle). On every miss, show the
   friend's name prominently ("You now owe Sam $5"), never a bare "−$5".
6. Simple thumbs up/down on each nudge to log whether it felt specific vs. generic.
7. Progress display: rolling 30-day consistency % per habit. NO streak
   counters that reset to zero — a single miss must never visually wipe out
   prior progress.

DB tables:
- habits (id, name, cadence, stake_amount, implementation_intention, created_at)
- checkins (id, habit_id, period_start, status [hit|miss|pending], note,
  note_embedding vector, embedding_model, created_at)
- ledger_entries (id, habit_id, checkin_id, owed_by, owed_to, amount,
  settled boolean, created_at)
- nudges (id, checkin_id, generated_text, retrieved_checkin_ids,
  similarity_scores, feedback [up|down|null], created_at)

Explicitly skip: real payment integration, multi-user auth/invite flow,
mobile app, nudges on hit check-ins, email/push notifications.

Success condition: I can create a habit, check in daily, and when I log a
miss with a note, get back a nudge that clearly references a specific past
check-in of mine rather than a generic message — and see the miss reflected
in the ledger as money owed to a real friend.
```
