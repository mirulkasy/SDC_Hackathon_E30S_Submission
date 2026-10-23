import { NextResponse } from "next/server";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_INDEX = Object.fromEntries(DAYS.map((d, i) => [d, i]));
const LABELS = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

// Week 1 only, when there is no data yet. A general starting guess, not a rule.
const STARTER_ORDER = ["tue", "thu", "sat", "wed", "sun", "fri", "mon"];

const RECENCY_DECAY = 0.9;
const EXPLORE_FACTOR = 0.35;
const MAX_WEEKS = 520;

const num = (v) =>
  v === null || v === undefined || v === "" || Number.isNaN(Number(v))
    ? null
    : Number(v);
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);
const confidence = (n) =>
  n === 0 ? "untested" : n === 1 ? "low" : n === 2 ? "medium" : "high";

function buildSuggestion(weeks, postsPerWeek, { today, done }) {
  const doneSet = new Set(done);
  const slots = Math.max(0, postsPerWeek - doneSet.size);
  const fromIdx = today ? DAY_INDEX[today] : 0;
  const open = (d) => !doneSet.has(d) && DAY_INDEX[d] >= fromIdx;

  const recorded = weeks.filter((w) => DAYS.some((d) => w.views[d] !== null));

  if (recorded.length === 0) {
    const picks = STARTER_ORDER.filter(open).slice(0, slots);
    return {
      mode: "starter",
      weeksUsed: 0,
      suggestions: picks.map((d) => ({
        day: d,
        label: LABELS[d],
        avg: null,
        samples: 0,
        confidence: "untested",
        reason:
          "Starter suggestion based on general social media patterns. It becomes personal once you log your views.",
      })),
      days: DAYS.map((d) => ({
        day: d,
        label: LABELS[d],
        avg: null,
        samples: 0,
        confidence: "untested",
        suggested: picks.includes(d) || doneSet.has(d),
      })),
    };
  }

  const latestWeek = Math.max(...recorded.map((w) => w.week));

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

  const scored = stats.map((s) => ({
    ...s,
    score:
      s.n === 0
        ? Number.POSITIVE_INFINITY
        : s.avg +
          overallAvg *
            EXPLORE_FACTOR *
            Math.sqrt(Math.log(totalWeeks + 1) / s.n),
  }));

  scored.sort((a, b) => {
    if (a.score === b.score)
      return STARTER_ORDER.indexOf(a.day) - STARTER_ORDER.indexOf(b.day);
    return b.score > a.score ? 1 : -1;
  });

  // Only days that are still ahead and not already posted
  const picks = scored.filter((s) => open(s.day)).slice(0, slots);

  const provenTop = new Set(
    [...tested]
      .sort((a, b) => b.avg - a.avg)
      .slice(0, postsPerWeek)
      .map((s) => s.day),
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
      confidence: confidence(s.n),
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
      confidence: confidence(s.n),
      suggested: pickSet.has(s.day) || doneSet.has(s.day),
    })),
  };
}

export async function POST(req) {
  try {
    const body = await req.json();

    const postsPerWeek = clamp(Math.round(num(body.postsPerWeek) ?? 3), 1, 7);
    const rawWeeks = Array.isArray(body.weeks)
      ? body.weeks.slice(0, MAX_WEEKS)
      : [];

    const weeks = rawWeeks.map((w, idx) => {
      const views = {};
      for (const d of DAYS) {
        const v = num(w?.views?.[d]);
        views[d] = v === null ? null : clamp(Math.round(v), 0, 1_000_000_000);
      }
      return { week: Math.round(num(w?.week) ?? idx + 1), views };
    });

    const today = DAYS.includes(body.today) ? body.today : null;
    const done = [
      ...new Set(
        (Array.isArray(body.done) ? body.done : []).filter((d) =>
          DAYS.includes(d),
        ),
      ),
    ];

    return NextResponse.json(
      buildSuggestion(weeks, postsPerWeek, { today, done }),
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
