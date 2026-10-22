"use client";

import { useState } from "react";
import styles from "./publicity.module.css";
import NavBar from "@/components/layout/NavBar";
import weeklyViews from "./data/weeklyViews.json";
import schedule from "./data/schedule.json";
import captions from "./data/captions.json";
import videoFormats from "./data/videoFormats.json";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const PLATFORMS = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  tiktok: "TikTok",
};
const RATINGS = [
  { key: "poor", label: "Poor" },
  { key: "okay", label: "Okay" },
  { key: "great", label: "Great" },
];

// Chart geometry
const LEFT = 10;
const TOP = 10;
const BASE = 140;
const PLOT_H = BASE - TOP;
const SLOT = 40;
const BAR_W = 24;

const maxScale =
  Math.ceil(
    Math.max(...weeklyViews.flatMap((w) => w.days.map((d) => d.views ?? 0))) /
      500,
  ) * 500;

function formatViews(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `${n}`;
}

function formatPostDate(value) {
  const [, month, day] = value.split("-");
  return { day: Number(day), month: MONTHS[Number(month) - 1] };
}

export default function PublicityPage() {
  const [weekIdx, setWeekIdx] = useState(weeklyViews.length - 1);
  const [selectedBar, setSelectedBar] = useState(null);

  const [activeWeek, setActiveWeek] = useState(1);
  const [openPost, setOpenPost] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const [feedbackDone, setFeedbackDone] = useState({});
  const [feedbacks, setFeedbacks] = useState({});
  const [form, setForm] = useState({ views: "", rating: "", note: "" });

  // ── Chart data ──
  const viewWeek = weeklyViews[weekIdx];
  const known = viewWeek.days.filter((d) => d.views !== null);
  const total = known.reduce((sum, d) => sum + d.views, 0);
  const previous =
    weekIdx > 0
      ? weeklyViews[weekIdx - 1].days
          .slice(0, known.length)
          .reduce((sum, d) => sum + d.views, 0)
      : null;
  const change = previous
    ? Math.round(((total - previous) / previous) * 100)
    : null;
  const selectedDay = selectedBar !== null ? viewWeek.days[selectedBar] : null;

  const changeViewWeek = (next) => {
    setWeekIdx(next);
    setSelectedBar(null);
  };

  // ── Schedule data ──
  const week = schedule.find((w) => w.week === activeWeek);
  const locked = activeWeek > 1 && !feedbackDone[activeWeek - 1];
  const hasNextWeek = activeWeek < schedule.length;
  const previousFeedback = feedbacks[activeWeek - 1];

  const isWeekLocked = (n) => n > 1 && !feedbackDone[n - 1];

  const handleCopy = async (post, caption) => {
    const text = `${caption.text}\n\n${caption.cta}\n${caption.hashtags.join(" ")}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(post.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const handleSubmitFeedback = () => {
    if (!form.views || !form.rating) return;
    setFeedbacks({ ...feedbacks, [activeWeek]: form });
    setFeedbackDone({ ...feedbackDone, [activeWeek]: true });
    setForm({ views: "", rating: "", note: "" });
    setOpenPost(null);
    setActiveWeek(activeWeek + 1);
  };

  return (
    <>
      <main className={styles.publicityPage}>
        {/* ── Section 1: Weekly Views Chart ── */}
        <section className={styles.topWrapper}>
          <h1>Publicity</h1>

          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <p>{selectedDay ? `${selectedDay.day} views` : "Total views"}</p>
              <h2>
                {(selectedDay ? selectedDay.views : total).toLocaleString(
                  "en-MY",
                )}
              </h2>
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
                    {formatViews(maxScale * f)}
                  </text>
                </g>
              ))}

              {viewWeek.days.map((d, i) => {
                const empty = d.views === null;
                const h = empty
                  ? 2
                  : Math.max(4, (d.views / maxScale) * PLOT_H);
                const x = LEFT + i * SLOT + (SLOT - BAR_W) / 2;
                const active = selectedBar === i;
                return (
                  <g
                    key={d.day}
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
                      {d.day}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className={styles.topAction}>
            <button
              onClick={() => changeViewWeek(weekIdx - 1)}
              disabled={weekIdx === 0}
              aria-label="Previous week"
            >
              <svg
                className={styles.topActionLogo}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 19.5 8.25 12l7.5-7.5"
                />
              </svg>
            </button>
            <p>
              {viewWeek.current
                ? `This week · ${viewWeek.label}`
                : viewWeek.label}
            </p>
            <button
              onClick={() => changeViewWeek(weekIdx + 1)}
              disabled={weekIdx === weeklyViews.length - 1}
              aria-label="Next week"
            >
              <svg
                className={styles.topActionLogo}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m8.25 4.5 7.5 7.5-7.5 7.5"
                />
              </svg>
            </button>
          </div>
        </section>

        {/* ── Section 2: Smart Posting Schedule ── */}
        <section className={styles.scheduleWrapper}>
          <div className={styles.sectionHeader}>
            <h2>Smart Posting Schedule</h2>
            <span>AI · demo data</span>
          </div>

          <div className={styles.weekBar} role="tablist">
            {schedule.map((w) => (
              <button
                key={w.week}
                role="tab"
                aria-selected={activeWeek === w.week}
                className={activeWeek === w.week ? styles.weekActive : ""}
                onClick={() => {
                  setActiveWeek(w.week);
                  setOpenPost(null);
                }}
              >
                {w.label}
                {isWeekLocked(w.week) && (
                  <svg
                    className={styles.lockIcon}
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {locked ? (
            <div className={styles.lockedCard}>
              <h3>{week.label} is locked</h3>
              <p>
                Send your feedback for Week {activeWeek - 1} first. The AI uses
                your views and results to build a better plan for this week.
              </p>
            </div>
          ) : (
            <>
              <div className={styles.insightCard}>
                <h3>
                  {week.week === 1
                    ? "How this plan was made"
                    : "What the AI learned"}
                </h3>
                <p>{week.insight}</p>
                {previousFeedback && (
                  <span>
                    Your Week {activeWeek - 1} feedback:{" "}
                    {Number(previousFeedback.views).toLocaleString("en-MY")}{" "}
                    views ·{" "}
                    {
                      RATINGS.find((r) => r.key === previousFeedback.rating)
                        ?.label
                    }
                  </span>
                )}
              </div>

              <div className={styles.postList}>
                {week.posts.map((post) => {
                  const open = openPost === post.id;
                  const date = formatPostDate(post.date);
                  const caption = captions.find((c) => c.postId === post.id);
                  const video = videoFormats.find((v) => v.postId === post.id);

                  return (
                    <div key={post.id} className={styles.postCard}>
                      <button
                        className={styles.postHeader}
                        aria-expanded={open}
                        onClick={() => setOpenPost(open ? null : post.id)}
                      >
                        <div className={styles.postDate}>
                          <span>{post.day}</span>
                          <h3>{date.day}</h3>
                          <span>{date.month}</span>
                        </div>
                        <div className={styles.postInfo}>
                          <h3>{post.time}</h3>
                          <div className={styles.platformRow}>
                            {post.platforms.map((p) => (
                              <span
                                key={p}
                                className={`${styles.platform} ${styles[p]}`}
                              >
                                {PLATFORMS[p]}
                              </span>
                            ))}
                          </div>
                        </div>
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
                            <h4>Why this slot</h4>
                            <p>{post.reason}</p>
                          </div>

                          {caption && (
                            <div className={styles.bodyBlock}>
                              <h4>Promo Caption</h4>
                              <p>{caption.text}</p>
                              <p className={styles.captionCta}>{caption.cta}</p>
                              <div className={styles.hashtagRow}>
                                {caption.hashtags.map((tag) => (
                                  <span key={tag}>{tag}</span>
                                ))}
                              </div>
                              <button
                                className={styles.copyButton}
                                onClick={() => handleCopy(post, caption)}
                              >
                                {copiedId === post.id
                                  ? "Copied!"
                                  : "Copy caption"}
                              </button>
                            </div>
                          )}

                          {video && (
                            <div className={styles.bodyBlock}>
                              <h4>Suggested Video Format</h4>
                              <div className={styles.videoMeta}>
                                <div>
                                  <p>Context</p>
                                  <span>{video.context}</span>
                                </div>
                                <div>
                                  <p>Duration</p>
                                  <span className={styles.durationBadge}>
                                    {video.duration}
                                  </span>
                                </div>
                              </div>
                              <p className={styles.shotTitle}>Shots</p>
                              <div className={styles.shotList}>
                                {video.shots.map((shot) => (
                                  <div
                                    key={shot.no}
                                    className={styles.shotItem}
                                  >
                                    <b>{shot.no}</b>
                                    <div>
                                      <span>{shot.time}</span>
                                      <p>{shot.description}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* ── Section 3: Feedback ── */}
        {!locked && hasNextWeek && (
          <section className={styles.feedbackWrapper}>
            {feedbackDone[activeWeek] ? (
              <div className={styles.doneCard}>
                <h3>Feedback sent</h3>
                <p>
                  Week {activeWeek + 1} has been updated using your Week{" "}
                  {activeWeek} results.
                </p>
              </div>
            ) : (
              <div className={styles.feedbackCard}>
                <h3>How did {week.label} go?</h3>
                <p>
                  Tell the AI your results so it can improve Week{" "}
                  {activeWeek + 1}.
                </p>

                <div className={styles.field}>
                  <label htmlFor="views">Total views this week</label>
                  <input
                    id="views"
                    className={styles.input}
                    type="number"
                    inputMode="numeric"
                    min="0"
                    placeholder="e.g. 8500"
                    value={form.views}
                    onChange={(e) =>
                      setForm({ ...form, views: e.target.value })
                    }
                  />
                </div>

                <div className={styles.field}>
                  <label>Overall result</label>
                  <div className={styles.ratingRow}>
                    {RATINGS.map((r) => (
                      <button
                        key={r.key}
                        className={
                          form.rating === r.key ? styles.ratingActive : ""
                        }
                        onClick={() => setForm({ ...form, rating: r.key })}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.field}>
                  <label htmlFor="note">Notes (optional)</label>
                  <textarea
                    id="note"
                    className={styles.input}
                    rows="3"
                    placeholder="Which post worked best? Any comments or orders?"
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                  />
                </div>

                <button
                  className={styles.submitButton}
                  disabled={!form.views || !form.rating}
                  onClick={handleSubmitFeedback}
                >
                  Submit & update Week {activeWeek + 1}
                </button>
              </div>
            )}
          </section>
        )}
      </main>

      <NavBar />
    </>
  );
}
