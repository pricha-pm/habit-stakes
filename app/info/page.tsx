import Link from "next/link";
import SignOutButton from "./SignOutButton";

const PRINCIPLES = [
  {
    title: "No streaks — a rolling 30-day %",
    body: "One missed day doesn't derail habit formation (Lally et al., 2010) — but a broken streak feels like total failure. Abhy never resets to zero.",
  },
  {
    title: "Real money, owed to a real friend",
    body: "Losses hurt about twice as much as equivalent gains, and naming someone specific roughly doubles follow-through (deposit-contract research). Abhy stacks both.",
  },
  {
    title: "Implementation intentions",
    body: "“After I [routine], I will [habit]” plans carry a d = .65 effect on follow-through (Gollwitzer & Sheeran) — anchor the habit to a cue you already have.",
  },
  {
    title: "Grounded nudges, or silence",
    body: "Nudges only fire when they can reference a real past check-in of yours. No match, no nudge — never generic encouragement.",
  },
  {
    title: "Fresh-start framing",
    body: "People act on goals right after a fresh start — a new week, a new month (Dai & Milkman). Recovery nudges lean on that, not guilt.",
  },
  {
    title: "Soft cap of 3 habits",
    body: "Tracking too many habits at once is the top predictor of quitting. Start small, on purpose.",
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

      <blockquote className="border-l-2 border-ember pl-4">
        <p className="font-display text-xl italic leading-snug">
          &ldquo;We are what we repeatedly do. Excellence, then, is not an act, but a habit.&rdquo;
        </p>
        <footer className="eyebrow mt-2 text-ink/50">— Aristotle</footer>
      </blockquote>

      <p className="mt-6 text-[15px] leading-relaxed text-ink/80">
        In a world with less friction than ever and more distractions pulling at your attention,
        discipline and accountability are becoming the real differentiators — in lifestyle and in
        success. Meet <strong>Abhy</strong>, short for <em>Abhyasa</em> (Kannada for habit): your
        accountability community, and a habit tracker built on neuroscience.
      </p>

      <p className="eyebrow mt-8 text-ink/50">The science</p>

      <section className="mt-3 space-y-3">
        {PRINCIPLES.map((p) => (
          <div key={p.title} className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
            <h2 className="font-display text-base font-bold">{p.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink/70">{p.body}</p>
          </div>
        ))}
      </section>

      <div className="mt-8 border-t border-ink/10 pt-6">
        <SignOutButton />
      </div>
    </main>
  );
}
