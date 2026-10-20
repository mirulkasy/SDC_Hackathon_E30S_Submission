"use client";

import { useState, useEffect, useRef } from "react";

// Same keys as the page that records the views, so both pages share one browser's data
const HISTORY_KEY = "postingHistory";
const OFFSET_KEY = "demoWeekOffset";
// New keys owned by this page
const PLAN_KEY = "plannerSchedule"; // this week's suggested days/times (one AI call per week)
const FORMATS_KEY = "plannerFormats"; // video ideas already generated this week
const NICHE_KEY = "plannerNiche";

// IMPORTANT: change this to the folder where you put route.js, e.g. app/api/posting-plan/route.js
const API_URL = "/api/posting-plan";

function getNow(offsetWeeks = 0) {
  return new Date(Date.now() + offsetWeeks * 7 * 24 * 60 * 60 * 1000);
}

// Monday of the week in local time, e.g. "2026-10-19"
function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1) - day);
  return d.toLocaleDateString("en-CA");
}

function getWeekEnd(date = new Date()) {
  const d = new Date(getWeekStart(date) + "T00:00:00");
  d.setDate(d.getDate() + 6);
  return d.toLocaleDateString("en-CA");
}

function readJson(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null");
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

async function callApi(payload, ms = 45000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  } catch (err) {
    if (err.name === "AbortError") throw new Error("The AI took too long to answer. Try again.");
    if (err instanceof TypeError) throw new Error("Could not reach the server. Is npm run dev running?");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const slotKey = (weekStart, t) => `${weekStart}|${t.day}|${t.time}`;

export default function WeeklyPlannerPage() {
  const [ready, setReady] = useState(false);
  const [history, setHistory] = useState([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [plan, setPlan] = useState(null); // { weekStart, data }
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState("");
  const [formats, setFormats] = useState({}); // slotKey -> video idea
  const [formatLoading, setFormatLoading] = useState({}); // slotKey -> bool
  const [formatError, setFormatError] = useState({}); // slotKey -> message
  const [niche, setNiche] = useState("");
  const startedRef = useRef(false);
  const planRequestRef = useRef(0);

  const now = getNow(weekOffset);
  const weekStart = getWeekStart(now);
  const weekEnd = getWeekEnd(now);

  async function fetchPlan(hist, offset) {
    const n = getNow(offset);
    const id = ++planRequestRef.current;
    setPlanLoading(true);
    setPlanError("");
    try {
      const data = await callApi({
        mode: "schedule",
        today: n.toLocaleDateString("en-CA"),
        weekStart: getWeekStart(n),
        weekEnd: getWeekEnd(n),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        isLastDayOfWeek: n.getDay() === 0,
        history: hist,
      });
      if (id !== planRequestRef.current) return;
      const p = { weekStart: getWeekStart(n), data };
      setPlan(p);
      localStorage.setItem(PLAN_KEY, JSON.stringify(p));
    } catch (err) {
      if (id !== planRequestRef.current) return;
      setPlanError(err.message);
    } finally {
      if (id === planRequestRef.current) setPlanLoading(false);
    }
  }

  // On load: read the saved views, then show this week's plan.
  // Weekly behaviour: a cached plan is reused only if it was made for the current week,
  // otherwise a fresh one is requested from the AI using ALL recorded weeks.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const hist = readJson(HISTORY_KEY, []);
    const offset = Number(localStorage.getItem(OFFSET_KEY)) || 0;
    const cachedPlan = readJson(PLAN_KEY, null);
    const cachedFormats = readJson(FORMATS_KEY, {});
    const currentWeek = getWeekStart(getNow(offset));

    setHistory(Array.isArray(hist) ? hist : []);
    setWeekOffset(offset);
    setNiche(localStorage.getItem(NICHE_KEY) || "");

    // Drop video ideas that belong to earlier weeks
    const freshFormats = Object.fromEntries(
      Object.entries(cachedFormats).filter(([k]) => k.startsWith(currentWeek + "|"))
    );
    setFormats(freshFormats);
    localStorage.setItem(FORMATS_KEY, JSON.stringify(freshFormats));

    setReady(true);

    if (cachedPlan && cachedPlan.weekStart === currentWeek) {
      setPlan(cachedPlan);
    } else {
      fetchPlan(Array.isArray(hist) ? hist : [], offset);
    }
  }, []);

  // Re-read the shared data (useful after recording views or skipping a week on the other page)
  function handleSync() {
    const hist = readJson(HISTORY_KEY, []);
    const offset = Number(localStorage.getItem(OFFSET_KEY)) || 0;
    const currentWeek = getWeekStart(getNow(offset));
    const cachedPlan = readJson(PLAN_KEY, null);

    setHistory(hist);
    setWeekOffset(offset);

    if (!cachedPlan || cachedPlan.weekStart !== currentWeek) {
      setPlan(null);
      setFormats({});
      localStorage.removeItem(FORMATS_KEY);
      fetchPlan(hist, offset);
    }
  }

  // Force a new plan for this week (e.g. after entering more data)
  function handleRegenerate() {
    setPlan(null);
    setFormats({});
    setFormatError({});
    localStorage.removeItem(PLAN_KEY);
    localStorage.removeItem(FORMATS_KEY);
    const hist = readJson(HISTORY_KEY, []);
    setHistory(hist);
    fetchPlan(hist, weekOffset);
  }

  async function handleGetFormat(t) {
    const key = slotKey(weekStart, t);
    setFormatLoading((p) => ({ ...p, [key]: true }));
    setFormatError((p) => ({ ...p, [key]: "" }));
    try {
      const data = await callApi({
        mode: "format",
        today: now.toLocaleDateString("en-CA"),
        weekStart,
        weekEnd,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        day: t.day,
        time: t.time,
        niche,
        history,
      });
      setFormats((prev) => {
        const next = { ...prev, [key]: data };
        localStorage.setItem(FORMATS_KEY, JSON.stringify(next));
        return next;
      });
    } catch (err) {
      setFormatError((p) => ({ ...p, [key]: err.message }));
    } finally {
      setFormatLoading((p) => ({ ...p, [key]: false }));
    }
  }

  function handleCopy(text) {
    try {
      navigator.clipboard.writeText(text);
    } catch {
      /* clipboard not available */
    }
  }

  const s = plan?.data;
  const card = {
    border: "1px solid #ddd",
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
    background: "#fff",
    color: "#000",
  };
  const button = { padding: "8px 16px", fontSize: 15, cursor: "pointer" };

  return (
    <main
      style={{
        maxWidth: 640,
        margin: "40px auto",
        padding: "0 16px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1>Weekly Posting Planner</h1>
      <p>
        Week of {weekStart} to {weekEnd}.{" "}
        {ready && history.length > 0
          ? `Using ${history.length} recorded week${history.length > 1 ? "s" : ""} of views.`
          : "No weeks recorded yet, so these are general suggestions."}
      </p>

      <label style={{ display: "block", marginBottom: 4 }}>
        What do you post about? (helps the video ideas fit you)
      </label>
      <input
        type="text"
        value={niche}
        maxLength={200}
        placeholder="e.g. home cooking, fitness tips, gaming"
        onChange={(e) => {
          setNiche(e.target.value);
          try {
            localStorage.setItem(NICHE_KEY, e.target.value);
          } catch {
            /* ignore */
          }
        }}
        style={{
          width: "100%",
          padding: 10,
          fontSize: 16,
          boxSizing: "border-box",
          color: "#000",
          marginBottom: 12,
        }}
      />

      <div style={{ marginBottom: 16 }}>
        <button onClick={handleSync} disabled={!ready || planLoading} style={button}>
          Refresh from saved data
        </button>
        <button
          onClick={handleRegenerate}
          disabled={!ready || planLoading}
          style={{ ...button, marginLeft: 8 }}
        >
          Regenerate this week&apos;s plan
        </button>
      </div>

      <h2>Best times to post this week</h2>
      {planLoading && <p>Analysing your data...</p>}

      {planError && (
        <p style={{ color: "crimson" }}>
          {planError}{" "}
          {!plan && !planLoading && (
            <button onClick={() => fetchPlan(history, weekOffset)}>Try again</button>
          )}
        </p>
      )}

      {s && (
        <>
          <p>{s.summary}</p>

          {Array.isArray(s.recommended_times) &&
            s.recommended_times.map((t, i) => {
              const key = slotKey(weekStart, t);
              const idea = formats[key];
              return (
                <div key={key + i} style={card}>
                  <strong>
                    {t.day}, {t.time}
                  </strong>
                  <p style={{ margin: "6px 0 10px" }}>{t.reason}</p>

                  {!idea && (
                    <button
                      onClick={() => handleGetFormat(t)}
                      disabled={!!formatLoading[key]}
                      style={button}
                    >
                      {formatLoading[key] ? "Thinking up an idea..." : `Suggest a video for ${t.day}`}
                    </button>
                  )}

                  {formatError[key] && (
                    <p style={{ color: "crimson" }}>
                      {formatError[key]}
                    </p>
                  )}

                  {idea && (
                    <div style={{ background: "#f7f7f7", borderRadius: 6, padding: 12 }}>
                      <h3 style={{ margin: "0 0 8px" }}>{idea.title}</h3>
                      <p><strong>Context:</strong> {idea.context}</p>
                      <p><strong>Duration:</strong> {idea.duration}</p>
                      <p><strong>Shot:</strong> {idea.shot}</p>
                      <p>
                        <strong>Promo caption:</strong>
                        <br />
                        {idea.promo_caption}
                      </p>
                      {idea.tip && <p><em>Tip: {idea.tip}</em></p>}
                      <button onClick={() => handleCopy(idea.promo_caption)} style={button}>
                        Copy caption
                      </button>
                      <button
                        onClick={() => handleGetFormat(t)}
                        disabled={!!formatLoading[key]}
                        style={{ ...button, marginLeft: 8 }}
                      >
                        {formatLoading[key] ? "Thinking..." : "Another idea"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

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

          {s.reminder && <p style={{ fontWeight: 600 }}>{s.reminder}</p>}
        </>
      )}
    </main>
  );
}