"use client";

// Save as: app/video-ideas/page.js
// Reads the progress saved by the Smart Posting Schedule page (same browser).

import { useEffect, useMemo, useState } from "react";

const SCHEDULE_KEY = "posting-schedule-state"; // written by app/posting-schedule/page.js
const PREFS_KEY = "video-ideas-prefs";
const PLATFORMS = ["TikTok", "Instagram Reels", "YouTube Shorts", "Facebook Reels"];
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function weekRange(startMonday, week) {
  const a = new Date(startMonday);
  a.setDate(a.getDate() + (week - 1) * 7);
  const b = new Date(a);
  b.setDate(b.getDate() + 6);
  const f = (d) => d.toLocaleDateString("en-MY", { day: "numeric", month: "short" });
  return `${f(a)} - ${f(b)}`;
}

export default function VideoIdeasPage() {
  const [schedule, setSchedule] = useState(undefined); // undefined = still loading, null = nothing saved
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState("TikTok");
  const [plan, setPlan] = useState(null);
  const [ideas, setIdeas] = useState([]);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [copiedDay, setCopiedDay] = useState("");

  // Load the saved schedule progress and the last topic / platform used
  useEffect(() => {
    let s = null;
    try {
      const raw = localStorage.getItem(SCHEDULE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.week) s = parsed;
      }
    } catch {}
    setSchedule(s);
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
      if (typeof p.topic === "string") setTopic(p.topic);
      if (PLATFORMS.includes(p.platform)) setPlatform(p.platform);
    } catch {}
  }, []);

  function savePrefs(nextTopic, nextPlatform) {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ topic: nextTopic, platform: nextPlatform }));
    } catch {}
  }

  const week = schedule?.week ?? 1;
  const postsPerWeek = schedule?.postsPerWeek ?? 3;

  // Same rule as the schedule page: only saved weeks before the current week count
  const history = useMemo(() => {
    if (!schedule) return [];
    return Object.entries(schedule.weeks || {})
      .map(([w, v]) => ({ week: Number(w), saved: v.saved, views: v.views }))
      .filter((w) => w.week < schedule.week && w.saved)
      .sort((a, b) => a.week - b.week)
      .map((w) => ({
        week: w.week,
        views: Object.fromEntries(DAY_KEYS.map((k) => [k, w.views[k] === "" ? null : Number(w.views[k])])),
      }));
  }, [schedule]);

  // Get this week's suggested days from the schedule route
  useEffect(() => {
    if (schedule === undefined) return;
    let cancelled = false;
    async function load() {
      setLoadingPlan(true);
      setError("");
      setIdeas([]);
      try {
        const res = await fetch("/api/posting-schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weeks: history, postsPerWeek }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "Request failed");
          return;
        }
        setPlan(data);
      } catch {
        if (!cancelled) setError("Could not reach the server. Is npm run dev running?");
      } finally {
        if (!cancelled) setLoadingPlan(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule, JSON.stringify(history), postsPerWeek]);

  async function handleGenerate() {
    // Prefer the suggestions list; fall back to the days marked as suggested
    const picked =
      plan?.suggestions?.length > 0
        ? plan.suggestions
        : (plan?.days || []).filter((d) => d.suggested);
    if (picked.length === 0) {
      setError("No suggested days were found for this week. Open the Smart Posting Schedule page and try again.");
      return;
    }
    setGenerating(true);
    setError("");
    setIdeas([]);
    savePrefs(topic, platform);
    try {
      const res = await fetch("/api/video-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          platform,
          days: picked.map((s) => ({ day: s.day, label: s.label, reason: s.reason || "" })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Request failed");
        return;
      }
      setIdeas(data.ideas || []);
    } catch {
      setError("Could not reach the server. Is npm run dev running?");
    } finally {
      setGenerating(false);
    }
  }

  async function copyCaption(idea) {
    const text = `${idea.caption}\n\n${(idea.hashtags || []).join(" ")}`.trim();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedDay(idea.day);
      setTimeout(() => setCopiedDay(""), 2000);
    } catch {
      setError("Could not copy automatically. Please select the text manually.");
    }
  }

  const field = { padding: 8, fontSize: 15, color: "#000", boxSizing: "border-box" };
  const card = { border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 16 };
  const ideaByDay = Object.fromEntries(ideas.map((i) => [i.day, i]));

  if (schedule === undefined) {
    return <main style={{ padding: 40, fontFamily: "system-ui, sans-serif" }}>Loading...</main>;
  }

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1>Video Ideas for Your Posting Days</h1>
      <p>
        This page uses the progress saved by the Smart Posting Schedule page. For each day suggested
        this week, the AI plans a video: the idea, a promo caption, the length and the shots to film.
        The ideas are a starting point, so change them to fit your brand.
      </p>

      {schedule === null && (
        <p style={{ padding: 12, background: "#fff4e5", color: "#000", borderRadius: 6 }}>
          No saved schedule found in this browser, so this is showing the week 1 starter days. Open the{" "}
          <a href="/posting-schedule">Smart Posting Schedule page</a> first to build up your history.
        </p>
      )}

      <div style={{ ...card, background: "#f4f4f4", color: "#000" }}>
        <strong>
          Week {week}
          {schedule ? ` (${weekRange(schedule.startMonday, week)})` : ""}
        </strong>
        <div style={{ fontSize: 13, marginTop: 4 }}>
          {loadingPlan && "Loading this week's suggested days..."}
          {!loadingPlan && plan && (
            <>
              Post on: <strong>{plan.suggestions.map((s) => s.label).join(", ")}</strong>
              {plan.mode === "learned" ? ` (based on ${plan.weeksUsed} past week${plan.weeksUsed > 1 ? "s" : ""})` : " (starter suggestion)"}
            </>
          )}
        </div>
      </div>

      <h3 style={{ marginBottom: 4 }}>What do you post about? (optional)</h3>
      <textarea
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder={"For example:\nI sell homemade kuih and cakes in Banting. Customers like seeing how it is made."}
        rows={3}
        maxLength={1000}
        style={{ ...field, width: "100%", fontSize: 16, padding: 12 }}
      />

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12, alignItems: "end" }}>
        <label style={{ fontSize: 14 }}>
          Platform
          <br />
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={field}>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={handleGenerate}
          disabled={generating || loadingPlan || !plan}
          style={{
            padding: "10px 20px",
            fontSize: 16,
            cursor: generating || loadingPlan || !plan ? "not-allowed" : "pointer",
          }}
        >
          {generating ? "Planning videos..." : ideas.length ? "Make new ideas" : "Suggest video ideas"}
        </button>
      </div>

      {error && <p style={{ color: "crimson", marginTop: 16 }}>{error}</p>}

      {plan && (
        <>
          <h2 style={{ marginTop: 32 }}>This week's videos</h2>
          {plan.suggestions.map((s) => {
            const idea = ideaByDay[s.day];
            return (
              <div key={s.day} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <strong style={{ fontSize: 18 }}>{s.label}</strong>
                  <span style={{ fontSize: 12, opacity: 0.75 }}>{s.reason}</span>
                </div>

                {!idea && (
                  <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 0 }}>
                    {generating ? "Planning this video..." : 'Press "Suggest video ideas" to see the video plan for this day.'}
                  </p>
                )}

                {idea && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{idea.title}</div>
                    <p style={{ fontSize: 14, margin: "6px 0" }}>{idea.video_context}</p>

                    <div style={{ fontSize: 13, margin: "8px 0" }}>
                      <strong>Length:</strong> {idea.duration_seconds ? `about ${idea.duration_seconds} seconds` : "-"}
                    </div>

                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8 }}>Shot list</div>
                    <ol style={{ fontSize: 14, margin: "4px 0 8px", paddingLeft: 20 }}>
                      {idea.shots.map((sh, i) => (
                        <li key={i} style={{ marginBottom: 4 }}>
                          <strong>{sh.shot_type}</strong>
                          {sh.seconds ? ` (${sh.seconds}s)` : ""}: {sh.description}
                        </li>
                      ))}
                    </ol>

                    <div style={{ fontSize: 13, fontWeight: 600 }}>Promo caption</div>
                    <div style={{ background: "#f4f4f4", color: "#000", padding: 10, borderRadius: 6, fontSize: 14, whiteSpace: "pre-wrap", marginTop: 4 }}>
                      {idea.caption}
                      {idea.hashtags.length > 0 && `\n\n${idea.hashtags.join(" ")}`}
                    </div>
                    {idea.call_to_action && (
                      <div style={{ fontSize: 13, marginTop: 6 }}>
                        <strong>Call to action:</strong> {idea.call_to_action}
                      </div>
                    )}
                    <button onClick={() => copyCaption(idea)} style={{ marginTop: 8, padding: "6px 12px", cursor: "pointer" }}>
                      {copiedDay === idea.day ? "Copied!" : "Copy caption"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {ideas.some((i) => /\[[^\]]+\]/.test(i.caption)) && (
            <p style={{ fontSize: 13, opacity: 0.8 }}>
              Text in [square brackets] is a placeholder. Replace it with your real details (price, promo code and so on) before posting.
            </p>
          )}
        </>
      )}
    </main>
  );
}