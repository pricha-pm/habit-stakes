"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Entry = {
  id: string;
  amount: number;
  owed_to: string;
  settled: boolean;
  created_at: string;
  habits: { name: string } | null;
};

export default function Ledger() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ledger");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEntries(data.entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (entry: Entry) => {
    await fetch(`/api/ledger/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settled: !entry.settled }),
    });
    await load();
  };

  const unsettledByFriend: Record<string, number> = {};
  for (const e of entries ?? []) {
    if (!e.settled) {
      unsettledByFriend[e.owed_to] = (unsettledByFriend[e.owed_to] || 0) + Number(e.amount);
    }
  }
  const friends = Object.entries(unsettledByFriend);

  return (
    <main>
      <header className="pt-8 pb-6">
        <Link href="/" className="text-sm text-moss underline underline-offset-4">
          ← Back
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold">Ledger</h1>
      </header>

      {error && (
        <p className="mb-4 rounded-lg bg-ember-light px-4 py-2 text-sm text-ember">{error}</p>
      )}

      {friends.length > 0 ? (
        <div className="mb-6 space-y-2">
          {friends.map(([friend, total]) => (
            <div key={friend} className="rounded-xl bg-ember-light px-4 py-3">
              <p className="font-display text-xl">
                You owe <span className="font-bold text-ember">{friend}</span>{" "}
                <span className="font-bold text-ember">${total.toFixed(2)}</span>
              </p>
              <p className="text-xs opacity-60">Settle via Venmo, then mark entries below.</p>
            </div>
          ))}
        </div>
      ) : (
        entries !== null && (
          <p className="mb-6 rounded-xl bg-moss-light px-4 py-3 text-sm text-moss">
            All settled up. Nothing owed.
          </p>
        )
      )}

      <div className="space-y-2">
        {(entries ?? []).map((e) => (
          <div
            key={e.id}
            className={`flex items-center justify-between rounded-lg border border-sand bg-white px-4 py-3 ${
              e.settled ? "opacity-50" : ""
            }`}
          >
            <div>
              <p className="text-sm font-medium">
                ${Number(e.amount).toFixed(2)} to {e.owed_to}
              </p>
              <p className="text-xs opacity-60">
                {e.habits?.name} · {e.created_at.slice(0, 10)}
              </p>
            </div>
            <button
              onClick={() => toggle(e)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                e.settled ? "bg-sand" : "bg-moss text-white"
              }`}
            >
              {e.settled ? "Settled ✓" : "Mark settled"}
            </button>
          </div>
        ))}
      </div>

      {entries !== null && entries.length === 0 && (
        <p className="py-12 text-center text-sm opacity-60">
          No misses yet. The ledger fills itself.
        </p>
      )}
    </main>
  );
}
