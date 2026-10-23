"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./publicity.module.css";
import NavBar from "@/components/layout/NavBar";
import { useAuth } from "@/context/AuthContext";
import {
  DAY_KEYS,
  DAY_SHORT,
  PLATFORMS,
  addNextWeek,
  buildHistory,
  dateForDay,
  emptyViews,
  ensurePublicity,
  saveDayViews,
  saveIdeas,
  savePlanned,
  subscribePublicity,
  updateSettings,
  weekHasViews,
  weekRange,
} from "@/lib/publicity";

const DAY_FULL = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const CONF_LABEL = {
  untested: "New day",
  low: "Little data",
  medium: "Some data",
  high: "Reliable",
};

// Chart geometry
const LEFT = 10;
const TOP = 10;
const BASE = 140;
const PLOT_H = BASE - TOP;
const SLOT = 40;
const BAR_W = 24;

const fmtNum = (n) => Number(n || 0).toLocaleString("en-MY");
const hasNum = (v) => v !== null && v !== undefined;
const byDay = (a, b) => DAY_KEYS.indexOf(a.day) - DAY_KEYS.indexOf(b.day);
const norm = (p) => ({
  confidence: p.confidence ?? null,
  day: p.day,
  reason: p.reason ?? "",
});

function isPastDay(startMonday, week, key) {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return dateForDay(startMonday, week, key) < t;
}

function niceMax(max) {
  const power = Math.pow(10, Math.floor(Math.log10(max || 1)));
  const n = (max || 1) / power;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return nice * power;
}

function platformClass(p) {
  if (p.includes("Instagram")) return styles.instagram;
  if (p.includes("YouTube")) return styles.youtube;
  if (p.includes("Facebook")) return styles.facebook;
  return styles.tiktok;
}

/** Number box that saves when you leave it (or press Enter). */
function ViewsBox({ value, disabled, onSave }) {
  const [text, setText] = useState(value ?? "");
  useEffect(() => setText(value ?? ""), [value]);

  const commit = () => {
    const clean = text === "" ? null : Number(text);
    if (clean !== (value ?? null)) onSave(text);
  };

  return (
    <input
      className={styles.input}
      type="number"
      min="0"
      step="1"
      inputMode="numeric"
      placeholder="Views"
      value={text}
      disabled={disabled}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}

export default function PublicityPage() {
  const { user, profile } = useAuth();
  const orgId = profile?.orgId;

  const [data, setData] = useState(null); // { state, weeks }
  const [tab, setTab] = useState(null); // week being viewed, null = current week
  const [openDay, setOpenDay] = useState(null);
  const [selectedBar, setSelectedBar] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [busyDay, setBusyDay] = useState(null); // a day key, or "all"
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(null);
  const [topicDraft, setTopicDraft] = useState(null);

  useEffect(() => {
    if (!orgId || !user) return;
    ensurePublicity({ orgId, user }).catch((e) =>
      console.error("ensurePublicity:", e),
    );
    return subscribePublicity(orgId, setData);
  }, [orgId, user]);

  const state = data?.state;
  const weeks = data?.weeks ?? {};
  const currentWeek = state?.week;
  const todayKey = new Date().toDateString();

  // Everything the model may learn from: all weeks up to now, including this week so far
  const history = useMemo(
    () => (state ? buildHistory(weeks, state.week) : []),
    [data], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const historyKey = JSON.stringify(history);

  // doneDays: posted this week (have views). keepDays: those + planned days that already passed.
  const { doneDays, keepDays } = useMemo(() => {
    const w = state && weeks[state.week];
    if (!w) return { doneDays: [], keepDays: [] };
    const done = DAY_KEYS.filter((k) => hasNum(w.views[k]));
    const keep = DAY_KEYS.filter(
      (k) =>
        hasNum(w.views[k]) ||
        (w.planned.some((p) => p.day === k) &&
          isPastDay(state.startMonday, state.week, k)),
    );
    return { doneDays: done, keepDays: keep };
  }, [data, todayKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep this week's plan fresh and saved in Firebase (current week only)
  useEffect(() => {
    if (!orgId || !state || !weeks[state.week]) return;
    const wk = state.week;
    const w = weeks[wk];
    const upcoming = DAY_KEYS.filter(
      (k) => !isPastDay(state.startMonday, wk, k),
    );
    const slots = state.postsPerWeek - doneDays.length;
    let cancelled = false;

    async function run() {
      setLoadingPlan(true);
      setError("");
      try {
        let fresh = [];
        if (upcoming.length > 0 && slots > 0) {
          const res = await fetch("/api/posting-schedule", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              weeks: history,
              postsPerWeek: state.postsPerWeek,
              today: upcoming[0],
              done: doneDays,
            }),
          });
          const json = await res.json();
          if (cancelled) return;
          if (!res.ok) {
            setError(json.error || "Request failed");
            return;
          }
          setMeta({ mode: json.mode, weeksUsed: json.weeksUsed });
          fresh = json.suggestions.map(norm);
        }

        const kept = keepDays.map(
          (k) =>
            w.planned.find((p) => p.day === k) ?? {
              day: k,
              reason: "You logged views for this day.",
              confidence: null,
            },
        );
        const next = [...kept.map(norm), ...fresh].sort(byDay);
        const stored = w.planned.map(norm).sort(byDay);
        if (JSON.stringify(next) !== JSON.stringify(stored))
          await savePlanned(orgId, wk, next);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("Could not reach the server.");
      } finally {
        if (!cancelled) setLoadingPlan(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    orgId,
    state?.week,
    state?.postsPerWeek,
    historyKey,
    doneDays.join(),
    keepDays.join(),
  ]);

  if (!state || !weeks[currentWeek]) {
    return (
      <>
        <main className={styles.publicityPage}>
          <p style={{ textAlign: "center", padding: 40 }}>Loading...</p>
        </main>
        <NavBar />
      </>
    );
  }

  /* ---------- derived ---------- */
  const viewWeek = tab ?? currentWeek;
  const isCurrent = viewWeek === currentWeek;
  const week = weeks[viewWeek] ?? {
    views: emptyViews(),
    ideas: [],
    planned: [],
  };
  const weekNumbers = Object.keys(weeks)
    .map(Number)
    .sort((a, b) => a - b);
  const planned = [...week.planned].sort(byDay);
  const past = (k) => isPastDay(state.startMonday, viewWeek, k);

  const chartTotal = DAY_KEYS.reduce(
    (s, k) => s + (Number(week.views[k]) || 0),
    0,
  );
  const prevViews = weeks[viewWeek - 1]?.views;
  const prevTotal = prevViews
    ? DAY_KEYS.reduce((s, k) => s + (Number(prevViews[k]) || 0), 0)
    : 0;
  const change =
    prevTotal > 0
      ? Math.round(((chartTotal - prevTotal) / prevTotal) * 100)
      : null;
  const maxScale = niceMax(
    Math.max(100, ...DAY_KEYS.map((k) => Number(week.views[k]) || 0)),
  );
  const selectedDay = selectedBar !== null ? DAY_SHORT[selectedBar] : null;
  const selectedValue =
    selectedBar !== null
      ? Number(week.views[DAY_KEYS[selectedBar]]) || 0
      : chartTotal;

  const needIdeas = planned
    .filter(
      (p) =>
        !hasNum(week.views[p.day]) &&
        !past(p.day) &&
        !week.ideas.some((i) => i.day === p.day),
    )
    .map((p) => p.day);

  /* ---------- actions ---------- */
  function switchTab(n) {
    setTab(n);
    setOpenDay(null);
    setSelectedBar(null);
  }

  async function handleAddWeek() {
    if (
      !window.confirm(
        `Start week ${currentWeek + 1}? Week ${currentWeek} will be locked and can no longer be edited.`,
      )
    )
      return;
    setAdding(true);
    setError("");
    try {
      await addNextWeek({ orgId, fromWeek: currentWeek });
      switchTab(null);
    } catch (err) {
      setError(
        err.message === "WEEK_EMPTY"
          ? "Log views for at least one day before adding the next week."
          : err.message === "ALREADY_ADDED"
            ? "Another device already started the next week."
            : "Couldn't add the week. Please try again.",
      );
    } finally {
      setAdding(false);
    }
  }

  async function generateIdeas(dayKeys) {
    if (dayKeys.length === 0) return;
    setBusyDay(dayKeys.length === 1 ? dayKeys[0] : "all");
    setError("");
    try {
      const res = await fetch("/api/video-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: state.topic,
          platform: state.platform,
          days: dayKeys.map((k) => ({
            day: k,
            label: DAY_FULL[DAY_KEYS.indexOf(k)],
            reason: planned.find((p) => p.day === k)?.reason || "",
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Request failed");
        return;
      }
      const merged = Object.fromEntries(week.ideas.map((i) => [i.day, i]));
      for (const idea of json.ideas || []) merged[idea.day] = idea;
      await saveIdeas(orgId, viewWeek, {
        ideas: Object.values(merged),
        platform: state.platform,
      });
    } catch (e) {
      console.error(e);
      setError("Could not reach the server.");
    } finally {
      setBusyDay(null);
    }
  }

  async function handleCopy(day, idea) {
    const text =
      `${idea.caption}\n\n${idea.call_to_action ? `${idea.call_to_action}\n` : ""}${(idea.hashtags || []).join(" ")}`.trim();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(day);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  const insight = !isCurrent
    ? `Results and plan for week ${viewWeek} (${weekRange(state.startMonday, viewWeek)}).`
    : meta?.mode === "learned"
      ? `Learned from ${meta.weeksUsed} week${meta.weeksUsed > 1 ? "s" : ""} of views, including this week so far. The plan updates as you log views.`
      : "No view history yet, so this is a general starting suggestion. Log the views of each post and the plan gets sharper.";

  /* ---------- UI ---------- */
  return (
    <>
      <main className={styles.publicityPage}>
        {/* ── Chart + week tabs ── */}
        <section className={styles.topWrapper}>
          <h1>Publicity</h1>

          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <p>
                {selectedDay
                  ? `${selectedDay} views`
                  : `Week ${viewWeek} · ${weekRange(state.startMonday, viewWeek)}`}
              </p>
              <h2>{fmtNum(selectedValue)}</h2>
              {!selectedDay && change !== null && (
                <span
                  className={change >= 0 ? styles.changeUp : styles.changeDown}
                >
                  {change >= 0 ? "▲" : "▼"} {Math.abs(change)}% vs last week
                </span>
              )}
            </div>

            <svg className={styles.chartSvg} viewBox="0 0 340 170">
              {[0, 0.5, 1].map((f) => (
                <g key={f}>
                  <line
                    className={styles.chartGrid}
                    x1={LEFT}
                    x2={LEFT + 7 * SLOT}
                    y1={BASE - f * PLOT_H}
                    y2={BASE - f * PLOT_H}
                  />
                  <text
                    className={styles.chartAxis}
                    x={LEFT + 7 * SLOT + 6}
                    y={BASE - f * PLOT_H + 4}
                  >
                    {fmtNum(maxScale * f)}
                  </text>
                </g>
              ))}
              {DAY_KEYS.map((k, i) => {
                const raw = week.views[k];
                const empty = !hasNum(raw);
                const h = empty
                  ? 2
                  : Math.max(4, (Number(raw) / maxScale) * PLOT_H);
                const x = LEFT + i * SLOT + (SLOT - BAR_W) / 2;
                const active = selectedBar === i;
                return (
                  <g
                    key={k}
                    onClick={() => !empty && setSelectedBar(active ? null : i)}
                  >
                    <rect
                      className={styles.barHit}
                      x={LEFT + i * SLOT}
                      y={TOP}
                      width={SLOT}
                      height={PLOT_H + 30}
                    />
                    <rect
                      className={
                        empty
                          ? styles.barEmpty
                          : active
                            ? styles.barActive
                            : styles.bar
                      }
                      x={x}
                      y={BASE - h}
                      width={BAR_W}
                      height={h}
                      rx="4"
                    />
                    <text
                      className={
                        active ? styles.chartDayActive : styles.chartDay
                      }
                      x={x + BAR_W / 2}
                      y="160"
                      textAnchor="middle"
                    >
                      {DAY_SHORT[i]}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className={styles.weekTabs} role="tablist" aria-label="Weeks">
            {weekNumbers.map((n) => (
              <button
                key={n}
                role="tab"
                aria-selected={n === viewWeek}
                className={`${styles.weekTab} ${n === viewWeek ? styles.weekTabActive : ""}`}
                onClick={() => switchTab(n)}
              >
                Week {n}
                {n < currentWeek ? " 🔒" : ""}
              </button>
            ))}
            <button
              className={styles.addWeekBtn}
              onClick={handleAddWeek}
              disabled={adding || !weekHasViews(weeks[currentWeek])}
            >
              {adding ? "Adding..." : "+ Add week"}
            </button>
          </div>
          {isCurrent && !weekHasViews(weeks[currentWeek]) && (
            <p className={styles.tabHint}>
              Add week unlocks once you log views for at least one day.
            </p>
          )}
        </section>

        {/* ── Plan ── */}
        <section className={styles.scheduleWrapper}>
          <div className={styles.sectionHeader}>
            <h2>Smart Posting Schedule</h2>
            <span>AI</span>
          </div>

          {!isCurrent && (
            <div className={styles.lockedCard}>
              <h3>🔒 Week {viewWeek} is locked</h3>
              <p>
                You can look back at it, but only week {currentWeek} can be
                edited.
              </p>
            </div>
          )}

          <div className={styles.insightCard}>
            <h3>How this plan was made</h3>
            <p>{insight}</p>
          </div>

          {isCurrent && (
            <div className={styles.bodyBlock}>
              <h4>What do you post about? (optional)</h4>
              <textarea
                className={styles.input}
                rows={2}
                maxLength={1000}
                placeholder={
                  "For example:\nI sell homemade kuih and cakes in Banting."
                }
                value={topicDraft ?? state.topic ?? ""}
                onChange={(e) => setTopicDraft(e.target.value)}
                onBlur={() => {
                  if (topicDraft !== null && topicDraft !== state.topic)
                    updateSettings(orgId, { topic: topicDraft });
                  setTopicDraft(null);
                }}
              />
              <div className={styles.controlRow}>
                <select
                  className={styles.input}
                  style={{ width: "auto", padding: "10px 12px" }}
                  value={state.platform}
                  onChange={(e) =>
                    updateSettings(orgId, { platform: e.target.value })
                  }
                  aria-label="Platform"
                >
                  {PLATFORMS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
                <select
                  className={styles.input}
                  style={{ width: "auto", padding: "10px 12px" }}
                  value={state.postsPerWeek}
                  onChange={(e) =>
                    updateSettings(orgId, { postsPerWeek: e.target.value })
                  }
                  aria-label="Posts per week"
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <option key={n} value={n}>
                      {n} post{n > 1 ? "s" : ""}/week
                    </option>
                  ))}
                </select>
                {needIdeas.length > 0 && (
                  <button
                    className={styles.copyButton}
                    style={{ padding: "10px 16px", fontSize: 13 }}
                    onClick={() => generateIdeas(needIdeas)}
                    disabled={busyDay !== null}
                  >
                    {busyDay === "all"
                      ? "Planning videos..."
                      : `Make ideas for ${needIdeas.length} day${needIdeas.length > 1 ? "s" : ""}`}
                  </button>
                )}
              </div>
            </div>
          )}

          {error && <p style={{ color: "crimson", fontSize: 14 }}>{error}</p>}
          {isCurrent && loadingPlan && planned.length === 0 && (
            <p style={{ fontSize: 14, color: "#777" }}>
              Working out your schedule...
            </p>
          )}
          {isCurrent && !loadingPlan && planned.length === 0 && (
            <p style={{ fontSize: 14, color: "#777" }}>
              No more days to plan this week.
            </p>
          )}

          <div className={styles.postList}>
            {planned.map((p) => {
              const open = openDay === p.day;
              const d = dateForDay(state.startMonday, viewWeek, p.day);
              const views = week.views[p.day];
              const idea = week.ideas.find((i) => i.day === p.day);
              return (
                <div key={p.day} className={styles.postCard}>
                  <button
                    className={styles.postHeader}
                    aria-expanded={open}
                    onClick={() => setOpenDay(open ? null : p.day)}
                  >
                    <div className={styles.postDate}>
                      <span>{DAY_SHORT[DAY_KEYS.indexOf(p.day)]}</span>
                      <h3>{d.getDate()}</h3>
                      <span>
                        {d.toLocaleDateString("en-MY", { month: "short" })}
                      </span>
                    </div>
                    <div className={styles.postInfo}>
                      <h3>{DAY_FULL[DAY_KEYS.indexOf(p.day)]}</h3>
                      <div className={styles.platformRow}>
                        <span
                          className={`${styles.platform} ${platformClass(state.platform)}`}
                        >
                          {state.platform}
                        </span>
                        {p.confidence && (
                          <span
                            className={styles.confChip}
                            data-level={p.confidence}
                          >
                            {CONF_LABEL[p.confidence]}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={
                        hasNum(views)
                          ? styles.viewsBadge
                          : styles.viewsBadgeEmpty
                      }
                    >
                      {hasNum(views)
                        ? `${fmtNum(views)} views`
                        : past(p.day)
                          ? "Add views"
                          : "Upcoming"}
                    </span>
                    <svg
                      className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m19.5 8.25-7.5 7.5-7.5-7.5"
                      />
                    </svg>
                  </button>

                  {open && (
                    <div className={styles.postBody}>
                      <div className={styles.bodyBlock}>
                        <h4>Why this day</h4>
                        <p>{p.reason}</p>
                      </div>

                      {/* Feedback for THIS suggestion */}
                      <div className={styles.bodyBlock}>
                        <h4>How did this post do?</h4>
                        <ViewsBox
                          value={views}
                          disabled={!isCurrent}
                          onSave={(v) =>
                            saveDayViews(orgId, viewWeek, p.day, v)
                          }
                        />
                        <p className={styles.fieldHint}>
                          {isCurrent
                            ? "Saved when you leave the box. Leave it empty if you did not post."
                            : "This week is locked."}
                        </p>
                      </div>

                      {idea ? (
                        <>
                          <div className={styles.bodyBlock}>
                            <h4>Video Idea</h4>
                            <p>
                              <strong>{idea.title}</strong>
                            </p>
                            <p>{idea.video_context}</p>
                            <span className={styles.durationBadge}>
                              {idea.duration_seconds
                                ? `about ${idea.duration_seconds}s`
                                : "-"}
                            </span>
                          </div>
                          <div className={styles.bodyBlock}>
                            <h4>Shot list</h4>
                            <div className={styles.shotList}>
                              {(idea.shots || []).map((sh, i) => (
                                <div key={i} className={styles.shotItem}>
                                  <b>{i + 1}</b>
                                  <div>
                                    <span>
                                      {sh.seconds
                                        ? `${sh.seconds}s`
                                        : sh.shot_type}
                                    </span>
                                    <p>{sh.description}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className={styles.bodyBlock}>
                            <h4>Promo Caption</h4>
                            <p>{idea.caption}</p>
                            {idea.call_to_action && (
                              <p className={styles.captionCta}>
                                {idea.call_to_action}
                              </p>
                            )}
                            <div className={styles.hashtagRow}>
                              {(idea.hashtags || []).map((t) => (
                                <span key={t}>{t}</span>
                              ))}
                            </div>
                            <div className={styles.controlRow}>
                              <button
                                className={styles.copyButton}
                                onClick={() => handleCopy(p.day, idea)}
                              >
                                {copied === p.day ? "Copied!" : "Copy caption"}
                              </button>
                              {isCurrent && (
                                <button
                                  className={styles.ghostBtn}
                                  onClick={() => generateIdeas([p.day])}
                                  disabled={busyDay !== null}
                                >
                                  {busyDay === p.day
                                    ? "Planning..."
                                    : "New idea for this day"}
                                </button>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        isCurrent && (
                          <div className={styles.bodyBlock}>
                            <h4>Video Idea</h4>
                            <button
                              className={styles.copyButton}
                              onClick={() => generateIdeas([p.day])}
                              disabled={busyDay !== null}
                            >
                              {busyDay === p.day
                                ? "Planning..."
                                : "Make idea for this day"}
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <NavBar />
    </>
  );
}
