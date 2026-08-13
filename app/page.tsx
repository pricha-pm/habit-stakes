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
  stake_amount: number | null;
  owed_to: string | null;
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

  const deleteHabit = async (habitId: string) => {
    setError(null);
    const res = await fetch(`/api/habits/${habitId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
      return;
    }
    await load();
  };

  const totalOwedEntries = Object.entries(owedTotals).filter(([, amt]) => amt > 0);

  return (
    <main>
      <header className="hero -mx-4 px-4 pt-8 pb-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-mono text-xl font-black uppercase tracking-[0.12em] text-ink/85">
              Abhy
            </h1>
            <p className="mt-1 text-[11px] text-ink/70">Small habits. Real stakes.</p>
          </div>
          <div className="flex gap-4 pt-0.5">
            <Link href="/info" className="eyebrow text-ink/70 underline underline-offset-4">
              Info
            </Link>
            <Link href="/trends" className="eyebrow text-ink/70 underline underline-offset-4">
              Trends
            </Link>
          </div>
        </div>

        {totalOwedEntries.length > 0 && (
          <div className="mt-6 space-y-3">
            {totalOwedEntries.map(([friend, amount]) => (
              <div key={friend}>
                <p className="eyebrow text-ink/60">You owe</p>
                <p className="font-display text-2xl font-bold text-ink">
                  {friend} — ${amount.toFixed(2)}
                </p>
              </div>
            ))}
            <Link href="/trends" className="eyebrow inline-block text-ink/70 underline underline-offset-4">
              Settle up
            </Link>
          </div>
        )}
      </header>

      <div className="pt-6">
        {result && <MissResult result={result} onDismiss={() => setResult(null)} />}
      {error && (
        <div className="mb-4 rounded-xl bg-ember-light px-4 py-2 text-sm text-ink">{error}</div>
      )}

      {habits === null ? (
        <p className="py-12 text-center text-sm opacity-60">Loading…</p>
      ) : (
        <>
          <PendingSection habits={habits} onCheckIn={checkIn} />

          <section className="space-y-4">
            {habits.map((h) => (
              <HabitCard key={h.id} habit={h} onCheckIn={checkIn} onDelete={deleteHabit} />
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
      </div>
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
        <div className="bg-ember px-4 py-4 text-ink">
          <p className="eyebrow text-ink/70">New balance</p>
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
  onDelete,
}: {
  habit: Habit;
  onCheckIn: (habitId: string, periodStart: string, status: "hit" | "miss", note: string) => void;
  onDelete: (habitId: string) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const done = habit.current_checkin && habit.current_checkin.status !== "pending";
  const periodLabel = habit.cadence === "daily" ? "today" : "this week";

  const confirmDelete = async () => {
    setDeleting(true);
    await onDelete(habit.id);
  };

  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-semibold">{habit.name}</h3>
          <p className="eyebrow mt-1 text-ink/45">
            {habit.stake_amount != null && habit.owed_to
              ? `$${Number(habit.stake_amount).toFixed(2)} to ${habit.owed_to} per miss · ${habit.cadence}`
              : `No stake · ${habit.cadence}`}
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
              : "bg-ember-light text-ink"
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

      {confirming ? (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-ember-light px-3 py-2">
          <span className="text-xs text-ink">Delete {habit.name}? This can&apos;t be undone.</span>
          <div className="flex shrink-0 gap-3 pl-3">
            <button
              onClick={confirmDelete}
              disabled={deleting}
              className="text-xs font-semibold text-ink underline disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Yes, delete"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className="text-xs text-ink/60 underline disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex justify-end">
          <button
            onClick={() => setConfirming(true)}
            aria-label="Delete habit"
            className="-m-2 rounded-full p-2 text-ink/35 active:text-ink/60"
          >
            <TrashIcon />
          </button>
        </div>
      )}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
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
          className="flex-1 rounded-full bg-ember py-2.5 font-semibold text-ink active:scale-95 disabled:opacity-50"
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
