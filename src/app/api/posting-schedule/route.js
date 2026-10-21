import { NextResponse } from "next/server";

// Save as: app/api/posting-schedule/route.js

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const LABELS = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

// Used only in week 1, when there is no data yet. A general starting guess, not a rule.
const STARTER_ORDER = ["tue", "thu", "sat", "wed", "sun", "fri", "mon"];

const RECENCY_DECAY = 0.9; // older weeks still count, just a little less
const EXPLORE_FACTOR = 0.35; // how strongly to re-test days with few samples
const MAX_WEEKS = 520;

const num = (v) =>
  v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v);
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

function buildSuggestion(weeks, postsPerWeek) {
  // Only weeks where at least one day has a number count as data
  const recorded = weeks.filter((w) => DAYS.some((d) => w.views[d] !== null));

  if (recorded.length === 0) {
    const picks = STARTER_ORDER.slice(0, postsPerWeek);
    return {
      mode: "starter",
      weeksUsed: 0,
      suggestions: picks.map((d) => ({
        day: d,
        label: LABELS[d],
        avg: null,
        samples: 0,
        reason:
          "Starter suggestion based on general social media patterns. It becomes personal once you enter your views.",
      })),
      days: DAYS.map((d) => ({
        day: d,
        label: LABELS[d],
        avg: null,
        samples: 0,
        suggested: picks.includes(d),
      })),
    };
  }

  const latestWeek = Math.max(...recorded.map((w) => w.week));

  // Weighted average views per day across ALL recorded weeks
  const stats = DAYS.map((d) => {
    let sumW = 0;
    let sumWV = 0;
    let n = 0;
    for (const w of recorded) {
      const v = w.views[d];
      if (v === null) continue;
      const weight = Math.pow(RECENCY_DECAY, latestWeek - w.week);
      sumW += weight;
      sumWV += weight * v;
      n += 1;
    }
    return { day: d, n, avg: n > 0 ? sumWV / sumW : null };
  });

  const tested = stats.filter((s) => s.n > 0);
  const overallAvg = tested.reduce((s, x) => s + x.avg, 0) / tested.length;
  const totalWeeks = recorded.length;

  // Days never posted on get tried first. Others: average + a bonus that shrinks as samples grow.
  const scored = stats.map((s) => {
    const score =
      s.n === 0
        ? Number.POSITIVE_INFINITY
        : s.avg + overallAvg * EXPLORE_FACTOR * Math.sqrt(Math.log(totalWeeks + 1) / s.n);
    return { ...s, score };
  });

  scored.sort((a, b) => {
    if (a.score === b.score) return STARTER_ORDER.indexOf(a.day) - STARTER_ORDER.indexOf(b.day);
    return b.score > a.score ? 1 : -1;
  });

  const picks = scored.slice(0, postsPerWeek);

  // Which tested days have the best plain average? Used to explain the reason.
  const provenTop = new Set(
    [...tested]
      .sort((a, b) => b.avg - a.avg)
      .slice(0, postsPerWeek)
      .map((s) => s.day)
  );

  const suggestions = picks.map((s) => {
    let reason;
    if (s.n === 0) {
      reason = "Not tested yet. Posting here will show how it performs.";
    } else if (provenTop.has(s.day)) {
      reason = `Strong performer: about ${Math.round(s.avg).toLocaleString("en-MY")} views on average over ${s.n} week${s.n > 1 ? "s" : ""}.`;
    } else {
      reason = `Only tested ${s.n} time${s.n > 1 ? "s" : ""} (about ${Math.round(s.avg).toLocaleString("en-MY")} views). Worth another try before ruling it out.`;
    }
    return {
      day: s.day,
      label: LABELS[s.day],
      avg: s.avg === null ? null : Math.round(s.avg),
      samples: s.n,
      reason,
    };
  });

  const pickSet = new Set(picks.map((p) => p.day));

  return {
    mode: "learned",
    weeksUsed: totalWeeks,
    suggestions,
    days: stats.map((s) => ({
      day: s.day,
      label: LABELS[s.day],
      avg: s.avg === null ? null : Math.round(s.avg),
      samples: s.n,
      suggested: pickSet.has(s.day),
    })),
  };
}

export async function POST(req) {
  try {
    const body = await req.json();

    const postsPerWeek = clamp(Math.round(num(body.postsPerWeek) ?? 3), 1, 7);
    const rawWeeks = Array.isArray(body.weeks) ? body.weeks.slice(0, MAX_WEEKS) : [];

    const weeks = rawWeeks.map((w, idx) => {
      const views = {};
      for (const d of DAYS) {
        const v = num(w?.views?.[d]);
        views[d] = v === null ? null : clamp(Math.round(v), 0, 1_000_000_000);
      }
      return { week: Math.round(num(w?.week) ?? idx + 1), views };
    });

    return NextResponse.json(buildSuggestion(weeks, postsPerWeek));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}