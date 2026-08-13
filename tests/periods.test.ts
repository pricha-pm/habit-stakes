import { describe, expect, it } from "vitest";
import {
  addDays,
  consistencyPct,
  consistencySeries,
  currentPeriodStart,
  lapsedPeriodStarts,
  localDateISO,
  nextPeriodStart,
  weekStartISO,
} from "../lib/periods";

// 2026-07-08T12:00:00-07:00 (a Wednesday in PT)
const NOW = new Date("2026-07-08T19:00:00Z");
const TZ = "America/Los_Angeles";

describe("localDateISO", () => {
  it("uses the app timezone, not UTC", () => {
    // 2026-07-09T02:00Z is still July 8 in PT
    expect(localDateISO(new Date("2026-07-09T02:00:00Z"), TZ)).toBe("2026-07-08");
  });
});

describe("weekStartISO", () => {
  it("returns Monday for a mid-week date", () => {
    expect(weekStartISO("2026-07-08")).toBe("2026-07-06"); // Wed -> Mon
  });
  it("returns the same day for a Monday", () => {
    expect(weekStartISO("2026-07-06")).toBe("2026-07-06");
  });
  it("returns previous Monday for a Sunday", () => {
    expect(weekStartISO("2026-07-12")).toBe("2026-07-06");
  });
});

describe("nextPeriodStart", () => {
  it("advances a day for daily", () => {
    expect(nextPeriodStart("daily", "2026-07-08")).toBe("2026-07-09");
  });
  it("advances a week for weekly", () => {
    expect(nextPeriodStart("weekly", "2026-07-06")).toBe("2026-07-13");
  });
});

describe("lapsedPeriodStarts (cron self-healing)", () => {
  it("returns ALL lapsed periods, not just yesterday — a skipped run heals", () => {
    // habit created Jul 4, now Jul 8: Jul 4,5,6,7 lapsed; Jul 8 still open
    expect(lapsedPeriodStarts("daily", "2026-07-04", NOW, TZ)).toEqual([
      "2026-07-04",
      "2026-07-05",
      "2026-07-06",
      "2026-07-07",
    ]);
  });

  it("excludes the current (grace) period", () => {
    expect(lapsedPeriodStarts("daily", "2026-07-04", NOW, TZ)).not.toContain("2026-07-08");
  });

  it("returns empty for a habit created today", () => {
    expect(lapsedPeriodStarts("daily", "2026-07-08", NOW, TZ)).toEqual([]);
  });

  it("weekly: current week is open, prior weeks lapsed", () => {
    // created Mon Jun 22; now Wed Jul 8 (week of Jul 6 is current)
    expect(lapsedPeriodStarts("weekly", "2026-06-22", NOW, TZ)).toEqual([
      "2026-06-22",
      "2026-06-29",
    ]);
  });

  it("weekly: creation mid-week aligns to that week's Monday", () => {
    expect(lapsedPeriodStarts("weekly", "2026-06-24", NOW, TZ)[0]).toBe("2026-06-22");
  });

  it("is deterministic — running twice yields the same list (idempotent input)", () => {
    const a = lapsedPeriodStarts("daily", "2026-07-01", NOW, TZ);
    const b = lapsedPeriodStarts("daily", "2026-07-01", NOW, TZ);
    expect(a).toEqual(b);
  });
});

describe("currentPeriodStart", () => {
  it("daily is today in app tz", () => {
    expect(currentPeriodStart("daily", NOW, TZ)).toBe("2026-07-08");
  });
  it("weekly is this Monday", () => {
    expect(currentPeriodStart("weekly", NOW, TZ)).toBe("2026-07-06");
  });
});

describe("consistencyPct (no streak resets)", () => {
  const day = (offset: number) => addDays(localDateISO(NOW, TZ), offset);

  it("one miss changes the % marginally, never wipes progress", () => {
    const checkins = Array.from({ length: 29 }, (_, i) => ({
      period_start: day(-i - 1),
      status: "hit",
    }));
    const before = consistencyPct(checkins, NOW, TZ);
    checkins.push({ period_start: day(0), status: "miss" });
    const after = consistencyPct(checkins, NOW, TZ);
    expect(before).toBe(100);
    expect(after).toBe(97); // 29/30 — a dent, not a reset to zero
  });

  it("excludes pending periods from the denominator", () => {
    const checkins = [
      { period_start: day(-1), status: "hit" },
      { period_start: day(-2), status: "pending" },
    ];
    expect(consistencyPct(checkins, NOW, TZ)).toBe(100);
  });

  it("ignores checkins outside the 30-day window", () => {
    const checkins = [
      { period_start: day(-40), status: "miss" },
      { period_start: day(-1), status: "hit" },
    ];
    expect(consistencyPct(checkins, NOW, TZ)).toBe(100);
  });

  it("returns null with no resolved periods", () => {
    expect(consistencyPct([], NOW, TZ)).toBeNull();
  });
});

describe("consistencySeries (flexible trend chart data)", () => {
  it("day granularity: one bucket per day, inclusive of both ends", () => {
    const checkins = [
      { period_start: "2026-07-06", status: "hit" },
      { period_start: "2026-07-07", status: "miss" },
      { period_start: "2026-07-08", status: "hit" },
    ];
    const series = consistencySeries(checkins, "2026-07-06", "2026-07-08", "day");
    expect(series.map((b) => b.bucketStart)).toEqual([
      "2026-07-06",
      "2026-07-07",
      "2026-07-08",
    ]);
    expect(series[0]).toMatchObject({ hits: 1, misses: 0, pct: 100 });
    expect(series[1]).toMatchObject({ hits: 0, misses: 1, pct: 0 });
  });

  it("week granularity: Monday-aligned buckets spanning the range", () => {
    // range Jul 8 (Wed) to Jul 15 (Wed) spans the weeks of Jul 6 and Jul 13
    const series = consistencySeries([], "2026-07-08", "2026-07-15", "week");
    expect(series.map((b) => b.bucketStart)).toEqual(["2026-07-06", "2026-07-13"]);
  });

  it("returns pct: null (not 0) for a bucket with zero resolved check-ins", () => {
    const series = consistencySeries([], "2026-07-06", "2026-07-08", "day");
    expect(series.every((b) => b.pct === null)).toBe(true);
  });

  it("excludes pending status from the ratio", () => {
    const checkins = [
      { period_start: "2026-07-06", status: "hit" },
      { period_start: "2026-07-06", status: "pending" },
    ];
    const series = consistencySeries(checkins, "2026-07-06", "2026-07-06", "day");
    expect(series[0].hits).toBe(1);
    expect(series[0].misses).toBe(0);
    expect(series[0].pct).toBe(100);
  });

  it("a single-day range produces exactly one bucket", () => {
    const series = consistencySeries([], "2026-07-08", "2026-07-08", "day");
    expect(series).toHaveLength(1);
  });
});
