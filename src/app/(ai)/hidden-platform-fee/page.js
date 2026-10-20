"use client";

import { useEffect, useMemo, useState } from "react";

const MAX_FILES = 8;
const MAX_PDF_BYTES = 4 * 1024 * 1024;
const HISTORY_KEY = "platform-fee-history";
const SETTINGS_KEY = "hidden-fee-settings";
const PRICING_SETTINGS_KEY = "ecommerce-fee-settings";
const MAX_HISTORY = 500;

// Starting numbers are examples only. The owner must replace them with the rates in their own account.
const DEFAULT_PLATFORMS = [
  { id: "shopee", name: "Shopee", commissionPct: "6", paymentPct: "2.16", fixedFee: "0" },
  { id: "foodpanda", name: "Foodpanda", commissionPct: "30", paymentPct: "0", fixedFee: "0" },
  { id: "grab", name: "Grab", commissionPct: "30", paymentPct: "0", fixedFee: "0" },
];

const FEE_FIELDS = [
  ["commissionPct", "Commission %"],
  ["paymentPct", "Payment / transaction fee %"],
  ["fixedFee", "Fixed fee per order (RM)"],
];

const TYPE_LABEL = {
  hidden_fee: "Hidden fee",
  above_declared: "Above declared rate",
  fee_rate_increase: "Fee rate increase",
  payout_mismatch: "Payout mismatch",
  fee_total_mismatch: "Fee total mismatch",
  duplicate_fee: "Duplicate fee",
  duplicate_statement: "Duplicate statement",
  missing_declared: "Rates not entered",
  missing_gross: "Sales not found",
  missing_payout: "Payout not found",
  no_fee_lines: "No fee lines",
};

const GROUP_LABEL = {
  declared: "Declared",
  hidden: "Extra",
  adjustment: "Refund / adjustment",
};

const SEV = {
  high: { color: "#b91c1c", bg: "#fee2e2", label: "High" },
  medium: { color: "#b45309", bg: "#fef3c7", label: "Medium" },
  low: { color: "#1d4ed8", bg: "#dbeafe", label: "Info" },
};

const fmt = (n) =>
  Number(n || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

// Shrinks photos before upload: faster upload and faster AI response.
async function fileToPayload(file) {
  if (file.type === "application/pdf") {
    if (file.size > MAX_PDF_BYTES) throw new Error(`${file.name} is too large (PDF limit is 4 MB).`);
    const dataUrl = await readAsDataURL(file);
    return { name: file.name, mimeType: "application/pdf", data: dataUrl.split(",")[1], preview: null };
  }
  if (!file.type.startsWith("image/")) {
    throw new Error(`${file.name}: only images and PDFs are supported.`);
  }
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`${file.name}: could not open this image. Try a JPG or PNG (HEIC is not supported).`);
  }
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { name: file.name, mimeType: "image/jpeg", data: dataUrl.split(",")[1], preview: dataUrl };
}

function buildMessage(d, active) {
  const cur = d.currency || "MYR";
  const items = active.filter((f) => f.kind === "overcharge" || f.kind === "hidden");
  const est = items.reduce((s, f) => s + f.amount, 0);
  const ref = d.statement_id || d.statement_period || d.date || "";
  return [
    `Subject: Please explain charges on my ${d.platform_name} statement ${ref}`.replace(/\s+/g, " ").trim(),
    "",
    `Hi ${d.platform_name} Seller Support,`,
    "",
    "I reviewed this statement and found charges I would like you to explain:",
    ...items.map((f) => `- ${f.message}`),
    "",
    `These items add up to about ${cur} ${est.toFixed(2)}. Could you please explain what each charge is for, and refund any amount that was charged by mistake?`,
    "",
    "Thank you,",
  ].join("\n");
}

export default function HiddenPlatformFeePage() {
  const [files, setFiles] = useState([]);
  const [platforms, setPlatforms] = useState(DEFAULT_PLATFORMS);
  const [tolerance, setTolerance] = useState("10");
  const [docs, setDocs] = useState([]);
  const [meta, setMeta] = useState(null);
  const [dismissed, setDismissed] = useState({});
  const [history, setHistory] = useState([]);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {}

    // Use this page's saved rates, or borrow the ones typed on the pricing page
    try {
      const own = localStorage.getItem(SETTINGS_KEY);
      const pricing = localStorage.getItem(PRICING_SETTINGS_KEY);
      const source = own ? JSON.parse(own) : pricing ? JSON.parse(pricing) : null;
      if (source && Array.isArray(source.platforms) && source.platforms.length) {
        setPlatforms(
          source.platforms.map((p) => ({
            id: p.id,
            name: p.name,
            commissionPct: String(p.commissionPct ?? "0"),
            paymentPct: String(p.paymentPct ?? "0"),
            fixedFee: String(p.fixedFee ?? "0"),
          }))
        );
      }
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ platforms }));
    } catch {}
  }, [loaded, platforms]);

  function persistHistory(next) {
    setHistory(next);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {}
  }

  function updatePlatform(id, key, value) {
    setPlatforms((prev) => prev.map((p) => (p.id === id ? { ...p, [key]: value } : p)));
  }

  async function handleFiles(e) {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    setError("");

    const room = MAX_FILES - files.length;
    if (picked.length > room) setError(`You can add up to ${MAX_FILES} files at a time.`);

    const next = [];
    for (const f of picked.slice(0, Math.max(room, 0))) {
      try {
        next.push(await fileToPayload(f));
      } catch (err) {
        setError(err.message);
      }
    }
    setFiles((prev) => [...prev, ...next]);
  }

  async function handleAnalyze() {
    if (files.length === 0) return;
    setLoading(true);
    setError("");
    setDocs([]);
    setMeta(null);
    setDismissed({});
    setSaved(false);

    try {
      const res = await fetch("/api/hidden-platform-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: files.map(({ mimeType, data }) => ({ mimeType, data })),
          tolerancePct: Number(tolerance),
          platforms: platforms.map((p) => ({
            id: p.id,
            commissionPct: Number(p.commissionPct) || 0,
            paymentPct: Number(p.paymentPct) || 0,
            fixedFee: Number(p.fixedFee) || 0,
          })),
          history,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Request failed");
        return;
      }
      setMeta({ status: data.status, notes: data.notes });
      setDocs(data.documents || []);
    } catch {
      setError("Could not reach the server. Is npm run dev running?");
    } finally {
      setLoading(false);
    }
  }

  function saveToHistory() {
    const known = new Set(history.map((h) => h.docKey));
    const entries = [];
    for (const d of docs) {
      if (known.has(d.doc_key) || d.effective_rate_pct == null) continue;
      entries.push({
        platform: d.platform,
        rate_pct: d.effective_rate_pct,
        date: d.date || "",
        docKey: d.doc_key,
      });
    }
    persistHistory([...history, ...entries].slice(-MAX_HISTORY));
    setSaved(true);
  }

  async function copyMessage(d, active) {
    try {
      await navigator.clipboard.writeText(buildMessage(d, active));
      setCopied(d.id);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setError("Could not copy automatically. Please select the text manually.");
    }
  }

  const summary = useMemo(() => {
    let hidden = 0;
    let overcharge = 0;
    let high = 0;
    let count = 0;
    let gross = 0;
    let fees = 0;
    for (const d of docs) {
      if (d.gross_sales != null && d.fee_lines.length > 0) {
        gross += d.gross_sales;
        fees += d.fee_total;
      }
      for (const f of d.findings) {
        if (dismissed[f.id]) continue;
        count += 1;
        if (f.severity === "high") high += 1;
        if (f.kind === "hidden") hidden += f.amount;
        if (f.kind === "overcharge") overcharge += f.amount;
      }
    }
    return { hidden, overcharge, high, count, gross, fees, rate: gross > 0 ? (fees / gross) * 100 : null };
  }, [docs, dismissed]);

  const currency = docs[0]?.currency || "MYR";
  const card = { flex: 1, minWidth: 150, padding: 12, borderRadius: 8, background: "#f4f4f4", color: "#000" };
  const field = { padding: 8, fontSize: 15, color: "#000", boxSizing: "border-box" };
  const th = { textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #ddd", whiteSpace: "nowrap" };
  const td = { padding: "6px 8px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" };

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1>Smart Pricing: Hidden Platform Fees</h1>
      <p>
        Upload payout or income statements from Shopee, Foodpanda or Grab. The AI reads them and shows
        every fee taken, flags charges that are not part of the rates you entered, and checks that
        the payout adds up. Flags are things to check, not proof, so always confirm with the platform.
      </p>

      <input type="file" accept="image/*,application/pdf" multiple onChange={handleFiles} />

      {files.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {files.map((f, i) => (
            <div key={i} style={{ position: "relative", width: 90, textAlign: "center", fontSize: 12 }}>
              {f.preview ? (
                <img src={f.preview} alt={f.name} style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 6 }} />
              ) : (
                <div style={{ width: 90, height: 90, background: "#eee", color: "#000", borderRadius: 6, display: "grid", placeItems: "center" }}>
                  PDF
                </div>
              )}
              <button
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                style={{ position: "absolute", top: -6, right: -6, borderRadius: "50%", width: 22, height: 22, cursor: "pointer" }}
                aria-label={`Remove ${f.name}`}
              >
                ×
              </button>
              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
            </div>
          ))}
        </div>
      )}

      <h3 style={{ marginBottom: 4 }}>Fee rates the platform told you (recommended)</h3>
      <p style={{ fontSize: 13, opacity: 0.8, marginTop: 0 }}>
        Without these, the page can show every fee but cannot tell which ones are higher than
        expected. The starting numbers are only examples, so replace them with the rates in your own
        seller account (include SST). They are saved in this browser and shared with the pricing page.
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {platforms.map((p) => (
          <div key={p.id} style={{ flex: 1, minWidth: 220, border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
            <strong>{p.name}</strong>
            {FEE_FIELDS.map(([key, label]) => (
              <label key={key} style={{ display: "block", fontSize: 13, marginTop: 8 }}>
                {label}
                <br />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={p[key]}
                  onChange={(e) => updatePlatform(p.id, key, e.target.value)}
                  style={{ ...field, width: "100%" }}
                />
              </label>
            ))}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12, alignItems: "end" }}>
        <label style={{ fontSize: 14 }}>
          Flag when fees are more than
          <br />
          <select value={tolerance} onChange={(e) => setTolerance(e.target.value)} style={field}>
            <option value="5">5% above</option>
            <option value="10">10% above</option>
            <option value="20">20% above</option>
          </select>
        </label>
        <div style={{ fontSize: 14 }}>
          Saved fee history: <strong>{history.length}</strong> statements
          {history.length > 0 && (
            <button onClick={() => persistHistory([])} style={{ marginLeft: 8, cursor: "pointer" }}>
              Clear
            </button>
          )}
        </div>
      </div>

      <button
        onClick={handleAnalyze}
        disabled={loading || files.length === 0}
        style={{
          marginTop: 16,
          padding: "10px 20px",
          fontSize: 16,
          cursor: loading || files.length === 0 ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Checking statements..." : `Check ${files.length || ""} statement${files.length === 1 ? "" : "s"}`}
      </button>

      {error && <p style={{ color: "crimson", marginTop: 16 }}>{error}</p>}

      {meta && meta.status !== "ok" && (
        <p style={{ marginTop: 16, padding: 12, background: "#fff4e5", color: "#000", borderRadius: 6 }}>
          {meta.status === "unreadable" && "The documents were too blurry to read. Try clearer photos. "}
          {meta.status === "not_platform_statement" && "No platform statements were found. "}
          {meta.status === "partial" && "Only some files could be read. "}
          {meta.notes}
        </p>
      )}

      {docs.length > 0 && (
        <>
          <h2 style={{ marginTop: 32 }}>Summary</h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={card}>
              <div style={{ fontSize: 13 }}>Total fees taken</div>
              <strong style={{ fontSize: 20 }}>{currency} {fmt(summary.fees)}</strong>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                {summary.rate === null ? "Sales not found, so no rate" : `${summary.rate.toFixed(1)}% of sales`}
              </div>
            </div>
            <div style={card}>
              <div style={{ fontSize: 13 }}>Hidden / extra fees</div>
              <strong style={{ fontSize: 20, color: summary.hidden > 0 ? "#b45309" : "green" }}>
                {currency} {fmt(summary.hidden)}
              </strong>
            </div>
            <div style={card}>
              <div style={{ fontSize: 13 }}>Potential overcharge</div>
              <strong style={{ fontSize: 20, color: summary.overcharge > 0 ? "#b91c1c" : "green" }}>
                {currency} {fmt(summary.overcharge)}
              </strong>
            </div>
            <div style={card}>
              <div style={{ fontSize: 13 }}>Flags raised</div>
              <strong style={{ fontSize: 20 }}>{summary.count} ({summary.high} high)</strong>
            </div>
          </div>
          <p style={{ fontSize: 13, opacity: 0.8 }}>
            Estimates can overlap when one charge triggers several flags. Dismiss flags that are fine
            and the totals update.
          </p>

          <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={saveToHistory} disabled={saved} style={{ padding: "8px 16px", cursor: saved ? "not-allowed" : "pointer" }}>
              {saved ? "Saved to fee history" : "Save these fee rates to history"}
            </button>
            <span style={{ fontSize: 13 }}>
              Saved rates are used to spot fee increases in future statements. They stay in this browser only.
            </span>
          </div>

          <h2 style={{ marginTop: 32 }}>Statements</h2>
          {docs.map((d) => {
            const active = d.findings.filter((f) => !dismissed[f.id]);
            const hasQuery = active.some((f) => f.kind === "overcharge" || f.kind === "hidden");
            return (
              <div key={d.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <strong>{d.platform_name}</strong>
                    <div style={{ fontSize: 13, opacity: 0.75 }}>
                      {d.statement_id ? `Statement ${d.statement_id} · ` : ""}
                      {d.statement_period || d.date || "No date"} · {d.confidence} confidence
                    </div>
                  </div>
                  <div style={{ fontSize: 13, textAlign: "right" }}>
                    {d.gross_sales != null ? `Sales ${d.currency || "MYR"} ${fmt(d.gross_sales)}` : "Sales not found"}
                    <br />
                    <strong style={{ fontSize: 15 }}>
                      {d.net_payout != null ? `Payout ${d.currency || "MYR"} ${fmt(d.net_payout)}` : "Payout not found"}
                    </strong>
                  </div>
                </div>

                {(d.flags || []).map((fl, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#b45309", marginTop: 4 }}>⚠ {fl}</div>
                ))}

                {d.fee_lines.length > 0 && (
                  <div style={{ overflowX: "auto", marginTop: 10 }}>
                    <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13, minWidth: 420 }}>
                      <thead>
                        <tr>
                          <th style={th}>Fee</th>
                          <th style={th}>Type</th>
                          <th style={th}>Amount</th>
                          <th style={th}>% of sales</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.fee_lines.map((l, i) => (
                          <tr key={i}>
                            <td style={td}>{l.name}</td>
                            <td style={{ ...td, color: l.group === "hidden" ? "#b45309" : "inherit" }}>
                              {GROUP_LABEL[l.group]}
                            </td>
                            <td style={td}>{fmt(l.amount)}</td>
                            <td style={td}>{l.pct_of_gross !== null ? `${l.pct_of_gross.toFixed(2)}%` : "-"}</td>
                          </tr>
                        ))}
                        <tr>
                          <td style={{ ...td, fontWeight: 600 }}>Total fees</td>
                          <td style={td}></td>
                          <td style={{ ...td, fontWeight: 600 }}>{fmt(d.fee_total)}</td>
                          <td style={{ ...td, fontWeight: 600 }}>
                            {d.effective_rate_pct !== null ? `${d.effective_rate_pct.toFixed(2)}%` : "-"}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {d.findings.length === 0 ? (
                  <p style={{ color: "green", marginBottom: 0 }}>No unusual fees found.</p>
                ) : (
                  <div style={{ marginTop: 10 }}>
                    {d.findings.map((f) => {
                      const s = SEV[f.severity];
                      const off = !!dismissed[f.id];
                      return (
                        <div
                          key={f.id}
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "flex-start",
                            padding: "8px 0",
                            borderTop: "1px solid #eee",
                            opacity: off ? 0.45 : 1,
                          }}
                        >
                          <span
                            style={{
                              background: s.bg,
                              color: s.color,
                              fontSize: 12,
                              fontWeight: 600,
                              padding: "2px 8px",
                              borderRadius: 10,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {TYPE_LABEL[f.type] || f.type}
                          </span>
                          <div style={{ flex: 1, fontSize: 14, textDecoration: off ? "line-through" : "none" }}>
                            {f.message}
                            {f.amount > 0 && (
                              <div style={{ fontSize: 12, opacity: 0.75 }}>
                                {f.kind === "hidden" ? "Extra fee" : "Estimated overcharge"}: {d.currency || "MYR"} {fmt(f.amount)}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => setDismissed((p) => ({ ...p, [f.id]: !p[f.id] }))}
                            style={{ cursor: "pointer", fontSize: 12 }}
                          >
                            {off ? "Restore" : "Dismiss"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {hasQuery && (
                  <div style={{ marginTop: 10 }}>
                    <button onClick={() => copyMessage(d, active)} style={{ padding: "8px 16px", cursor: "pointer" }}>
                      {copied === d.id ? "Copied!" : "Copy message to platform"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </main>
  );
}