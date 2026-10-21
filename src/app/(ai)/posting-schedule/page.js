"use client";

// Save as: app/posting-schedule/page.js

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "posting-schedule-state";
const DAYS = [
  ["mon", "Monday"],
  ["tue", "Tuesday"],
  ["wed", "Wednesday"],
  ["thu", "Thursday"],
  ["fri", "Friday"],
  ["sat", "Saturday"],
  ["sun", "Sunday"],
];

const emptyViews = () => Object.fromEntries(DAYS.map(([k]) => [k, ""]));

function mondayOfThisWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString();
}

function freshState() {
  return { startMonday: mondayOfThisWeek(), week: 1, postsPerWeek: 3, weeks: {} };
}

function weekRange(startMonday, week) {
  const a = new Date(startMonday);
  a.setDate(a.getDate() + (week - 1) * 7);
  const b = new Date(a);
  b.setDate(b.getDate() + 6);
  const f = (d) => d.toLocaleDateString("en-MY", { day: "numeric", month: "short" });
  return `${f(a)} - ${f(b)}`;
}

const fmtNum = (n) => Number(n || 0).toLocaleString("en-MY");

export default function PostingSchedulePage() {
  const [state, setState] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [error, setError] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [entering, setEntering] = useState(false);

  // Load saved progress (or start fresh)
  useEffect(() => {
    let s = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) s = JSON.parse(raw);
    } catch {}
    setState(s && s.week ? s : freshState());
  }, []);

  useEffect(() => {
    if (!state) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  // Only weeks BEFORE the current one, and only the ones the owner saved, are used for the suggestion
  const history = useMemo(() => {
    if (!state) return [];
    return Object.entries(state.weeks)
      .map(([w, v]) => ({ week: Number(w), saved: v.saved, views: v.views }))
      .filter((w) => w.week < state.week && w.saved)
      .sort((a, b) => a.week - b.week)
      .map((w) => ({
        week: w.week,
        views: Object.fromEntries(DAYS.map(([k]) => [k, w.views[k] === "" ? null : Number(w.views[k])])),
      }));
  }, [state]);

  const historyKey = JSON.stringify(history);
  const week = state?.week;
  const postsPerWeek = state?.postsPerWeek;

  useEffect(() => {
    if (!state) return;
    let cancelled = false;
    async function load() {
      setLoadingPlan(true);
      setError("");
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
  }, [week, postsPerWeek, historyKey]);

  if (!state) return <main style={{ padding: 40, fontFamily: "system-ui, sans-serif" }}>Loading...</main>;

  const current = state.weeks[state.week] || { views: emptyViews(), saved: false };
  const suggestedDays = new Set((plan?.suggestions || []).map((s) => s.day));
  const maxAvg = Math.max(1, ...(plan?.days || []).map((d) => d.avg || 0));

  function setViews(key, value) {
    setSaveMsg("");
    setState((s) => {
      const cur = s.weeks[s.week] || { views: emptyViews(), saved: false };
      return { ...s, weeks: { ...s.weeks, [s.week]: { views: { ...cur.views, [key]: value }, saved: false } } };
    });
  }

  function saveViews() {
    setState((s) => {
      const cur = s.weeks[s.week] || { views: emptyViews(), saved: false };
      return { ...s, weeks: { ...s.weeks, [s.week]: { ...cur, saved: true } } };
    });
    setSaveMsg("Saved. These views will be used from next week onwards.");
    setEntering(false);
  }

  function skipWeek() {
    setState((s) => ({ ...s, week: s.week + 1 }));
    setEntering(false);
    setSaveMsg("");
  }

  function resetAll() {
    if (!window.confirm("Reset everything back to week 1? All entered views will be deleted.")) return;
    setState(freshState());
    setPlan(null);
    setEntering(false);
    setSaveMsg("");
    setError("");
  }

  const card = { border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 16 };
  const field = { padding: 8, fontSize: 15, color: "#000", boxSizing: "border-box" };
  const th = { textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #ddd", whiteSpace: "nowrap" };
  const td = { padding: "6px 8px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" };

  const pastWeeks = Object.entries(state.weeks)
    .map(([w, v]) => ({ week: Number(w), ...v }))
    .filter((w) => w.week < state.week && w.saved)
    .sort((a, b) => b.week - a.week);

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1>Smart Posting Schedule</h1>
      <p>
        Each week you get suggested days to post on social media. At the end of the week, enter how many
        views each day got. Next week's suggestion is then worked out from all your past weeks, so it
        gets smarter over time. Suggestions are a guide, not a guarantee.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <strong style={{ fontSize: 18 }}>
          Week {state.week} <span style={{ fontWeight: 400, fontSize: 14 }}>({weekRange(state.startMonday, state.week)})</span>
        </strong>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, opacity: 0.7 }}>Demo controls:</span>
        <button onClick={skipWeek} style={{ padding: "8px 16px", cursor: "pointer" }}>
          Skip to next week
        </button>
        <button onClick={resetAll} style={{ padding: "8px 16px", cursor: "pointer" }}>
          Reset to week 1
        </button>
      </div>

      <label style={{ fontSize: 14 }}>
        Posts per week
        <br />
        <select
          value={state.postsPerWeek}
          onChange={(e) => setState((s) => ({ ...s, postsPerWeek: Number(e.target.value) }))}
          style={{ ...field, width: 120 }}
        >
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      {error && <p style={{ color: "crimson", marginTop: 16 }}>{error}</p>}

      <h2 style={{ marginTop: 28 }}>Suggested days to post this week</h2>
      {loadingPlan && !plan && <p>Working out your schedule...</p>}

      {plan && (
        <>
          <p style={{ fontSize: 13, opacity: 0.8, marginTop: 0 }}>
            {plan.mode === "starter"
              ? "No data yet, so this is a general starting suggestion."
              : `Based on ${plan.weeksUsed} past week${plan.weeksUsed > 1 ? "s" : ""} of your views.`}
          </p>
          {plan.suggestions.map((s, i) => (
            <div key={s.day} style={{ ...card, background: "#f4f4f4", color: "#000", marginBottom: 10 }}>
              <strong>
                {i + 1}. {s.label}
              </strong>
              <div style={{ fontSize: 13, marginTop: 4 }}>{s.reason}</div>
            </div>
          ))}

          <h3 style={{ marginBottom: 4 }}>Average views per day so far</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13, minWidth: 480 }}>
              <thead>
                <tr>
                  <th style={th}>Day</th>
                  <th style={th}>Avg views</th>
                  <th style={th}>Times posted</th>
                  <th style={{ ...th, width: "40%" }}></th>
                </tr>
              </thead>
              <tbody>
                {plan.days.map((d) => (
                  <tr key={d.day}>
                    <td style={td}>
                      {d.label}
                      {d.suggested ? " ★" : ""}
                    </td>
                    <td style={td}>{d.avg !== null ? fmtNum(d.avg) : "-"}</td>
                    <td style={td}>{d.samples}</td>
                    <td style={{ ...td, width: "40%" }}>
                      <div
                        style={{
                          height: 10,
                          width: `${d.avg ? Math.max(3, (d.avg / maxAvg) * 100) : 0}%`,
                          background: "#2563eb",
                          borderRadius: 4,
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>★ = suggested for this week.</div>
          </div>
        </>
      )}

      <h2 style={{ marginTop: 32 }}>End of week: enter your views</h2>
      {!entering ? (
        <div>
          <button onClick={() => setEntering(true)} style={{ padding: "10px 20px", fontSize: 16, cursor: "pointer" }}>
            {current.saved ? "Edit this week's views" : "Enter this week's views"}
          </button>
          {current.saved && (
            <span style={{ marginLeft: 12, color: "green", fontSize: 14 }}>Views saved for week {state.week}.</span>
          )}
        </div>
      ) : (
        <div style={card}>
          <p style={{ fontSize: 13, marginTop: 0 }}>
            Type the views for each day. Leave a day empty if you did not post that day (this is different from 0 views).
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {DAYS.map(([key, label]) => (
              <label key={key} style={{ fontSize: 13, minWidth: 120 }}>
                {label}
                {suggestedDays.has(key) ? " ★" : ""}
                <br />
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={current.views[key]}
                  onChange={(e) => setViews(key, e.target.value)}
                  style={{ ...field, width: 120 }}
                />
              </label>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <button onClick={saveViews} style={{ padding: "8px 16px", cursor: "pointer" }}>
              Save views
            </button>
            <button onClick={() => setEntering(false)} style={{ padding: "8px 16px", marginLeft: 8, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {saveMsg && <p style={{ color: "green", fontSize: 14 }}>{saveMsg} Press "Skip to next week" to continue the demo.</p>}

      {pastWeeks.length > 0 && (
        <>
          <h2 style={{ marginTop: 32 }}>Past weeks</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13, minWidth: 560 }}>
              <thead>
                <tr>
                  <th style={th}>Week</th>
                  {DAYS.map(([k, label]) => (
                    <th key={k} style={th}>
                      {label.slice(0, 3)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pastWeeks.map((w) => (
                  <tr key={w.week}>
                    <td style={td}>Week {w.week}</td>
                    {DAYS.map(([k]) => (
                      <td key={k} style={td}>
                        {w.views[k] === "" ? "-" : fmtNum(w.views[k])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}