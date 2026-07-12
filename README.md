# Habit Stakes

A habit tracker where missing costs you real money — owed to a real friend — and slipping up gets you a coaching nudge grounded in your own past check-ins, not generic motivation.

## Why this exists

Most habit trackers fail their users in two research-documented ways:

1. **Streak resets punish the wrong thing.** The foundational UCL habit study (Lally 2010) found that missing a single day doesn't materially affect habit formation — yet streak-based apps wipe weeks of visible progress over one slip, triggering the "abstinence violation effect" that predicts total abandonment. ~92% of habit-tracking attempts die within 60 days, largely from streak guilt.
2. **Their motivation is fake.** Badges and gamified points don't move behavior. What does, per the deposit-contract literature: your own money at risk (losses feel ~2× as intense as equivalent gains) stacked with accountability to a specific named person (roughly doubles goal attainment odds vs. private tracking).

Habit Stakes bets on the evidence-backed combination no mainstream tracker offers:

- **Real stakes** — each miss adds to a running ledger owed to a named friend, settled manually via Venmo. The app tracks the money; the awkwardness of owing your friend does the motivating.
- **Forgiveness-first progress** — rolling 30-day consistency % instead of streaks. A single miss never visually erases progress.
- **Grounded coaching** — when you log a miss with a note, the app searches your entire check-in history for semantically similar moments and generates a short nudge referencing them specifically ("this is the third time work has pushed out the gym — last time you bounced back the next day"). If nothing in your history is relevant enough, it stays silent. It never sends a generic pep talk.

The stakes deliver the sting; the nudges deliver the recovery path.

**v1 is a single-user validation build** (me, seeded pod data, no auth). Real friends and multi-user auth come once the loss-aversion mechanic proves out.

## How it works

1. Create a habit: name, cadence (daily/weekly), stake amount, and an optional implementation intention ("After I make coffee, I will journal"). Soft cap of 3 active habits.
2. Check in each period: hit or miss, two taps, optional free-text note. Every note is embedded on save.
3. Miss a period without checking in? A daily cron marks it `pending`; you confirm hit/miss on next open. Pending older than 3 days auto-converts to a miss.
4. A confirmed miss increments the ledger ("You now owe Sam $5") and — if you left a note — may trigger a retrieval-grounded nudge.
5. Thumbs up/down on each nudge logs whether it felt specific or generic — the core validation metric for v1.

## Infrastructure

```
Browser (Next.js / Tailwind UI)
   │
   ▼
Vercel ── Next.js app + API routes
   │       └── Vercel cron (daily): marks lapsed periods pending,
   │           auto-converts stale pending → miss
   ▼
Supabase ── Postgres + pgvector
   │         tables: habits, checkins (with note embeddings),
   │         ledger_entries, nudges
   │
   ├──► Embeddings API (Voyage or OpenAI) — turns check-in notes
   │    into vectors for semantic search
   └──► Anthropic API (Claude Haiku) — generates nudge text from
        retrieved past check-ins
```

**The miss → nudge path:** miss + note saved → note embedded → pgvector cosine-similarity search over all past notes → top 3 above a ~0.75 similarity floor → if any clear the floor, Haiku writes a short nudge referencing them (logged with retrieved check-in IDs and scores); if none do, no nudge. The ledger increments either way.

**Stack:** Next.js · Tailwind · Supabase (Postgres + pgvector) · Vercel (hosting + cron) · Claude Haiku (nudge generation) · Voyage/OpenAI (embeddings)

**Explicitly out of scope for v1:** payment integration, multi-user auth, mobile app, nudges on successful check-ins, email/push notifications (the last one is a feature — notification overload is a top driver of tracker abandonment).

## Project docs

- [CLAUDE.md](CLAUDE.md) — locked v1 scope, evidence-backed UX principles, build prompt
- [sessions/](sessions/) — discovery and scope decisions
