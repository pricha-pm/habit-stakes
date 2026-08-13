"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <h1 className="font-mono text-xl font-black uppercase tracking-[0.12em] text-ink/85">
        Abhy
      </h1>
      <p className="mt-1 mb-8 text-[11px] text-ink/70">Small habits. Real stakes.</p>

      {sent ? (
        <p className="max-w-xs text-center text-sm leading-relaxed text-ink/70">
          Check <strong className="text-ink">{email}</strong> for a sign-in link.
        </p>
      ) : (
        <form onSubmit={submit} className="w-full max-w-xs space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-sand bg-white p-3"
          />
          {error && (
            <p className="rounded-xl bg-ember-light px-4 py-2 text-sm text-ink">{error}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-moss py-3.5 font-semibold text-white active:scale-95 disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send magic link"}
          </button>
        </form>
      )}
    </main>
  );
}
