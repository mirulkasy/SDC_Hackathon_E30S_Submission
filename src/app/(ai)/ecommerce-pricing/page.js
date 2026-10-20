"use client";

import { useEffect, useMemo, useState } from "react";

const MAX_FILES = 8;
const MAX_PDF_BYTES = 4 * 1024 * 1024;
const SETTINGS_KEY = "ecommerce-fee-settings";

// Starting numbers are examples only. The owner must replace them with the rates in their own account.
const DEFAULT_PLATFORMS = [
  { id: "shopee", name: "Shopee", enabled: true, commissionPct: "6", paymentPct: "2.16", fixedFee: "0", promoPct: "0" },
  { id: "foodpanda", name: "Foodpanda", enabled: true, commissionPct: "30", paymentPct: "0", fixedFee: "0", promoPct: "0" },
  { id: "grab", name: "Grab", enabled: true, commissionPct: "30", paymentPct: "0", fixedFee: "0", promoPct: "0" },
];

const FEE_FIELDS = [
  ["commissionPct", "Commission %"],
  ["paymentPct", "Payment / transaction fee %"],
  ["fixedFee", "Fixed fee per order (RM)"],
  ["promoPct", "Seller-funded discount / voucher %"],
];

const TYPE_LABEL = {
  loss_on_platform: "Losing money",
  low_margin: "Low margin",
  impossible_margin: "Margin not possible",
  big_increase: "Big price jump",
  missing_cost: "Missing cost",
  missing_price: "Missing price",
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

function buildPriceList(docs) {
  const lines = ["Suggested prices (RM):", ""];
  for (const d of docs) {
    const parts = d.results
      .filter((r) => r.suggested_price !== null)
      .map((r) => `${r.platform} ${fmt(r.suggested_price)}`);
    if (parts.length) lines.push(`${d.name}: ${parts.join(" | ")}`);
  }
  return lines.join("\n");
}

export default function EcommercePricingPage() {
  const [files, setFiles] = useState([]);
  const [productsText, setProductsText] = useState("");
  const [platforms, setPlatforms] = useState(DEFAULT_PLATFORMS);
  const [target, setTarget] = useState("20");
  const [packaging, setPackaging] = useState("0");
  const [roundMode, setRoundMode] = useState("10");
  const [docs, setDocs] = useState([]);
  const [meta, setMeta] = useState(null);
  const [dismissed, setDismissed] = useState({});
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Remember the fee settings so the owner only types them once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (Array.isArray(s.platforms) && s.platforms.length) setPlatforms(s.platforms);
        if (s.target !== undefined) setTarget(String(s.target));
        if (s.packaging !== undefined) setPackaging(String(s.packaging));
        if (s.roundMode) setRoundMode(s.roundMode);
      }
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ platforms, target, packaging, roundMode }));
    } catch {}
  }, [loaded, platforms, target, packaging, roundMode]);

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
    const enabled = platforms.filter((p) => p.enabled);
    if (enabled.length === 0) {
      setError("Please select at least one platform.");
      return;
    }
    if (files.length === 0 && !productsText.trim()) {
      setError("Please upload a menu or price list, or type your products.");
      return;
    }
    setLoading(true);
    setError("");
    setDocs([]);
    setMeta(null);
    setDismissed({});
    setCopied(false);

    try {
      const res = await fetch("/api/ecommerce-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: files.map(({ mimeType, data }) => ({ mimeType, data })),
          productsText,
          targetMarginPct: Number(target) || 0,
          packagingCost: Number(packaging) || 0,
          roundMode,
          platforms: enabled.map((p) => ({
            id: p.id,
            name: p.name,
            commissionPct: Number(p.commissionPct) || 0,
            paymentPct: Number(p.paymentPct) || 0,
            fixedFee: Number(p.fixedFee) || 0,
            promoPct: Number(p.promoPct) || 0,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Request failed");
        return;
      }
      setMeta({ status: data.status, notes: data.notes });
      setDocs(data.products || []);
    } catch {
      setError("Could not reach the server. Is npm run dev running?");
    } finally {
      setLoading(false);
    }
  }

  async function copyPriceList() {
    try {
      await navigator.clipboard.writeText(buildPriceList(docs));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy automatically. Please select the text manually.");
    }
  }

  const summary = useMemo(() => {
    let losing = 0;
    let lossPerOrder = 0;
    let high = 0;
    let count = 0;
    let incSum = 0;
    let incCount = 0;
    const bestCount = {};
    for (const d of docs) {
      for (const f of d.findings) {
        if (dismissed[f.id]) continue;
        count += 1;
        if (f.severity === "high") high += 1;
        if (f.kind === "loss") {
          losing += 1;
          lossPerOrder += f.amount;
        }
      }
      for (const r of d.results) {
        if (r.change_pct !== null && r.change_pct !== undefined) {
          incSum += r.change_pct;
          incCount += 1;
        }
      }
      if (d.best_platform) bestCount[d.best_platform] = (bestCount[d.best_platform] || 0) + 1;
    }
    const bestEntry = Object.entries(bestCount).sort((a, b) => b[1] - a[1])[0];
    return {
      losing,
      lossPerOrder,
      high,
      count,
      avgIncrease: incCount ? incSum / incCount : null,
      best: bestEntry ? bestEntry[0] : null,
    };
  }, [docs, dismissed]);

  const card = { flex: 1, minWidth: 150, padding: 12, borderRadius: 8, background: "#f4f4f4", color: "#000" };
  const field = { padding: 8, fontSize: 15, color: "#000", boxSizing: "border-box" };
  const th = { textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #ddd", whiteSpace: "nowrap" };
  const td = { padding: "6px 8px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" };

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1>Smart Pricing: E-Commerce Platforms</h1>
      <p>
        Upload a menu, price list or supplier invoice (or type your products). The AI reads them and
        works out what to charge on Shopee, Foodpanda and Grab so platform fees do not eat your
        profit. Suggestions are a guide, so always check the numbers against your own seller account.
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

      <h3 style={{ marginBottom: 4 }}>Products (optional if you upload a file)</h3>
      <textarea
        value={productsText}
        onChange={(e) => setProductsText(e.target.value)}
        placeholder={"One per line, for example:\nNasi lemak ayam - cost RM 3.50 - sell RM 8.00\nTeh tarik - cost RM 0.80 - sell RM 3.00"}
        rows={4}
        style={{ ...field, width: "100%", fontSize: 16, padding: 12 }}
      />

      <h3 style={{ marginBottom: 4 }}>Platforms and fees</h3>
      <p style={{ fontSize: 13, opacity: 0.8, marginTop: 0 }}>
        The starting numbers are only examples. Platform fees change often, so replace them with the
        rates in your own seller account (include SST). They are saved in this browser.
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {platforms.map((p) => (
          <div
            key={p.id}
            style={{ flex: 1, minWidth: 220, border: "1px solid #ddd", borderRadius: 8, padding: 12, opacity: p.enabled ? 1 : 0.5 }}
          >
            <label style={{ fontSize: 15 }}>
              <input
                type="checkbox"
                checked={p.enabled}
                onChange={(e) => updatePlatform(p.id, "enabled", e.target.checked)}
                style={{ marginRight: 8 }}
              />
              <strong>{p.name}</strong>
            </label>
            {FEE_FIELDS.map(([key, label]) => (
              <label key={key} style={{ display: "block", fontSize: 13, marginTop: 8 }}>
                {label}
                <br />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={p[key]}
                  disabled={!p.enabled}
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
          Target profit margin %
          <br />
          <input
            type="number"
            min="0"
            max="90"
            step="1"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            style={{ ...field, width: 120 }}
          />
        </label>
        <label style={{ fontSize: 14 }}>
          Packaging cost per order (RM)
          <br />
          <input
            type="number"
            min="0"
            step="0.05"
            value={packaging}
            onChange={(e) => setPackaging(e.target.value)}
            style={{ ...field, width: 120 }}
          />
        </label>
        <label style={{ fontSize: 14 }}>
          Round prices
          <br />
          <select value={roundMode} onChange={(e) => setRoundMode(e.target.value)} style={field}>
            <option value="none">Exact (to the sen)</option>
            <option value="10">Up to nearest RM 0.10</option>
            <option value="90">Up to the next .90</option>
          </select>
        </label>
      </div>

      <button
        onClick={handleAnalyze}
        disabled={loading || (files.length === 0 && !productsText.trim())}
        style={{
          marginTop: 16,
          padding: "10px 20px",
          fontSize: 16,
          cursor: loading || (files.length === 0 && !productsText.trim()) ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Working out prices..." : "Suggest prices"}
      </button>

      {error && <p style={{ color: "crimson", marginTop: 16 }}>{error}</p>}

      {meta && meta.status !== "ok" && (
        <p style={{ marginTop: 16, padding: 12, background: "#fff4e5", color: "#000", borderRadius: 6 }}>
          {meta.status === "unreadable" && "The documents were too blurry to read. Try clearer photos. "}
          {meta.status === "not_product_document" && "No products or prices were found. "}
          {meta.status === "partial" && "Only some files could be read. "}
          {meta.notes}
        </p>
      )}

      {docs.length > 0 && (
        <>
          <h2 style={{ marginTop: 32 }}>Summary</h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={card}>
              <div style={{ fontSize: 13 }}>Products losing money</div>
              <strong style={{ fontSize: 20, color: summary.losing > 0 ? "#b91c1c" : "green" }}>
                {summary.losing}
              </strong>
              {summary.losing > 0 && (
                <div style={{ fontSize: 12, opacity: 0.75 }}>up to RM {fmt(summary.lossPerOrder)} lost per order in total</div>
              )}
            </div>
            <div style={card}>
              <div style={{ fontSize: 13 }}>Average suggested change</div>
              <strong style={{ fontSize: 20 }}>
                {summary.avgIncrease === null
                  ? "-"
                  : `${summary.avgIncrease > 0 ? "+" : ""}${summary.avgIncrease.toFixed(0)}%`}
              </strong>
            </div>
            <div style={card}>
              <div style={{ fontSize: 13 }}>Flags raised</div>
              <strong style={{ fontSize: 20 }}>{summary.count} ({summary.high} high)</strong>
            </div>
            <div style={card}>
              <div style={{ fontSize: 13 }}>Best platform overall</div>
              <strong style={{ fontSize: 16 }}>{summary.best || "-"}</strong>
            </div>
          </div>
          <p style={{ fontSize: 13, opacity: 0.8 }}>
            Each product is checked on every platform you selected, so one problem can raise several
            flags. Dismiss flags that are fine and the totals update. Margin means profit as a share
            of the listed price.
          </p>

          <div style={{ marginTop: 12 }}>
            <button onClick={copyPriceList} style={{ padding: "8px 16px", cursor: "pointer" }}>
              {copied ? "Copied!" : "Copy new price list"}
            </button>
          </div>

          <h2 style={{ marginTop: 32 }}>Products</h2>
          {docs.map((d) => {
            return (
              <div key={d.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <strong>{d.name}</strong>
                    <div style={{ fontSize: 13, opacity: 0.75 }}>
                      {d.category ? `${d.category} · ` : ""}
                      {d.confidence} confidence
                    </div>
                  </div>
                  <div style={{ fontSize: 13, textAlign: "right" }}>
                    {d.cost_price != null ? `Cost RM ${fmt(d.cost_price)}` : "Cost unknown"}
                    {d.total_cost != null && d.total_cost !== d.cost_price ? ` (RM ${fmt(d.total_cost)} with packaging)` : ""}
                    <br />
                    {d.current_price != null ? `Selling at RM ${fmt(d.current_price)}` : "Current price unknown"}
                  </div>
                </div>

                {(d.flags || []).map((fl, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#b45309", marginTop: 4 }}>⚠ {fl}</div>
                ))}

                {d.results.length > 0 && (
                  <div style={{ overflowX: "auto", marginTop: 10 }}>
                    <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13, minWidth: 560 }}>
                      <thead>
                        <tr>
                          <th style={th}>Platform</th>
                          <th style={th}>Suggested price</th>
                          <th style={th}>Change</th>
                          <th style={th}>Profit at suggested</th>
                          <th style={th}>Profit now</th>
                          <th style={th}>Margin now</th>
                          <th style={th}>Break-even</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.results.map((r) => (
                          <tr key={r.platform_id}>
                            <td style={td}>
                              {r.platform}
                              {d.best_platform === r.platform ? " ★" : ""}
                            </td>
                            <td style={{ ...td, fontWeight: 600 }}>
                              {r.suggested_price !== null ? `RM ${fmt(r.suggested_price)}` : "Not possible"}
                            </td>
                            <td style={td}>
                              {r.change_pct !== null ? `${r.change_pct > 0 ? "+" : ""}${r.change_pct.toFixed(0)}%` : "-"}
                            </td>
                            <td style={td}>
                              {r.profit_at_suggested !== null ? `RM ${fmt(r.profit_at_suggested)}` : "-"}
                            </td>
                            <td style={{ ...td, color: r.current_profit !== null && r.current_profit < 0 ? "#b91c1c" : "inherit" }}>
                              {r.current_profit !== null ? `RM ${fmt(r.current_profit)}` : "-"}
                            </td>
                            <td style={td}>
                              {r.current_margin_pct !== null ? `${r.current_margin_pct.toFixed(0)}%` : "-"}
                            </td>
                            <td style={td}>{r.break_even !== null ? `RM ${fmt(r.break_even)}` : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                      ★ = platform where you keep the most profit at your current price.
                    </div>
                  </div>
                )}

                {d.findings.length === 0 ? (
                  <p style={{ color: "green", marginBottom: 0 }}>Prices look healthy on the selected platforms.</p>
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
                              <div style={{ fontSize: 12, opacity: 0.75 }}>Loss per order: RM {fmt(f.amount)}</div>
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
              </div>
            );
          })}
        </>
      )}
    </main>
  );
}