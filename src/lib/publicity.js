import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

/* ------------------------------------------------------------------ */
/* Firestore layout                                                    */
/*  organizations/{orgId}/publicity/state       -> which week we are on */
/*  organizations/{orgId}/publicityWeeks/{n}    -> views + ideas of week n */
/* ------------------------------------------------------------------ */

export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const PLATFORMS = [
  "TikTok",
  "Instagram Reels",
  "YouTube Shorts",
  "Facebook Reels",
];

const stateRef = (orgId) =>
  doc(db, "organizations", orgId, "publicity", "state");
const weekRef = (orgId, week) =>
  doc(db, "organizations", orgId, "publicityWeeks", String(week));

/* ---- helpers ---- */

export const emptyViews = () =>
  Object.fromEntries(DAY_KEYS.map((k) => [k, null]));

// "" / undefined / NaN -> null (did not post). 0 stays 0 (posted, no views).
const cleanView = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};

function mondayOfThisWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString();
}

export function weekRange(startMonday, week) {
  const a = new Date(startMonday);
  a.setDate(a.getDate() + (week - 1) * 7);
  const b = new Date(a);
  b.setDate(b.getDate() + 6);
  const f = (d) =>
    d.toLocaleDateString("en-MY", { day: "numeric", month: "short" });
  return `${f(a)} - ${f(b)}`;
}

/** Date of a given weekday inside a given week (for the date chips). */
export function dateForDay(startMonday, week, dayKey) {
  const d = new Date(startMonday);
  d.setDate(d.getDate() + (week - 1) * 7 + DAY_KEYS.indexOf(dayKey));
  return d;
}

export const weekHasViews = (w) =>
  !!w &&
  DAY_KEYS.some((k) => w.views?.[k] !== null && w.views?.[k] !== undefined);

function mapWeek(data) {
  return {
    views: { ...emptyViews(), ...(data.views ?? {}) },
    ideas: Array.isArray(data.ideas) ? data.ideas : [],
    ideasPlatform: data.ideasPlatform ?? null,
    planned: Array.isArray(data.planned) ? data.planned : [],
  };
}

/**
 * What we send to /api/posting-schedule.
 * Every week up to and including the current one that has at least one
 * number counts, so the model learns day by day, not only at week's end.
 */
export function buildHistory(weeks, currentWeek) {
  return Object.entries(weeks)
    .map(([n, w]) => ({ week: Number(n), views: w.views }))
    .filter((w) => w.week <= currentWeek && weekHasViews(w))
    .sort((a, b) => a.week - b.week);
}

/* ---- live data ---- */

/** Live state + all weeks. callback({ state, weeks }) fires once both loaded. */
export function subscribePublicity(orgId, callback) {
  let state = null;
  let weeks = {};
  let gotState = false;
  let gotWeeks = false;
  const emit = () => gotState && gotWeeks && callback({ state, weeks });

  const unsubState = onSnapshot(
    stateRef(orgId),
    (snap) => {
      state = snap.exists() ? snap.data() : null;
      gotState = true;
      emit();
    },
    (err) => console.error("Publicity state listener failed:", err),
  );

  const unsubWeeks = onSnapshot(
    collection(db, "organizations", orgId, "publicityWeeks"),
    (snap) => {
      weeks = {};
      snap.forEach((d) => (weeks[Number(d.id)] = mapWeek(d.data())));
      gotWeeks = true;
      emit();
    },
    (err) => console.error("Publicity weeks listener failed:", err),
  );

  return () => {
    unsubState();
    unsubWeeks();
  };
}

/** First visit only: creates week 1. Safe if two devices open at once. */
export async function ensurePublicity({ orgId, user }) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(stateRef(orgId));
    if (snap.exists()) return;
    tx.set(stateRef(orgId), {
      startMonday: mondayOfThisWeek(),
      week: 1,
      postsPerWeek: 3,
      topic: "",
      platform: "TikTok",
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    tx.set(weekRef(orgId, 1), {
      views: emptyViews(),
      ideas: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

/* ---- writes ---- */

/** postsPerWeek / topic / platform */
export async function updateSettings(orgId, patch) {
  const allowed = {};
  if (patch.postsPerWeek !== undefined)
    allowed.postsPerWeek = Math.min(
      7,
      Math.max(1, Number(patch.postsPerWeek) || 3),
    );
  if (patch.topic !== undefined)
    allowed.topic = String(patch.topic).slice(0, 1000);
  if (patch.platform !== undefined && PLATFORMS.includes(patch.platform))
    allowed.platform = patch.platform;
  await updateDoc(stateRef(orgId), {
    ...allowed,
    updatedAt: serverTimestamp(),
  });
}

/** Save one day's views (auto-save per day). "" clears it. */
export async function saveDayViews(orgId, week, dayKey, value) {
  await setDoc(
    weekRef(orgId, week),
    { views: { [dayKey]: cleanView(value) }, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/** Keep the generated video ideas so every device sees the same ones. */
export async function saveIdeas(orgId, week, { ideas, platform }) {
  await setDoc(
    weekRef(orgId, week),
    { ideas, ideasPlatform: platform, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/** The days planned for a week: [{ day, reason, confidence }] */
export async function savePlanned(orgId, week, planned) {
  await setDoc(
    weekRef(orgId, week),
    { planned, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/**
 * The "Add week" button. Runs in a transaction so two phones tapping at
 * the same time only create ONE new week.
 * Throws: "WEEK_EMPTY" (nothing entered yet) | "ALREADY_ADDED" (another device did it)
 */
export async function addNextWeek({ orgId, fromWeek }) {
  let nextWeek = fromWeek + 1;
  await runTransaction(db, async (tx) => {
    const stateSnap = await tx.get(stateRef(orgId));
    const weekSnap = await tx.get(weekRef(orgId, fromWeek));
    if (!stateSnap.exists()) throw new Error("NO_STATE");
    if (stateSnap.data().week !== fromWeek) throw new Error("ALREADY_ADDED");
    if (!weekHasViews(mapWeek(weekSnap.data() ?? {})))
      throw new Error("WEEK_EMPTY");

    nextWeek = fromWeek + 1;
    tx.update(stateRef(orgId), {
      week: nextWeek,
      updatedAt: serverTimestamp(),
    });
    tx.set(weekRef(orgId, nextWeek), {
      views: emptyViews(),
      ideas: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  return nextWeek;
}
