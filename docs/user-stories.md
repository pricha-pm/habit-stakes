# User Stories

One persona in v1 ("I" = the single seeded user). Builder stories are marked —
they exist so correctness and measurability get built, not bolted on.

---

## v1 — locked scope

### Habit setup

**1. Create a habit with stakes**
As a user, I want to create a habit with a name, cadence (daily or weekly),
stake amount, and the friend I'll owe, so that each miss has a real cost to a
real person.
- *Acceptance:* habit saved with all fields; appears in my habit list
  immediately.

**2. Set an implementation intention**
As a user, I want to optionally record "After I [existing routine], I will
[habit]" when creating a habit, so that my habit is anchored to an existing
cue. (Gollwitzer & Sheeran, d=.65.)
- *Acceptance:* field is optional; when set, it's echoed back on the
  pending-confirmation screen.

**3. Be nudged to start small**
As a user, I want a "research says start small" note when I try to add a
fourth active habit, so that I don't overcommit and abandon everything.
- *Acceptance:* soft cap at 3 — warning shown, but I can proceed.

### Checking in

**4. Two-tap check-in**
As a user, I want to mark today's (or this week's) habit as hit or miss in two
taps, so that tracking never feels like a chore.
- *Acceptance:* hit/miss recorded for the current cadence period in ≤2 taps;
  note is optional.

**5. Add context with a note**
As a user, I want to optionally attach a free-text note to any check-in (hit
or miss), so that the app builds a memory of my patterns.
- *Acceptance:* note saved and embedded on save, regardless of hit/miss
  status.

**6. Confirm missed periods later**
As a user, I want lapsed periods I never checked in on to be flagged as
pending when I next open the app, so that I can honestly backfill hit or miss
instead of the app assuming failure.
- *Acceptance:* daily cron marks lapsed periods `pending`; app opens to a
  confirmation screen showing the implementation intention; I resolve each to
  hit/miss with an optional note.

**7. Auto-convert stale pendings**
As a user, I want pendings older than 3 days to auto-convert to misses, so
that the ledger stays honest even when I avoid the app.
- *Acceptance:* auto-converted misses have no note, increment the ledger, and
  never trigger a nudge.

### Consequences and coaching

**8. See who I owe**
As a user, I want every miss to show "You now owe Sam $5" with a running
per-habit balance, so that the social cost is concrete, not an abstract
number.
- *Acceptance:* friend's name prominent on every miss; ledger shows running
  total per habit; never a bare "−$5".

**9. Mark debts settled**
As a user, I want to mark ledger entries settled after I Venmo my friend, so
that the balance reflects reality.
- *Acceptance:* per-entry settled toggle; settled entries drop out of the
  running balance.

**10. Get a nudge grounded in my own history**
As a user, when I log a miss with a note, I want a short nudge that references
specific past check-ins similar to this moment, so that the coaching feels
like it knows me.
- *Acceptance:* top-3 retrieval above ~0.75 cosine floor; nudge is
  self-compassionate, pattern-observing, uses never-miss-twice / fresh-start
  framing; logged with retrieved check-in IDs and similarity scores.

**11. Never get a generic nudge**
As a user, when nothing in my history is relevant to my miss, I want the app
to stay silent, so that I never learn to ignore its coaching.
- *Acceptance:* below-floor retrieval → no nudge at all; ledger still
  increments.

**12. Rate nudges**
As a user, I want to thumbs-up/down each nudge, so that there's data on
whether grounded nudges actually feel specific. (v1 validation metric.)
- *Acceptance:* one-tap feedback stored on the nudge record.

### Progress

**13. See consistency, not streaks**
As a user, I want a rolling 30-day consistency % per habit, so that one bad
day never visually erases weeks of progress. (Lally 2010; abstinence
violation effect.)
- *Acceptance:* no streak counters anywhere; a single miss changes the % only
  marginally.

### Correctness and measurability (builder stories)

**14. Ledger integrity checks** *(builder)*
As the builder, I want automated tests that verify every miss produces exactly
one correct ledger entry, so that the money owed is never wrong — a single
ledger bug destroys trust in the entire stakes mechanic.
- *Acceptance:* seeded-scenario tests pass in CI: miss → one entry with
  correct amount/friend; hit → no entry; auto-converted miss → entry with no
  nudge; settled toggle removes from balance. Invariants: running balance =
  sum of unsettled entries; checkins↔ledger_entries strictly 1:1 for misses.

**15. Nudge quality evals** *(builder)*
As the builder, I want every generated nudge automatically scored for
groundedness and tone against the notes it retrieved, so that I know nudges
reference real history and never scold — before thumbs-up/down data trickles
in.
- *Acceptance:* eval suite runs against a golden set of miss-note scenarios;
  each nudge scores pass/fail on groundedness (no fabricated events),
  specificity (names a concrete past check-in), and tone (no scolding);
  regressions block deploy. See [evals.md](evals.md).

**16. Recovery-rate instrumentation** *(builder)*
As the builder, I want a `nudge_outcomes` SQL view joining each nudge to its
miss and the next-period check-in status, so that recovery rate ("never miss
twice", made measurable) is queryable from day one.
- *Acceptance:* view exists; no dashboard UI; supports the nudged vs
  un-nudged miss comparison described in CLAUDE.md monitoring section.

---

## Enhancements — on the record, NOT in v1

Gated on v1 validation (thumbs data + recovery rate). Do not build early.

**E1. Miss-reason classification** *(v1.5 — gate: grounded nudges are landing)*
As a user, I want my miss notes automatically tagged with a failure mode
(work | sleep | travel | social | motivation), so that nudges can surface
aggregate patterns ("6 of your last 8 misses cite work") instead of only
anecdotal similarity.
- *Acceptance:* Haiku tags on note save; stored as a column on checkins; a
  nudge may cite the aggregate count.

**E2. Ghost nudges** *(v1.5 — gate: real pod members exist)*
As the builder, I want a random ~20% of nudge-eligible misses to generate and
log a nudge without showing it (`suppressed: true`), so that shown-vs-ghost
recovery rate gives a clean randomized measure of nudge efficacy.
- *Acceptance:* suppression is random, logged identically to shown nudges;
  excluded from thumbs feedback.

**E3. Invite a real friend** *(gate: loss-aversion mechanic validated on
seeded data)*
As a user, I want to invite the friend named in my stakes so they actually
exist in the app, so that accountability is real rather than simulated.
- *Acceptance:* magic-link auth; invited friend can see what I owe them and
  mark entries settled from their side.

**E4. Pod visibility**
As a pod member, I want to see my friends' consistency percentages (not their
notes), so that accountability is ambient rather than surveillance.
- *Acceptance:* notes and nudges stay private; only consistency % and ledger
  balances between me and that friend are shared.

**E5. Payment rails** *(explicitly out of v1)*
As a user, I want settling a debt to deep-link into Venmo with amount and
recipient prefilled, so that settlement friction stays near zero. Full
payment API integration only if manual settlement proves to be a drop-off
point.

**E6. Weekly digest** *(constrained by notification research — max 1/week)*
As a user, I want one weekly email summarizing consistency, money owed, and
any pattern insights, so that the app stays present without push-notification
fatigue (6+ pushes/week → 3.4× uninstall risk).

Explicitly never: streak counters, generic motivational nudges, gamification
badges, push notifications beyond E6.
