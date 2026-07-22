"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TREND_WEEKS, weeklyConsistencySeries } from "@/lib/periods";

type TrendCheckin = { habit_id: string; period_start: string; status: string };
type TrendHabit = {
  id: string;
  name: string;
  cadence: "daily" | "weekly";
  stake_amount: number;
  owed_to: string;
};
type LedgerEntry = {
  id: string;
  amount: number;
  owed_to: string;
  settled: boolean;
  created_at: string;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function shortDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${MONTHS[Number(m) - 1]} ${Number(d)}`;
}

export default function Trends() {
  const [habits, setHabits] = useState<TrendHabit[] | null>(null);
  const [checkins, setCheckins] = useState<TrendCheckin[]>([]);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [trendsRes, ledgerRes] = await Promise.all([
        fetch("/api/trends"),
        fetch("/api/ledger"),
      ]);
      const trendsData = await trendsRes.json();
      const ledgerData = await ledgerRes.json();
      if (!trendsRes.ok) throw new Error(trendsData.error);
      if (!ledgerRes.ok) throw new Error(ledgerData.error);
      setHabits(trendsData.habits);
      setCheckins(trendsData.checkins);
      setEntries(ledgerData.entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalOutstanding = entries.filter((e) => !e.settled).reduce((s, e) => s + Number(e.amount), 0);
  const totalSettled = entries.filter((e) => e.settled).reduce((s, e) => s + Number(e.amount), 0);

  const byFriend: Record<string, { outstanding: number; settled: number }> = {};
  for (const e of entries) {
    byFriend[e.owed_to] ??= { outstanding: 0, settled: 0 };
    byFriend[e.owed_to][e.settled ? "settled" : "outstanding"] += Number(e.amount);
  }
  const friends = Object.entries(byFriend).sort(([, a], [, b]) => b.outstanding + b.settled - (a.outstanding + a.settled));

  return (
    <main>
      <header className="pt-8 pb-6">
        <Link href="/" className="eyebrow text-moss underline underline-offset-4">
          ← Back
        </Link>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">Trends</h1>
        <div className="mt-4 h-px bg-ink/10" />
      </header>

      {error && (
        <p className="mb-4 rounded-xl bg-ember-light px-4 py-2 text-sm text-ink">{error}</p>
      )}

      {habits === null ? (
        <p className="py-12 text-center text-sm opacity-60">Loading…</p>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="mb-3 font-display text-lg font-semibold">Money</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-ink/10 bg-white p-4">
                <p className="eyebrow flex items-center gap-1.5 text-ink/50">
                  <span className="h-2 w-2 rounded-full bg-ember" /> Outstanding
                </p>
                <p className="mt-1 font-display text-2xl font-bold">${totalOutstanding.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl border border-ink/10 bg-white p-4">
                <p className="eyebrow flex items-center gap-1.5 text-ink/50">
                  <span className="h-2 w-2 rounded-full bg-moss" /> Settled
                </p>
                <p className="mt-1 font-display text-2xl font-bold">${totalSettled.toFixed(2)}</p>
              </div>
            </div>

            {friends.length > 0 && (
              <div className="mt-3 space-y-3">
                {friends.map(([friend, { outstanding, settled }]) => (
                  <FriendBar key={friend} friend={friend} outstanding={outstanding} settled={settled} />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-lg font-semibold">Consistency</h2>

            <WeeklyBars
              title="All habits combined"
              series={weeklyConsistencySeries(checkins)}
            />

            {habits.map((h) => (
              <WeeklyBars
                key={h.id}
                title={h.name}
                series={weeklyConsistencySeries(checkins.filter((c) => c.habit_id === h.id))}
              />
            ))}

            {habits.length === 0 && (
              <p className="py-8 text-center text-sm opacity-60">No habits yet.</p>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function FriendBar({
  friend,
  outstanding,
  settled,
}: {
  friend: string;
  outstanding: number;
  settled: number;
}) {
  const total = outstanding + settled;
  const outPct = total === 0 ? 0 : (outstanding / total) * 100;
  const setPct = total === 0 ? 0 : (settled / total) * 100;

  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-lg font-semibold">{friend}</p>
        <p className="eyebrow text-ink/40">${total.toFixed(2)} total</p>
      </div>
      <div className="mt-3 flex h-6 gap-[2px] overflow-hidden rounded-full bg-sand">
        {outstanding > 0 && (
          <div
            className="flex items-center justify-center bg-ember text-[11px] font-semibold text-ink"
            style={{ width: `${outPct}%` }}
          >
            {outPct > 18 ? `$${outstanding.toFixed(0)}` : ""}
          </div>
        )}
        {settled > 0 && (
          <div
            className="flex items-center justify-center bg-moss text-[11px] font-semibold text-white"
            style={{ width: `${setPct}%` }}
          >
            {setPct > 18 ? `$${settled.toFixed(0)}` : ""}
          </div>
        )}
      </div>
      <div className="mt-2 flex gap-4 text-xs text-ink/60">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-ember" /> Outstanding ${outstanding.toFixed(2)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-moss" /> Settled ${settled.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

function WeeklyBars({
  title,
  series,
}: {
  title: string;
  series: ReturnType<typeof weeklyConsistencySeries>;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const current = series[series.length - 1];
  const detail = selected !== null ? series[selected] : null;

  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        <p className="font-display text-2xl font-bold text-moss">
          {current?.pct !== null && current?.pct !== undefined ? `${current.pct}%` : "—"}
        </p>
      </div>

      <div className="mt-3 grid h-14 grid-cols-12 gap-[2px]">
        {series.map((w, i) => {
          const hasData = w.hits + w.misses > 0;
          const barHeight = hasData ? Math.max(w.pct ?? 0, 4) : 0;
          const isCurrent = i === series.length - 1;
          return (
            <button
              key={w.weekStart}
              type="button"
              onClick={() => setSelected(i === selected ? null : i)}
              className="flex flex-col justify-end"
              aria-label={`Week of ${w.weekStart}: ${hasData ? `${w.pct}% (${w.hits}/${w.hits + w.misses})` : "no data"}`}
            >
              {hasData ? (
                <div
                  className={`mx-auto w-4 rounded-t ${isCurrent ? "bg-moss" : "bg-moss/55"}`}
                  style={{ height: `${barHeight}%` }}
                />
              ) : (
                <div className="mx-auto h-[2px] w-[2px] rounded-full bg-ink/15" />
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 h-px bg-ink/10" />
      <p className="eyebrow mt-1.5 text-ink/40">
        {detail
          ? `Week of ${shortDate(detail.weekStart)} · ${
              detail.hits + detail.misses > 0
                ? `${detail.hits}/${detail.hits + detail.misses} hits (${detail.pct}%)`
                : "no data"
            }`
          : `${TREND_WEEKS} weeks · ${shortDate(series[0].weekStart)} – ${shortDate(current.weekStart)}`}
      </p>
    </div>
  );
}
