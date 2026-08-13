import Link from "next/link";

const PRINCIPLES = [
  {
    title: "No streaks — a rolling 30-day consistency %",
    body: "Lally et al. (2010, UCL) found a single missed day doesn't materially derail habit formation. Streak-reset UI triggers the “abstinence violation effect” (Marlatt & Gordon) — one slip reads as total failure and predicts abandonment.",
  },
  {
    title: "Real money, owed to a real friend",
    body: "Deposit-contract research shows loss aversion: losses feel roughly twice as intense as equivalent gains. Naming a real friend stacks social accountability on top — reporting progress to a specific person roughly doubles goal-attainment odds versus tracking privately.",
  },
  {
    title: "Implementation intentions",
    body: "“After I [existing routine], I will [habit]”. Gollwitzer & Sheeran's meta-analysis of 94 studies found if-then plans have a medium-to-large effect (d = .65) on goal attainment by anchoring the habit to a cue you already have.",
  },
  {
    title: "Grounded nudges, or none at all",
    body: "A nudge only appears when it can reference a specific past check-in of yours above a similarity floor — self-compassionate, pattern-observing, never scolding. Below that floor, Abhy stays silent rather than send empty encouragement, which just teaches you to ignore it.",
  },
  {
    title: "Fresh-start framing after a miss",
    body: "Dai, Milkman & Riis found people are more likely to pursue goals right after a temporal landmark. Recovery nudges lean on “new week starts Monday — that's the one that counts” instead of dwelling on the slip.",
  },
  {
    title: "Soft cap of 3 active habits",
    body: "Setup friction — tracking too many habits at once — is the single biggest predictor of tracker abandonment. The research favors starting small over starting ambitious.",
  },
  {
    title: "No push notifications",
    body: "Six or more pushes a week from one app makes a user about 3.4× more likely to uninstall within 30 days. Abhy is a check-in-when-you-open-it tool, on purpose.",
  },
];

export default function Info() {
  return (
    <main>
      <header className="pt-8 pb-6">
        <Link href="/" className="eyebrow text-ink/70 underline underline-offset-4">
          ← Back
        </Link>
        <h1 className="mt-3 font-display text-3xl font-black">Info</h1>
        <div className="mt-4 h-px bg-ink/10" />
      </header>

      <p className="text-[15px] leading-relaxed text-ink/80">
        Abhy is a habit tracker where missing costs you real money, owed to a real friend, and
        slipping up gets you a coaching nudge grounded in your own past check-ins — never generic
        motivation. Every design choice below is backed by specific research, not a gut feeling
        about what makes habits stick.
      </p>

      <section className="mt-6 space-y-3">
        {PRINCIPLES.map((p) => (
          <div key={p.title} className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
            <h2 className="font-display text-base font-bold">{p.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink/70">{p.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
