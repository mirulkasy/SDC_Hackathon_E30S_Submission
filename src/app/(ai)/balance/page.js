"use client";

import { useCallback, useEffect, useState } from "react";

const ENDPOINT = "/api/balance";

const fmtMoney = (n, cur) =>
  n == null ? "-" : `${cur ? `${cur} ` : ""}${Number(n).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const S = {
  page: { maxWidth: 520, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif", color: "#111" },
  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 24,
    background: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04)",
  },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
  label: { fontSize: 13, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 },
  big: { fontSize: 40, fontWeight: 700, lineHeight: 1.1, margin: "8px 0 4px", letterSpacing: -0.5 },
  muted: { fontSize: 13, color: "#6b7280" },
  button: { padding: "8px 16px", fontSize: 14, fontWeight: 600, borderRadius: 10, border: "1px solid #d1d5db", background: "#111827", color: "#fff" },
  pill: (bg, color) => ({ background: bg, color, fontSize: 12, fontWeight: 600, padding: "2px 10px", borderRadius: 999 }),
  skeleton: { background: "linear-gradient(90deg,#f1f1f1,#e8e8e8,#f1f1f1)", borderRadius: 8 },
};

export default function BalancePage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(ENDPOINT, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Something went wrong. Please try again.");
        return;
      }
      setData(json);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pct =
    data?.balanceSupported && data.total > 0 ? Math.max(0, Math.min(100, Math.round((data.remaining / data.total) * 100))) : null;
  const barColor = pct == null ? "#2563eb" : pct > 30 ? "#16a34a" : pct > 10 ? "#d97706" : "#dc2626";

  return (
    <main style={S.page}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
      <h1 style={{ marginBottom: 4 }}>API Balance</h1>
      <p style={{ marginTop: 0, color: "#4b5563" }}>Check how much AI credit is left before it runs out.</p>

      <section style={S.card} aria-live="polite" aria-busy={loading}>
        <div style={S.row}>
          <span style={S.label}>{data ? `${data.label} · ${data.provider}` : "Remaining credit"}</span>
          <button
            onClick={load}
            disabled={loading}
            style={{ ...S.button, opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>

        {/* Loading (first load) */}
        {loading && !data && !error && (
          <div style={{ marginTop: 16, animation: "pulse 1.2s ease-in-out infinite" }}>
            <div style={{ ...S.skeleton, height: 44, width: "55%" }} />
            <div style={{ ...S.skeleton, height: 10, width: "100%", marginTop: 20 }} />
            <div style={{ ...S.skeleton, height: 14, width: "40%", marginTop: 16 }} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div role="alert" style={{ marginTop: 16, padding: 12, borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: 14 }}>
            {error}
            <div>
              <button onClick={load} disabled={loading} style={{ marginTop: 8, padding: "4px 12px", cursor: "pointer" }}>
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Data (stays visible, dimmed, while refreshing) */}
        {data && !error && (
          <div style={{ opacity: loading ? 0.5 : 1, transition: "opacity .2s" }}>
            {data.balanceSupported ? (
              <>
                <div style={S.big}>{fmtMoney(data.remaining, data.currency)}</div>
                <div style={S.muted}>remaining</div>

                {pct != null && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ height: 10, borderRadius: 999, background: "#f1f5f9", overflow: "hidden" }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                      <div style={{ width: `${pct}%`, height: "100%", background: barColor, transition: "width .4s" }} />
                    </div>
                    <div style={{ ...S.row, ...S.muted, marginTop: 6 }}>
                      <span>Used {fmtMoney(data.used, data.currency)}</span>
                      <span>
                        {pct}% left of {fmtMoney(data.total, data.currency)}
                      </span>
                    </div>
                  </div>
                )}

                {pct != null && pct <= 10 && (
                  <div style={{ marginTop: 12 }}>
                    <span style={S.pill("#fee2e2", "#991b1b")}>Low balance: top up soon</span>
                  </div>
                )}
              </>
            ) : (
              <div style={{ marginTop: 12 }}>
                <span style={S.pill("#dcfce7", "#166534")}>✓ API key is working</span>
                <p style={{ fontSize: 15, lineHeight: 1.5, marginBottom: 0 }}>Remaining credit cannot be read automatically for this provider.</p>
              </div>
            )}

            {data.note && <p style={{ ...S.muted, lineHeight: 1.5 }}>{data.note}</p>}

            <div style={{ ...S.row, marginTop: 16, paddingTop: 12, borderTop: "1px solid #f1f1f1", flexWrap: "wrap" }}>
              <span style={S.muted}>Last checked {fmtTime(data.checkedAt)}</span>
              {data.dashboardUrl && (
                <a href={data.dashboardUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#2563eb" }}>
                  Open provider dashboard ↗
                </a>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}