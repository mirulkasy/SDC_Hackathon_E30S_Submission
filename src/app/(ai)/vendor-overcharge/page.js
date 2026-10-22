"use client";

import { useEffect, useMemo, useState } from "react";

const MAX_FILES = 8;
const MAX_PDF_BYTES = 8 * 1024 * 1024;
const HISTORY_KEY = "vendor-price-history";
const MAX_HISTORY = 500;


const TYPE_LABEL = {
  above_po_price: "Price higher than agreed",
  over_quantity: "More than ordered",
  forbidden_fee: "Fee not allowed",
  fee_cap_breach: "Fee over the limit",
  fee_not_on_po: "Fee not on the PO",
  item_not_on_po: "Item not on the PO",
  discount_short: "Discount missing",
  freight_above_agreed: "Freight above agreed",
  tax_on_extras: "Extra tax",
  tax_rate_differs: "Tax rate differs",
  math_error: "Maths mistake",
  subtotal_mismatch: "Subtotal does not add up",
  total_mismatch: "Total does not add up",
  duplicate_line: "Duplicate line",
  duplicate_invoice: "Duplicate invoice",
  price_increase: "Price went up",
  cheaper_elsewhere: "Cheaper elsewhere",
  no_baseline: "Nothing to compare with",
};

const SEV = {
  high: { color: "#b91c1c", bg: "#fee2e2", label: "High" },
  medium: { color: "#b45309", bg: "#fef3c7", label: "Medium" },
  low: { color: "#1d4ed8", bg: "#dbeafe", label: "Info" },
};

const fmt = (n) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}


async function fileToPayload(file) {
  if (file.type === "application/pdf") {
    if (file.size > MAX_PDF_BYTES) throw new Error(`${file.name} is too large (PDF limit is 8 MB).`);
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
  const cur = d.currency;
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
  const [docs, setDocs] = useState([]);
  const [baselines, setBaselines] = useState([]);
  const [extracted, setExtracted] = useState(null);
  const [answers, setAnswers] = useState({ fields: {}, lines: {}, agreed: {} });
  const [meta, setMeta] = useState(null);
  const [dismissed, setDismissed] = useState({});
  const [history, setHistory] = useState([]);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState("");
  const [loading, setLoading] = useState(false);
  const [rechecking, setRechecking] = useState(false);
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

  // Round 1: the AI reads the files
  async function handleAnalyze() {
    if (files.length === 0) return;
    setLoading(true);
    setError("");
    setDocs([]);
    setBaselines([]);
    setExtracted(null);
    setAnswers({ fields: {}, lines: {}, agreed: {} });
    setMeta(null);
    setDismissed({});
    setSaved(false);

    try {
      const res = await fetch("/api/vendor-overcharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: files.map(({ mimeType, data }) => ({ mimeType, data })),
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
      setBaselines(data.baselines || []);
      setExtracted(data.extracted || null);
    } catch {
      setError("Could not reach the server. Is npm run dev running?");
    } finally {
      setLoading(false);
    }
  }

  
  async function handleRecheck() {
    if (!extracted) return;
    setRechecking(true);
    setError("");
    try {
      const res = await fetch("/api/vendor-overcharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extracted, answers, history }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Request failed");
        return;
      }
      setDocs(data.documents || []);
      setBaselines(data.baselines || []);
      setDismissed({});
      setSaved(false);
    } catch {
      setError("Could not reach the server. Is npm run dev running?");
    } finally {
      setRechecking(false);
    }
  }

  
  function setFieldAnswer(inv, key, value) {
    setAnswers((p) => ({ ...p, fields: { ...p.fields, [inv]: { ...(p.fields[inv] || {}), [key]: value } } }));
  }
  function setLineAnswer(inv, index, key, value) {
    const id = `${inv}:${index}`;
    setAnswers((p) => ({ ...p, lines: { ...p.lines, [id]: { ...(p.lines[id] || {}), [key]: value } } }));
  }
  function setAgreedAnswer(key, name, value) {
    setAnswers((p) => ({ ...p, agreed: { ...p.agreed, [key]: { name, price: value } } }));
  }

  function saveToHistory() {
    const known = new Set(history.map((h) => h.docKey));
    const entries = [];
    for (const d of docs) {
      if (known.has(d.doc_key)) continue;
      for (const li of d.line_items) {
        if (li.kind === "product" && li.effective_unit_price != null && li.normalized_name) {
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
        if (dismissed[f.id] || f.type === "no_baseline") continue;
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
  const noBaseline = docs.length > 0 && baselines.length === 0;
  const card = { flex: 1, minWidth: 150, padding: 12, borderRadius: 8, background: "#f4f4f4", color: "#000" };
  const field = { padding: 8, fontSize: 15, color: "#000", boxSizing: "border-box" };

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1>Vendor Overcharge Check</h1>
      <p>Find out if a vendor charged you more than you agreed. Three simple steps:</p>
      <ol style={{ lineHeight: 1.6 }}>
        <li>
          Upload the <strong>invoice</strong>. Also upload the <strong>purchase order (PO)</strong> or contract. That is
          how I catch prices and fees you never agreed to. They can be in the same PDF.
        </li>
        <li>Press <strong>Check</strong>.</li>
        <li>Answer my questions if I could not find something, then send the ready-made message to your vendor.</li>
      </ol>
      <p style={{ fontSize: 13, opacity: 0.8 }}>
        Flags are things to check, not proof, so always confirm with your vendor.
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

      <div style={{ marginTop: 16, fontSize: 14 }}>
        Saved price history: <strong>{history.length}</strong> prices
        {history.length > 0 && (
          <button onClick={() => persistHistory([])} style={{ marginLeft: 8, cursor: "pointer" }}>
            Clear
          </button>
        )}
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
        {loading ? "Checking..." : "Check my documents"}
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

      {noBaseline && (
        <p style={{ marginTop: 16, padding: 12, background: "#eff6ff", color: "#000", borderRadius: 6 }}>
          💡 I could only check the invoice by itself. Upload the purchase order or contract and check again, or tell me
          the prices you agreed in the questions below.
        </p>
      )}

      {docs.length > 0 && (
        <>
          <h2 style={{ marginTop: 32 }}>Summary</h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={card}>
              <div style={{ fontSize: 13 }}>Possible overcharge</div>
              <strong style={{ fontSize: 20, color: summary.overcharge > 0 ? "#b91c1c" : "green" }}>
                {currency} {fmt(summary.overcharge)}
              </strong>
            </div>
            <div style={card}>
              <div style={{ fontSize: 13 }}>Possible savings elsewhere</div>
              <strong style={{ fontSize: 20 }}>{currency} {fmt(summary.saving)}</strong>
            </div>
            <div style={card}>
              <div style={{ fontSize: 13 }}>Things to check</div>
              <strong style={{ fontSize: 20 }}>{summary.count} ({summary.high} high)</strong>
            </div>
            <div style={card}>
              <div style={{ fontSize: 13 }}>Vendors to ask</div>
              <strong style={{ fontSize: 16 }}>{summary.vendors.length ? summary.vendors.join(", ") : "None"}</strong>
            </div>
          </div>
          <p style={{ fontSize: 13, opacity: 0.8 }}>
            One mistake can raise more than one flag. Dismiss flags that are fine and the totals update.
          </p>

          <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={saveToHistory} disabled={saved} style={{ padding: "8px 16px", cursor: saved ? "not-allowed" : "pointer" }}>
              {saved ? "Saved to price history" : "Save these prices to history"}
            </button>
            <span style={{ fontSize: 13 }}>
              Saved prices help spot price increases in future invoices. They stay in this browser only.
            </span>
          </div>

          <h2 style={{ marginTop: 32 }}>Invoices</h2>
          {docs.map((d) => {
            const active = d.findings.filter((f) => !dismissed[f.id]);
            const hasOver = active.some((f) => f.kind === "overcharge");
            const r = d.reconcile;
            return (
              <div key={d.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <strong>{d.vendor || "Unknown vendor"}</strong>
                    <div style={{ fontSize: 13, opacity: 0.75 }}>
                      {d.invoice_number ? `Invoice ${d.invoice_number} · ` : ""}
                      {d.date || "No date"} · {d.confidence} confidence
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.75 }}>
                      {d.compared_with.length
                        ? `Compared with: ${d.compared_with.join(", ")}`
                        : "Not compared with a purchase order"}
                    </div>
                  </div>
                  <strong>
                    {d.total_amount != null ? `${d.currency} ${fmt(d.total_amount)}` : "Total not found"}
                  </strong>
                </div>

                {(d.flags || []).map((fl, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#b45309", marginTop: 4 }}>⚠ {fl}</div>
                ))}

                {d.questions.length > 0 && (
                  <div style={{ marginTop: 10, padding: 12, background: "#eff6ff", color: "#000", borderRadius: 6 }}>
                    <strong>🤔 I need a bit more information</strong>
                    {d.questions.map((q) => (
                      <div key={q.id} style={{ marginTop: 10, fontSize: 14 }}>
                        <div>{q.text}</div>

                        {q.kind === "fields" && (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                            {q.fields.map((f) => (
                              <label key={f.key} style={{ fontSize: 13 }}>
                                {f.label}
                                <br />
                                <input
                                  type={f.type}
                                  step={f.type === "number" ? "0.01" : undefined}
                                  value={answers.fields[q.invoice]?.[f.key] ?? ""}
                                  onChange={(e) => setFieldAnswer(q.invoice, f.key, e.target.value)}
                                  style={field}
                                />
                              </label>
                            ))}
                          </div>
                        )}

                        {q.kind === "lines" &&
                          q.items.map((it) => (
                            <div key={it.index} style={{ marginTop: 6, fontSize: 13 }}>
                              {it.name} (line total {d.currency} {fmt(it.total)}){" "}
                              <input
                                type="number"
                                min="0"
                                step="1"
                                placeholder="Quantity"
                                value={answers.lines[`${q.invoice}:${it.index}`]?.quantity ?? ""}
                                onChange={(e) => setLineAnswer(q.invoice, it.index, "quantity", e.target.value)}
                                style={{ ...field, width: 100 }}
                              />{" "}
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Price each"
                                value={answers.lines[`${q.invoice}:${it.index}`]?.unit ?? ""}
                                onChange={(e) => setLineAnswer(q.invoice, it.index, "unit", e.target.value)}
                                style={{ ...field, width: 110 }}
                              />
                            </div>
                          ))}

                        {q.kind === "agreed" &&
                          q.items.map((it) => (
                            <div key={it.key} style={{ marginTop: 6, fontSize: 13 }}>
                              {it.name}: billed {d.currency} {fmt(it.billed)} each. Agreed price:{" "}
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Not sure"
                                value={answers.agreed[it.key]?.price ?? ""}
                                onChange={(e) => setAgreedAnswer(it.key, it.name, e.target.value)}
                                style={{ ...field, width: 110 }}
                              />
                            </div>
                          ))}
                      </div>
                    ))}

                    <button
                      onClick={handleRecheck}
                      disabled={rechecking}
                      style={{ marginTop: 12, padding: "8px 16px", cursor: rechecking ? "not-allowed" : "pointer" }}
                    >
                      {rechecking ? "Checking..." : "Check again with my answers"}
                    </button>
                  </div>
                )}

                {r && (
                  <div style={{ marginTop: 10, padding: 10, background: "#f4f4f4", color: "#000", borderRadius: 6, fontSize: 14 }}>
                    You were billed <strong>{d.currency} {fmt(r.billed)}</strong>. The purchase order allows{" "}
                    <strong>{d.currency} {fmt(r.authorized)}</strong>. Difference:{" "}
                    <strong style={{ color: r.difference > 0 ? "#b91c1c" : "green" }}>
                      {d.currency} {fmt(r.difference)}
                    </strong>
                    <details style={{ marginTop: 6, fontSize: 13 }}>
                      <summary style={{ cursor: "pointer" }}>How the difference adds up</summary>
                      <div>Overcharges found below: {d.currency} {fmt(r.explained)}</div>
                      <div>Allowed by the contract (for example a fee up to its limit): {d.currency} {fmt(r.allowed)}</div>
                      <div>Not explained yet: {d.currency} {fmt(r.unexplained)}</div>
                      {Math.abs(r.unexplained) > 0.05 && (
                        <div style={{ marginTop: 4, opacity: 0.8 }}>
                          Some of the difference is not explained. Look at the flags marked Info or Check.
                        </div>
                      )}
                    </details>
                  </div>
                )}

                {d.findings.length === 0 ? (
                  <p style={{ color: "green", marginBottom: 0 }}>No unusual charges found.</p>
                ) : (
                  <div style={{ marginTop: 10 }}>
                    {d.findings.map((f) => {
                      const s = SEV[f.severity] || SEV.medium;
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
                              <div style={{ fontSize: 12, opacity: 0.8 }}>
                                {f.kind === "saving" ? "Possible saving" : "Estimated overcharge"}: {d.currency} {fmt(f.amount)}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => setDismissed((p) => ({ ...p, [f.id]: !p[f.id] }))}
                            style={{ cursor: "pointer", fontSize: 12 }}
                          >
                            {off ? "Restore" : f.type === "item_not_on_po" ? "I ordered this" : "Dismiss"}
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