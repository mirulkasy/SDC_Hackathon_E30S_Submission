"use client";

import { useEffect, useMemo, useState } from "react";

const MAX_FILES = 8;
const MAX_PDF_BYTES = 4 * 1024 * 1024;
const HISTORY_KEY = "vendor-price-history";
const MAX_HISTORY = 500;

const TYPE_LABEL = {
  above_agreed_price: "Above agreed price",
  price_increase: "Price increase",
  cheaper_elsewhere: "Cheaper elsewhere",
  math_error: "Maths error",
  subtotal_mismatch: "Subtotal mismatch",
  total_mismatch: "Total mismatch",
  tax_mismatch: "Tax mismatch",
  duplicate_line: "Duplicate line",
  duplicate_invoice: "Duplicate invoice",
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
  const over = active.filter((f) => f.kind === "overcharge");
  const est = over.reduce((s, f) => s + f.amount, 0);
  return [
    `Subject: Please check invoice ${d.invoice_number || ""}${d.date ? ` dated ${d.date}` : ""}`.replace(/\s+/g, " ").trim(),
    "",
    `Hi ${d.vendor || "team"},`,
    "",
    "We reviewed this invoice and found items we would like you to check:",
    ...over.map((f) => `- ${f.message}`),
    "",
    `The estimated difference is up to ${cur} ${est.toFixed(2)}. Could you please review it and send a corrected invoice or credit note?`,
    "",
    "Thank you,",
  ].join("\n");
}

export default function VendorOverchargePage() {
  const [files, setFiles] = useState([]);
  const [agreed, setAgreed] = useState("");
  const [tolerance, setTolerance] = useState("10");
  const [taxRate, setTaxRate] = useState("");
  const [docs, setDocs] = useState([]);
  const [meta, setMeta] = useState(null);
  const [dismissed, setDismissed] = useState({});
  const [history, setHistory] = useState([]);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  }, []);

  function persistHistory(next) {
    setHistory(next);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {}
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
      const res = await fetch("/api/vendor-overcharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: files.map(({ mimeType, data }) => ({ mimeType, data })),
          agreedPrices: agreed,
          tolerancePct: Number(tolerance),
          taxRate: taxRate === "" ? null : Number(taxRate),
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
      if (known.has(d.doc_key)) continue;
      for (const li of d.line_items) {
        if (li.effective_unit_price != null && li.normalized_name) {
          entries.push({
            vendor: d.vendor || "",
            item: li.normalized_name,
            unit_price: li.effective_unit_price,
            date: d.date || "",
            docKey: d.doc_key,
          });
        }
      }
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
    let overcharge = 0;
    let saving = 0;
    let high = 0;
    let count = 0;
    const vendors = new Set();
    for (const d of docs) {
      for (const f of d.findings) {
        if (dismissed[f.id]) continue;
        count += 1;
        if (f.severity === "high") high += 1;
        if (f.kind === "overcharge") {
          overcharge += f.amount;
          vendors.add(d.vendor || "Unknown vendor");
        }
        if (f.kind === "saving") saving += f.amount;
      }
    }
    return { overcharge, saving, high, count, vendors: [...vendors] };
  }, [docs, dismissed]);

  const currency = docs[0]?.currency || "MYR";
  const card = { flex: 1, minWidth: 150, padding: 12, borderRadius: 8, background: "#f4f4f4", color: "#000" };
  const field = { padding: 8, fontSize: 15, color: "#000", boxSizing: "border-box" };

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1>Unusual Flag: Vendor Overcharge</h1>
      <p>
        Upload vendor invoices. The AI reads them and flags unusual charges: prices above what you
        agreed, price increases, maths mistakes, wrong tax and duplicate bills. Flags are things to
        check, not proof, so always confirm with your vendor.
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

      <h3 style={{ marginBottom: 4 }}>Agreed prices (optional)</h3>
      <textarea
        value={agreed}
        onChange={(e) => setAgreed(e.target.value)}
        placeholder={"One per line, for example:\nPaper cup 16oz - RM 0.45 each\nWhite sugar 1kg - RM 3.20 each"}
        rows={4}
        style={{ ...field, width: "100%", fontSize: 16, padding: 12 }}
      />

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12, alignItems: "end" }}>
        <label style={{ fontSize: 14 }}>
          Flag when price is more than
          <br />
          <select value={tolerance} onChange={(e) => setTolerance(e.target.value)} style={field}>
            <option value="5">5% above</option>
            <option value="10">10% above</option>
            <option value="20">20% above</option>
          </select>
        </label>
        <label style={{ fontSize: 14 }}>
          Expected tax rate % (optional)
          <br />
          <input
            type="number"
            min="0"
            step="0.5"
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
            placeholder="e.g. 8"
            style={{ ...field, width: 120 }}
          />
        </label>
        <div style={{ fontSize: 14 }}>
          Saved price history: <strong>{history.length}</strong> prices
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
        {loading ? "Checking invoices..." : `Check ${files.length || ""} invoice${files.length === 1 ? "" : "s"}`}
      </button>

      {error && <p style={{ color: "crimson", marginTop: 16 }}>{error}</p>}

      {meta && meta.status !== "ok" && (
        <p style={{ marginTop: 16, padding: 12, background: "#fff4e5", color: "#000", borderRadius: 6 }}>
          {meta.status === "unreadable" && "The documents were too blurry to read. Try clearer photos. "}
          {meta.status === "not_financial_document" && "No invoices or bills were found. "}
          {meta.status === "partial" && "Only some files could be read. "}
          {meta.notes}
        </p>
      )}

      {docs.length > 0 && (
        <>
          <h2 style={{ marginTop: 32 }}>Summary</h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={card}>
              <div style={{ fontSize: 13 }}>Potential overcharge</div>
              <strong style={{ fontSize: 20, color: summary.overcharge > 0 ? "#b91c1c" : "green" }}>
                {currency} {fmt(summary.overcharge)}
              </strong>
            </div>
            <div style={card}>
              <div style={{ fontSize: 13 }}>Possible savings elsewhere</div>
              <strong style={{ fontSize: 20 }}>{currency} {fmt(summary.saving)}</strong>
            </div>
            <div style={card}>
              <div style={{ fontSize: 13 }}>Flags raised</div>
              <strong style={{ fontSize: 20 }}>{summary.count} ({summary.high} high)</strong>
            </div>
            <div style={card}>
              <div style={{ fontSize: 13 }}>Vendors to query</div>
              <strong style={{ fontSize: 16 }}>{summary.vendors.length ? summary.vendors.join(", ") : "None"}</strong>
            </div>
          </div>
          <p style={{ fontSize: 13, opacity: 0.8 }}>
            Estimates can overlap when one mistake triggers several flags. Dismiss flags that are
            fine and the totals update.
          </p>

          <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={saveToHistory} disabled={saved} style={{ padding: "8px 16px", cursor: saved ? "not-allowed" : "pointer" }}>
              {saved ? "Saved to price history" : "Save these prices to history"}
            </button>
            <span style={{ fontSize: 13 }}>
              Saved prices are used to spot price increases in future invoices. They stay in this browser only.
            </span>
          </div>

          <h2 style={{ marginTop: 32 }}>Invoices</h2>
          {docs.map((d) => {
            const active = d.findings.filter((f) => !dismissed[f.id]);
            const hasOver = active.some((f) => f.kind === "overcharge");
            return (
              <div key={d.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <strong>{d.vendor || "Unknown vendor"}</strong>
                    <div style={{ fontSize: 13, opacity: 0.75 }}>
                      {d.invoice_number ? `Invoice ${d.invoice_number} · ` : ""}
                      {d.date || "No date"} · {d.confidence} confidence
                    </div>
                  </div>
                  <strong>{d.currency || "MYR"} {fmt(d.total_amount)}</strong>
                </div>

                {(d.flags || []).map((fl, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#b45309", marginTop: 4 }}>⚠ {fl}</div>
                ))}

                {d.findings.length === 0 ? (
                  <p style={{ color: "green", marginBottom: 0 }}>No unusual charges found.</p>
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
                                {f.kind === "saving" ? "Possible saving" : "Estimated overcharge"}: {d.currency || "MYR"} {fmt(f.amount)}
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

                {hasOver && (
                  <div style={{ marginTop: 10 }}>
                    <button onClick={() => copyMessage(d, active)} style={{ padding: "8px 16px", cursor: "pointer" }}>
                      {copied === d.id ? "Copied!" : "Copy message to vendor"}
                    </button>
                  </div>
                )}

                {d.line_items.length > 0 && (
                  <details style={{ fontSize: 13, marginTop: 10 }}>
                    <summary style={{ cursor: "pointer" }}>{d.line_items.length} line items</summary>
                    {d.line_items.map((li, i) => (
                      <div key={i}>
                        {li.quantity != null ? `${li.quantity} × ` : ""}
                        {li.name}
                        {li.effective_unit_price != null ? ` @ ${fmt(li.effective_unit_price)}` : ""} = {fmt(li.line_total)}
                        {li.agreed_unit_price != null ? ` (agreed ${fmt(li.agreed_unit_price)})` : ""}
                      </div>
                    ))}
                  </details>
                )}
              </div>
            );
          })}
        </>
      )}
    </main>
  );
}