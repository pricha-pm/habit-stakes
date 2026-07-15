// Cadence period math. All periods are identified by their start date as a
// YYYY-MM-DD string in the app timezone (single user, so one timezone).
// Daily periods start every day; weekly periods start on Mondays.

export type Cadence = "daily" | "weekly";

const APP_TZ = process.env.APP_TIMEZONE || "America/Los_Angeles";

/** YYYY-MM-DD for the given instant in the app timezone. */
export function localDateISO(now: Date = new Date(), tz: string = APP_TZ): string {
  // en-CA locale formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** Monday of the week containing dateISO. */
export function weekStartISO(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (dow + 6) % 7;
  return addDays(dateISO, -daysSinceMonday);
}

export function periodStartFor(cadence: Cadence, dateISO: string): string {
  return cadence === "daily" ? dateISO : weekStartISO(dateISO);
}

export function currentPeriodStart(
  cadence: Cadence,
  now: Date = new Date(),
  tz: string = APP_TZ
): string {
  return periodStartFor(cadence, localDateISO(now, tz));
}

export function nextPeriodStart(cadence: Cadence, periodStart: string): string {
  return addDays(periodStart, cadence === "daily" ? 1 : 7);
}

/**
 * All period starts for a habit that have fully ended (lapsed) as of `now`:
 * from the period containing the habit's creation date up to, but not
 * including, the current (still-open, grace) period. The cron marks any of
 * these without a check-in as pending. Returning the complete list — not
 * just yesterday's — is what makes the cron self-healing: a skipped run is
 * recovered by the next one.
 */
export function lapsedPeriodStarts(
  cadence: Cadence,
  habitCreatedAtISO: string,
  now: Date = new Date(),
  tz: string = APP_TZ
): string[] {
  const current = currentPeriodStart(cadence, now, tz);
  let cursor = periodStartFor(cadence, habitCreatedAtISO);
  const out: string[] = [];
  while (cursor < current) {
    out.push(cursor);
    cursor = nextPeriodStart(cadence, cursor);
  }
  return out;
}

/**
 * Rolling 30-day consistency %: hits / resolved periods in the window.
 * Pending periods are excluded (not yet the user's fault or credit).
 * Returns null when there are no resolved periods yet.
 */
export function consistencyPct(
  checkins: { period_start: string; status: string }[],
  now: Date = new Date(),
  tz: string = APP_TZ
): number | null {
  const cutoff = addDays(localDateISO(now, tz), -30);
  const resolved = checkins.filter(
    (c) => c.period_start >= cutoff && (c.status === "hit" || c.status === "miss")
  );
  if (resolved.length === 0) return null;
  const hits = resolved.filter((c) => c.status === "hit").length;
  return Math.round((hits / resolved.length) * 100);
}
