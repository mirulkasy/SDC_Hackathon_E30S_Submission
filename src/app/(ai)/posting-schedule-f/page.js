"use client";

import { useState, useEffect, useRef } from "react";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const HISTORY_KEY = "postingHistory"; // every past week, kept forever
const SUGGESTION_KEY = "postingSuggestion"; // cached so we only ask the AI once per week
const OFFSET_KEY = "demoWeekOffset"; // demo only: how many weeks the button has skipped forward

// Demo clock: the real date plus however many weeks the demo button has skipped
function getNow(offsetWeeks = 0) {
  return new Date(Date.now() + offsetWeeks * 7 * 24 * 60 * 60 * 1000);
}

// Monday of the current week in local time, e.g. "2026-10-19"
function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1) - day);
  return d.toLocaleDateString("en-CA");
}

// Sunday of the same week
function getWeekEnd(date = new Date()) {
  const d = new Date(getWeekStart(date) + "T00:00:00");
  d.setDate(d.getDate() + 6);
  return d.toLocaleDateString("en-CA");
}

const emptyPost = () => ({ day: "Monday", time: "18:00", views: "" });

export default function DemoPage() {
  const [history, setHistory] = useState([]);
  const [suggestion, setSuggestion] = useState(null);
  const [ready, setReady] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [posts, setPosts] = useState([emptyPost()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState(""); // validation message shown right beside the form buttons
  const [weekOffset, setWeekOffset] = useState(0); // demo clock
  const startedRef = useRef(false); // stops dev-mode double effects from calling the AI twice
  const requestRef = useRef(0); // lets us ignore answers from outdated requests

  const now = getNow(weekOffset);
  const thisWeek = getWeekStart(now);
  const doneThisWeek = history.some((w) => w.weekStart === thisWeek);

  async function fetchSuggestion(hist, offset = weekOffset) {
    const now = getNow(offset);
    const id = ++requestRef.current;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000); // never stay stuck on "Analysing..."
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/posting-schedule-f", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          today: now.toLocaleDateString("en-CA"),
          weekStart: getWeekStart(now),
          weekEnd: getWeekEnd(now),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          isLastDayOfWeek: false, // demo: the user presses the button themselves, no fixed day
          history: hist,
        }),
      });

      const data = await res.json();
      if (id !== requestRef.current) return; // a newer request replaced this one

      if (!res.ok) {
        setError(data.error || "Request failed");
      } else {
        const s = { weekStart: getWeekStart(now), data };
        setSuggestion(s);
        localStorage.setItem(SUGGESTION_KEY, JSON.stringify(s));
      }
    } catch (err) {
      if (id !== requestRef.current) return;
      setError(
        err.name === "AbortError"
          ? "The AI took too long to answer. Press Try again."
          : "Could not reach the server. Is npm run dev running?"
      );
    } finally {
      clearTimeout(timer);
      if (id === requestRef.current) setLoading(false);
    }
  }

  // On load: read saved history, then show this week's suggestion
  // (from cache if we already asked this week, otherwise ask the AI).
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let hist = [];
    let cached = null;
    let offset = 0;
    try {
      hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      cached = JSON.parse(localStorage.getItem(SUGGESTION_KEY) || "null");
      offset = Number(localStorage.getItem(OFFSET_KEY)) || 0;
    } catch {
      hist = [];
    }

    setHistory(hist);
    setWeekOffset(offset);
    setReady(true);

    if (cached && cached.weekStart === getWeekStart(getNow(offset))) {
      setSuggestion(cached); // already asked this week
    } else {
      fetchSuggestion(hist, offset); // new week (or first ever visit): analyse and suggest
    }
  }, []);

  // DEMO: instead of waiting for a real Monday, this button starts the next week
  function handleNextWeek() {
    const next = weekOffset + 1;
    localStorage.setItem(OFFSET_KEY, String(next));
    setWeekOffset(next);
    setSuggestion(null);
    setShowForm(false);
    setError("");
    setFormError("");
    fetchSuggestion(history, next);
  }

  // DEMO: wipe everything and start again from week 1
  function handleReset() {
    if (!window.confirm("Delete all recorded weeks and restart the demo?")) return;
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(SUGGESTION_KEY);
    localStorage.removeItem(OFFSET_KEY);
    setHistory([]);
    setWeekOffset(0);
    setSuggestion(null);
    setShowForm(false);
    setError("");
    fetchSuggestion([], 0);
  }

  function updatePost(i, field, value) {
    setPosts((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  }

  function handleSave() {
    for (const p of posts) {
      if (!p.day || !p.time || p.views === "" || Number(p.views) < 0) {
        setFormError("Please fill in day, time and views for every post.");
        return;
      }
    }

    const entry = {
      weekStart: thisWeek,
      posts: posts.map((p) => ({
        day: p.day,
        time: p.time,
        views: Math.round(Number(p.views)),
      })),
    };

    // Keep every previous week; only replace this week's entry if it somehow exists
    const updated = [...history.filter((w) => w.weekStart !== thisWeek), entry];

    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch {
      setFormError("Could not save to this browser.");
      return;
    }

    setHistory(updated);
    setShowForm(false);
    setPosts([emptyPost()]);
    setFormError("");
  }

  const inputStyle = {
    padding: 10,
    fontSize: 16,
    boxSizing: "border-box",
    color: "#000",
  };

  const s = suggestion?.data;

  return (
    <main
      style={{
        maxWidth: 640,
        margin: "40px auto",
        padding: "0 16px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1>AI Demo</h1>
      <p>
        Week {weekOffset + 1} (demo): {thisWeek} to {getWeekEnd(now)}.{" "}
        {ready && history.length > 0
          ? `${history.length} past week${history.length > 1 ? "s" : ""} recorded.`
          : "No weeks recorded yet."}
      </p>

      <h2>When to post this week</h2>

      {loading && <p>Analysing your data...</p>}

      {error && (
        <p style={{ color: "crimson" }}>
          {error}{" "}
          {!suggestion && !loading && (
            <button onClick={() => fetchSuggestion(history)}>Try again</button>
          )}
        </p>
      )}

      {s && (
        <>
          <p>{s.summary}</p>

          {Array.isArray(s.recommended_times) && (
            <ul>
              {s.recommended_times.map((t, i) => (
                <li key={i} style={{ marginBottom: 8 }}>
                  <strong>
                    {t.day}, {t.time}
                  </strong>
                  <br />
                  {t.reason}
                </li>
              ))}
            </ul>
          )}

          {Array.isArray(s.pattern_insights) && s.pattern_insights.length > 0 && (
            <>
              <h3>What the AI has noticed</h3>
              <ul>
                {s.pattern_insights.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </>
          )}

          <p>
            Confidence: {s.confidence} (based on {s.weeks_analysed} week
            {s.weeks_analysed === 1 ? "" : "s"} of data)
          </p>

          {s.reminder && !doneThisWeek && (
            <p style={{ fontWeight: 600 }}>{s.reminder}</p>
          )}
        </>
      )}

      <h2>Record this week&apos;s views</h2>
      <p>
        {!ready
          ? " "
          : doneThisWeek
          ? "This week's views are recorded. Press \"Start next week\" below and the AI will use them to plan the next one."
          : "At the end of the week, press the button and enter how many views each post got."}
      </p>

      {!showForm && (
        <button
          onClick={() => {
            setShowForm(true);
            setFormError("");
          }}
          disabled={!ready || doneThisWeek}
          style={{
            padding: "10px 20px",
            fontSize: 16,
            cursor: !ready || doneThisWeek ? "not-allowed" : "pointer",
          }}
        >
          Enter this week&apos;s views
        </button>
      )}

      {showForm && (
        <div style={{ marginTop: 8 }}>
          {posts.map((p, i) => (
            <div
              key={i}
              style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}
            >
              <select
                value={p.day}
                onChange={(e) => updatePost(i, "day", e.target.value)}
                style={inputStyle}
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <input
                type="time"
                value={p.time}
                onChange={(e) => updatePost(i, "time", e.target.value)}
                style={inputStyle}
              />

              <input
                type="number"
                min="0"
                placeholder="Views"
                value={p.views}
                onChange={(e) => updatePost(i, "views", e.target.value)}
                style={{ ...inputStyle, width: 120 }}
              />

              {posts.length > 1 && (
                <button
                  onClick={() => setPosts((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  Remove
                </button>
              )}
            </div>
          ))}

          <button onClick={() => setPosts((prev) => [...prev, emptyPost()])}>
            Add another post
          </button>

          {formError && <p style={{ color: "crimson" }}>{formError}</p>}

          <div style={{ marginTop: 16 }}>
            <button
              onClick={handleSave}
              style={{ padding: "10px 20px", fontSize: 16, cursor: "pointer" }}
            >
              Save this week
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setFormError("");
              }}
              style={{ marginLeft: 8, padding: "10px 20px", fontSize: 16 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <h2>Demo controls</h2>
      <p>These buttons replace the real calendar so you can step through the weeks.</p>
      <button
        onClick={handleNextWeek}
        disabled={!ready}
        style={{ padding: "10px 20px", fontSize: 16, cursor: "pointer" }}
      >
        Start next week
      </button>
      <button
        onClick={handleReset}
        disabled={!ready}
        style={{ marginLeft: 8, padding: "10px 20px", fontSize: 16, cursor: "pointer" }}
      >
        Reset demo
      </button>

      {s && (
        <>
          <h3>Raw JSON</h3>
          <pre
            style={{
              background: "#f4f4f4",
              color: "#000",
              padding: 12,
              borderRadius: 6,
              overflowX: "auto",
            }}
          >
            {JSON.stringify(s, null, 2)}
          </pre>
        </>
      )}
    </main>
  );
}