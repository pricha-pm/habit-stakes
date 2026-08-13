"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDays, consistencySeries, localDateISO, TrendBucket, TrendGranularity } from "@/lib/periods";

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
  habits: { name: string } | null;
};

type RangeMode = "week" | "month" | "custom";

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

  const today = localDateISO();
  const [mode, setMode] = useState<RangeMode>("month");
  const [customFrom, setCustomFrom] = useState(() => addDays(today, -30));
  const [customTo, setCustomTo] = useState(today);

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

  const toggleSettled = async (entry: LedgerEntry) => {
    await fetch(`/api/ledger/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settled: !entry.settled }),
    });
    await load();
  };

  const { from, to, granularity } = useMemo(() => {
    if (mode === "week") {
      return { from: addDays(today, -6), to: today, granularity: "day" as TrendGranularity };
    }
    if (mode === "month") {
      return { from: addDays(today, -29), to: today, granularity: "week" as TrendGranularity };
    }
    const [f, t] = customFrom <= customTo ? [customFrom, customTo] : [customTo, customFrom];
    const spanDays = Math.round((Date.parse(t) - Date.parse(f)) / 86400000);
    return { from: f, to: t, granularity: (spanDays <= 14 ? "day" : "week") as TrendGranularity };
  }, [mode, customFrom, customTo, today]);

  const totalOutstanding = entries.filter((e) => !e.settled).reduce((s, e) => s + Number(e.amount), 0);
  const totalSettled = entries.filter((e) => e.settled).reduce((s, e) => s + Number(e.amount), 0);

  const byFriend: Record<string, { outstanding: number; settled: number }> = {};
  for (const e of entries) {
    byFriend[e.owed_to] ??= { outstanding: 0, settled: 0 };
    byFriend[e.owed_to][e.settled ? "settled" : "outstanding"] += Number(e.amount);
  }
  const friends = Object.entries(byFriend).sort(
    ([, a], [, b]) => b.outstanding + b.settled - (a.outstanding + a.settled)
  );

  return (
    <main>
      <header className="pt-8 pb-6">
        <Link href="/" className="eyebrow text-ink/70 underline underline-offset-4">
          ← Back
        </Link>
        <h1 className="mt-3 font-display text-3xl font-black">Trends</h1>
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

            {entries.length > 0 && (
              <div className="mt-5">
                <p className="eyebrow mb-2 text-ink/50">Settle up</p>
                <div className="space-y-2">
                  {entries.map((e) => (
                    <div
                      key={e.id}
                      className={`flex items-center justify-between rounded-2xl border border-ink/10 bg-white px-4 py-3 ${
                        e.settled ? "opacity-50" : ""
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium">
                          ${Number(e.amount).toFixed(2)} to {e.owed_to}
                        </p>
                        <p className="eyebrow mt-0.5 text-ink/40">
                          {e.habits?.name} · {e.created_at.slice(0, 10)}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleSettled(e)}
                        className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                          e.settled ? "bg-sand" : "bg-moss text-white"
                        }`}
                      >
                        {e.settled ? "Settled ✓" : "Mark settled"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-lg font-semibold">Consistency</h2>
              <div className="flex gap-1.5">
                {(["week", "month", "custom"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                      mode === m ? "bg-moss text-white" : "border border-sand bg-white text-ink/55"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {mode === "custom" && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customFrom}
                  max={today}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-lg border border-sand bg-white px-2 py-1.5 text-xs"
                />
                <span className="text-xs text-ink/40">to</span>
                <input
                  type="date"
                  value={customTo}
                  max={today}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-lg border border-sand bg-white px-2 py-1.5 text-xs"
                />
              </div>
            )}

            <TrendBars
              title="All habits combined"
              granularity={granularity}
              series={consistencySeries(checkins, from, to, granularity)}
            />

            {habits.map((h) => (
              <TrendBars
                key={h.id}
                title={h.name}
                granularity={granularity}
                series={consistencySeries(
                  checkins.filter((c) => c.habit_id === h.id),
                  from,
                  to,
                  granularity
                )}
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

function TrendBars({
  title,
  series,
  granularity,
}: {
  title: string;
  series: TrendBucket[];
  granularity: TrendGranularity;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const current = series[series.length - 1];
  const detail = selected !== null ? series[selected] : null;

  if (series.length === 0) {
    return (
      <div className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-ink/50">No data in this range.</p>
      </div>
    );
  }

  const bucketLabel = (b: TrendBucket) =>
    granularity === "day" ? shortDate(b.bucketStart) : `Week of ${shortDate(b.bucketStart)}`;

  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        <p className="font-display text-2xl font-bold text-moss">
          {current?.pct !== null && current?.pct !== undefined ? `${current.pct}%` : "—"}
        </p>
      </div>

      <div
        className="mt-3 grid h-14 gap-[2px]"
        style={{ gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))` }}
      >
        {series.map((b, i) => {
          const hasData = b.hits + b.misses > 0;
          const barHeight = hasData ? Math.max(b.pct ?? 0, 4) : 0;
          const isCurrent = i === series.length - 1;
          return (
            <button
              key={b.bucketStart}
              type="button"
              onClick={() => setSelected(i === selected ? null : i)}
              className="flex flex-col justify-end"
              aria-label={`${bucketLabel(b)}: ${hasData ? `${b.pct}% (${b.hits}/${b.hits + b.misses})` : "no data"}`}
            >
              {hasData ? (
                <div
                  className={`w-full rounded-t ${isCurrent ? "bg-moss" : "bg-moss/55"}`}
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
          ? `${bucketLabel(detail)} · ${
              detail.hits + detail.misses > 0
                ? `${detail.hits}/${detail.hits + detail.misses} hits (${detail.pct}%)`
                : "no data"
            }`
          : `${shortDate(series[0].bucketStart)} – ${shortDate(current.bucketStart)}`}
      </p>
    </div>
  );
}
