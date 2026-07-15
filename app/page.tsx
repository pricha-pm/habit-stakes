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
      <header className="flex items-baseline justify-between pt-8 pb-6">
        <h1 className="font-display text-3xl font-bold">Habit Stakes</h1>
        <Link href="/ledger" className="text-sm text-moss underline underline-offset-4">
          Ledger
        </Link>
      </header>

      {totalOwedEntries.length > 0 && (
        <div className="mb-6 rounded-xl bg-ember-light px-4 py-3">
          {totalOwedEntries.map(([friend, amount]) => (
            <p key={friend} className="text-sm">
              You owe <span className="font-bold text-ember">{friend}</span>{" "}
              <span className="font-bold text-ember">${amount.toFixed(2)}</span> —{" "}
              <Link href="/ledger" className="underline underline-offset-2">
                settle up
              </Link>
            </p>
          ))}
        </div>
      )}

      {result && <MissResult result={result} onDismiss={() => setResult(null)} />}
      {error && (
        <div className="mb-4 rounded-lg bg-ember-light px-4 py-2 text-sm text-ember">{error}</div>
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
            className="mt-8 block rounded-xl border-2 border-dashed border-moss/40 py-3 text-center text-sm font-medium text-moss"
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
    <div className="mb-6 rounded-xl border border-ember/30 bg-white p-4 shadow-sm">
      {result.owed && (
        <p className="font-display text-lg">
          You now owe <span className="font-bold text-ember">{result.owed.to}</span>{" "}
          <span className="font-bold text-ember">${result.owed.amount.toFixed(2)}</span>
        </p>
      )}
      {result.nudge && (
        <div className="mt-3 rounded-lg bg-moss-light/50 p-3">
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
      <button onClick={onDismiss} className="mt-3 text-xs underline opacity-60">
        Dismiss
      </button>
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
        While you were away — what happened?
      </h2>
      <div className="space-y-3">
        {pendings.map(({ habit, checkin }) => (
          <div key={checkin.id} className="rounded-xl border border-sand bg-white p-4 shadow-sm">
            <p className="font-medium">
              {habit.name} <span className="text-sm opacity-60">· {checkin.period_start}</span>
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
    <div className="rounded-xl border border-sand bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold">{habit.name}</h3>
          <p className="text-xs opacity-60">
            ${Number(habit.stake_amount).toFixed(2)} to {habit.owed_to} per miss ·{" "}
            {habit.cadence}
          </p>
        </div>
        {habit.consistency_pct !== null && (
          <div className="text-right">
            <p className="font-display text-2xl font-bold text-moss">
              {habit.consistency_pct}%
            </p>
            <p className="text-[10px] uppercase tracking-wide opacity-50">last 30 days</p>
          </div>
        )}
      </div>

      {done ? (
        <p
          className={`mt-3 inline-block rounded-full px-3 py-1 text-sm font-medium ${
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
          className="flex-1 rounded-lg bg-moss py-2.5 font-medium text-white active:scale-95 disabled:opacity-50"
        >
          Hit
        </button>
        <button
          onClick={() => submit("miss")}
          disabled={busy}
          className="flex-1 rounded-lg bg-ember py-2.5 font-medium text-white active:scale-95 disabled:opacity-50"
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
          className="mt-2 w-full rounded-lg border border-sand bg-paper p-2 text-sm"
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
