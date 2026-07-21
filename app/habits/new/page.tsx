"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewHabit() {
  const router = useRouter();
  const [activeCount, setActiveCount] = useState(0);
  const [name, setName] = useState("");
  const [cadence, setCadence] = useState<"daily" | "weekly">("daily");
  const [stake, setStake] = useState("5");
  const [owedTo, setOwedTo] = useState("");
  const [intention, setIntention] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/state")
      .then((r) => r.json())
      .then((d) => setActiveCount(d.habits?.length ?? 0))
      .catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/habits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        cadence,
        stake_amount: Number(stake),
        owed_to: owedTo,
        implementation_intention: intention || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      setBusy(false);
      return;
    }
    router.push("/");
  };

  return (
    <main>
      <header className="pt-8 pb-6">
        <Link href="/" className="eyebrow text-moss underline underline-offset-4">
          ← Back
        </Link>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">New habit</h1>
        <div className="mt-4 h-px bg-ink/10" />
      </header>

      {activeCount >= 3 && (
        <div className="mb-4 rounded-2xl border border-ink/10 bg-sand px-4 py-3 text-sm">
          You already have {activeCount} active habits. Research says start small —
          people who track fewer habits stick with them far longer. You can still
          add this one, but consider whether one of the others has earned its keep.
        </div>
      )}

      <form onSubmit={submit} className="space-y-5">
        <Field label="Habit">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Gym, Read 20 pages, Journal"
            required
            className="w-full rounded-xl border border-sand bg-white p-3"
          />
        </Field>

        <Field label="Cadence">
          <div className="flex gap-2">
            {(["daily", "weekly"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCadence(c)}
                className={`flex-1 rounded-full border-2 py-2.5 font-semibold capitalize ${
                  cadence === c
                    ? "border-moss bg-moss text-white"
                    : "border-sand bg-white text-ink/50"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Stake per miss ($)">
          <input
            type="number"
            min="1"
            step="1"
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            required
            className="w-full rounded-xl border border-sand bg-white p-3"
          />
        </Field>

        <Field label="Who do you owe when you miss?">
          <input
            value={owedTo}
            onChange={(e) => setOwedTo(e.target.value)}
            placeholder="A real friend's name — you'll Venmo them"
            required
            className="w-full rounded-xl border border-sand bg-white p-3"
          />
        </Field>

        <Field
          label="Implementation intention (optional)"
          hint="Anchoring a habit to an existing routine roughly doubles follow-through."
        >
          <input
            value={intention}
            onChange={(e) => setIntention(e.target.value)}
            placeholder="After I [make coffee], I will [do this habit]"
            className="w-full rounded-xl border border-sand bg-white p-3"
          />
        </Field>

        {error && (
          <p className="rounded-xl bg-ember-light px-4 py-2 text-sm text-ember">{error}</p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-moss py-3.5 font-semibold text-white active:scale-95 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Put money on it"}
        </button>
      </form>
    </main>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-1.5 block text-ink/55">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs opacity-60">{hint}</span>}
    </label>
  );
}
