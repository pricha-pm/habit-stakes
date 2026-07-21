"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Checkin = {
  id: string;
  period_start: string;
  status: string;
  note: string | null;
};

type Habit = {
  id: string;
  name: string;
  cadence: "daily" | "weekly";
  stake_amount: number;
  owed_to: string;
  implementation_intention: string | null;
  consistency_pct: number | null;
  current_period_start: string;
  current_checkin: Checkin | null;
  pending_checkins: Checkin[];
};

type Nudge = { id: string; generated_text: string };

type CheckinResult = {
  owed: { to: string; amount: number } | null;
  nudge: Nudge | null;
};

export default function Home() {
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [owedTotals, setOwedTotals] = useState<Record<string, number>>({});
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/state");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setHabits(data.habits);
      setOwedTotals(data.owed_totals);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const checkIn = async (
    habitId: string,
    periodStart: string,
    status: "hit" | "miss",
    note: string
  ) => {
    setError(null);
    const res = await fetch("/api/checkins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        habit_id: habitId,
        period_start: periodStart,
        status,
        note: note || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    if (data.owed || data.nudge) {
      setResult({ owed: data.owed, nudge: data.nudge });
    }
    await load();
  };

  const totalOwedEntries = Object.entries(owedTotals).filter(([, amt]) => amt > 0);

  return (
    <main>
      <header className="pt-8 pb-6">
        <div className="flex items-baseline justify-between">
          <h1 className="font-display text-4xl font-bold tracking-tight">
            Habit <span className="font-normal italic text-ember">Stakes</span>
          </h1>
          <Link
            href="/ledger"
            className="eyebrow text-moss underline underline-offset-4"
          >
            Ledger
          </Link>
        </div>
        <div className="mt-4 h-px bg-ink/10" />
      </header>

      {totalOwedEntries.length > 0 && (
        <div className="mb-6 space-y-2">
          {totalOwedEntries.map(([friend, amount]) => (
            <div key={friend} className="rounded-2xl bg-ember px-5 py-4 text-paper shadow-sm">
              <p className="font-display text-lg">
                You owe <span className="font-bold">{friend}</span>{" "}
                <span className="font-bold">${amount.toFixed(2)}</span>
              </p>
              <Link
                href="/ledger"
                className="eyebrow mt-1 inline-block text-paper/80 underline underline-offset-4"
              >
                Settle up
              </Link>
            </div>
          ))}
        </div>
      )}

      {result && <MissResult result={result} onDismiss={() => setResult(null)} />}
      {error && (
        <div className="mb-4 rounded-xl bg-ember-light px-4 py-2 text-sm text-ember">{error}</div>
      )}

      {habits === null ? (
        <p className="py-12 text-center text-sm opacity-60">Loading…</p>
      ) : (
        <>
          <PendingSection habits={habits} onCheckIn={checkIn} />

          <section className="space-y-4">
            {habits.map((h) => (
              <HabitCard key={h.id} habit={h} onCheckIn={checkIn} />
            ))}
          </section>

          {habits.length === 0 && (
            <p className="py-12 text-center text-sm opacity-60">
              No habits yet. Start with one.
            </p>
          )}

          <Link
            href="/habits/new"
            className="mt-8 block rounded-full border-2 border-moss/60 py-3 text-center text-sm font-semibold text-moss"
          >
            + New habit
          </Link>
        </>
      )}
    </main>
  );
}

function MissResult({
  result,
  onDismiss,
}: {
  result: CheckinResult;
  onDismiss: () => void;
}) {
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  const sendFeedback = async (value: "up" | "down") => {
    if (!result.nudge || feedback) return;
    setFeedback(value);
    await fetch(`/api/nudges/${result.nudge.id}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback: value }),
    });
  };

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm">
      {result.owed && (
        <div className="bg-ember px-4 py-4 text-paper">
          <p className="eyebrow text-paper/70">New balance</p>
          <p className="mt-1 font-display text-xl">
            You now owe <span className="font-bold">{result.owed.to}</span>{" "}
            <span className="font-bold">${result.owed.amount.toFixed(2)}</span>
          </p>
        </div>
      )}
      <div className="p-4">
        {result.nudge && (
          <div className="rounded-xl bg-moss-light/50 p-3">
            <p className="text-sm leading-relaxed">{result.nudge.generated_text}</p>
            <div className="mt-2 flex items-center gap-3 text-xs opacity-70">
              <span>Did this feel specific to you?</span>
              <button
                onClick={() => sendFeedback("up")}
                disabled={!!feedback}
                className={`text-base ${feedback === "up" ? "" : "grayscale opacity-60"}`}
                aria-label="Nudge felt specific"
              >
                👍
              </button>
              <button
                onClick={() => sendFeedback("down")}
                disabled={!!feedback}
                className={`text-base ${feedback === "down" ? "" : "grayscale opacity-60"}`}
                aria-label="Nudge felt generic"
              >
                👎
              </button>
            </div>
          </div>
        )}
        <button
          onClick={onDismiss}
          className={`text-xs underline opacity-60 ${result.nudge ? "mt-3" : ""}`}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function PendingSection({
  habits,
  onCheckIn,
}: {
  habits: Habit[];
  onCheckIn: (habitId: string, periodStart: string, status: "hit" | "miss", note: string) => void;
}) {
  const pendings = habits.flatMap((h) =>
    h.pending_checkins.map((c) => ({ habit: h, checkin: c }))
  );
  if (pendings.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-display text-lg font-semibold">
        <span className="mr-1 text-ember">*</span>While you were away — what happened?
      </h2>
      <div className="space-y-3">
        {pendings.map(({ habit, checkin }) => (
          <div
            key={checkin.id}
            className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm"
          >
            <p className="font-display text-lg font-semibold">
              {habit.name}{" "}
              <span className="text-sm font-normal opacity-60">· {checkin.period_start}</span>
            </p>
            {habit.implementation_intention && (
              <p className="mt-1 text-sm italic opacity-70">
                &ldquo;{habit.implementation_intention}&rdquo;
              </p>
            )}
            <CheckinButtons
              onSubmit={(status, note) => onCheckIn(habit.id, checkin.period_start, status, note)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function HabitCard({
  habit,
  onCheckIn,
}: {
  habit: Habit;
  onCheckIn: (habitId: string, periodStart: string, status: "hit" | "miss", note: string) => void;
}) {
  const done = habit.current_checkin && habit.current_checkin.status !== "pending";
  const periodLabel = habit.cadence === "daily" ? "today" : "this week";

  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-semibold">{habit.name}</h3>
          <p className="eyebrow mt-1 text-ink/45">
            ${Number(habit.stake_amount).toFixed(2)} to {habit.owed_to} per miss ·{" "}
            {habit.cadence}
          </p>
        </div>
        {habit.consistency_pct !== null && (
          <div className="shrink-0 text-right">
            <p className="font-display text-2xl font-bold text-moss">
              {habit.consistency_pct}%
            </p>
            <p className="eyebrow text-ink/40">Last 30 days</p>
          </div>
        )}
      </div>

      {done ? (
        <p
          className={`mt-3 inline-block rounded-full px-3 py-1 text-sm font-semibold ${
            habit.current_checkin!.status === "hit"
              ? "bg-moss-light text-moss"
              : "bg-ember-light text-ember"
          }`}
        >
          {habit.current_checkin!.status === "hit" ? "✓ Done" : "✗ Missed"} {periodLabel}
        </p>
      ) : (
        <CheckinButtons
          onSubmit={(status, note) =>
            onCheckIn(habit.id, habit.current_period_start, status, note)
          }
        />
      )}
    </div>
  );
}

function CheckinButtons({
  onSubmit,
}: {
  onSubmit: (status: "hit" | "miss", note: string) => void;
}) {
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (status: "hit" | "miss") => {
    setBusy(true);
    await onSubmit(status, note);
    setBusy(false);
  };

  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <button
          onClick={() => submit("hit")}
          disabled={busy}
          className="flex-1 rounded-full bg-moss py-2.5 font-semibold text-white active:scale-95 disabled:opacity-50"
        >
          Hit
        </button>
        <button
          onClick={() => submit("miss")}
          disabled={busy}
          className="flex-1 rounded-full bg-ember py-2.5 font-semibold text-white active:scale-95 disabled:opacity-50"
        >
          Miss
        </button>
      </div>
      {showNote ? (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What happened? (helps your future nudges)"
          rows={2}
          className="mt-2 w-full rounded-xl border border-sand bg-paper p-2 text-sm"
        />
      ) : (
        <button
          onClick={() => setShowNote(true)}
          className="mt-2 text-xs underline opacity-60"
        >
          + add a note
        </button>
      )}
    </div>
  );
}
