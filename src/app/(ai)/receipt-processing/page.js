"use client";

import { useMemo, useState } from "react";

const MAX_FILES = 8;
const MAX_PDF_BYTES = 4 * 1024 * 1024;

const CATEGORIES = [
  ["sales_income", "Sales income"],
  ["inventory_stock", "Inventory / stock"],
  ["supplies", "Supplies"],
  ["food_beverage", "Food & beverage"],
  ["rent", "Rent"],
  ["utilities", "Utilities"],
  ["salaries", "Salaries"],
  ["marketing", "Marketing"],
  ["transport", "Transport"],
  ["equipment", "Equipment"],
  ["professional_fees", "Professional fees"],
  ["taxes_fees", "Taxes & fees"],
  ["bank_charges", "Bank charges"],
  ["other", "Other"],
];
const LABEL = Object.fromEntries(CATEGORIES);

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

const needsReview = (r) => r.confidence !== "high" || (r.flags && r.flags.length > 0);

function csvCell(v) {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function downloadCsv(rows) {
  const header = [
    "Date", "Merchant", "Type", "Flow", "Category", "Currency",
    "Subtotal", "Tax", "Total", "Payment method", "Confidence", "Flags",
  ];
  const lines = rows.map((r) =>
    [
      r.date, r.merchant, r.doc_type, r.flow, LABEL[r.category] || r.category, r.currency,
      r.subtotal, r.tax_amount, r.total_amount, r.payment_method, r.confidence,
      (r.flags || []).join("; "),
    ].map(csvCell).join(",")
  );
  const csv = [header.map(csvCell).join(","), ...lines].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "cash-flow.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReceiptProcessingPage() {
  const [files, setFiles] = useState([]);
  const [note, setNote] = useState("");
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    setRows([]);
    setMeta(null);

    try {
      const res = await fetch("/api/receipt-processing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: files.map(({ mimeType, data }) => ({ mimeType, data })),
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Request failed");
        return;
      }
      setMeta({ status: data.status, notes: data.notes });
      setRows(data.documents || []);
    } catch {
      setError("Could not reach the server. Is npm run dev running?");
    } finally {
      setLoading(false);
    }
  }

  const updateRow = (id, patch) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeRow = (id) => setRows((prev) => prev.filter((r) => r.id !== id));

  const summary = useMemo(() => {
    let expense = 0;
    let income = 0;
    const byCat = {};
    const currencies = new Set();
    for (const r of rows) {
      const amt = Number(r.total_amount) || 0;
      if (r.currency) currencies.add(r.currency);
      if (r.flow === "income") income += amt;
      else {
        expense += amt;
        byCat[r.category] = (byCat[r.category] || 0) + amt;
      }
    }
    return {
      expense,
      income,
      net: income - expense,
      byCat: Object.entries(byCat).sort((a, b) => b[1] - a[1]),
      currencies: [...currencies],
      review: rows.filter(needsReview).length,
    };
  }, [rows]);

  const currency = summary.currencies[0] || "MYR";
  const maxCat = summary.byCat[0]?.[1] || 1;

  const card = { flex: 1, minWidth: 150, padding: 12, borderRadius: 8, background: "#f4f4f4", color: "#000" };
  const input = { padding: 6, fontSize: 14, color: "#000" };

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1>Receipt Processing</h1>
      <p>
        Upload photos or PDFs of receipts, invoices, bills or bank statements. The AI turns them
        into cash flow records you can review, correct and export.
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

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional: tell the AI about your business, e.g. 'We run a cafe. These are October supplier receipts.'"
        rows={2}
        style={{ width: "100%", marginTop: 12, padding: 12, fontSize: 16, boxSizing: "border-box", color: "#000" }}
      />

      <button
        onClick={handleAnalyze}
        disabled={loading || files.length === 0}
        style={{
          marginTop: 12,
          padding: "10px 20px",
          fontSize: 16,
          cursor: loading || files.length === 0 ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Reading documents..." : `Analyze ${files.length || ""} file${files.length === 1 ? "" : "s"}`}
      </button>

      {error && <p style={{ color: "crimson", marginTop: 16 }}>{error}</p>}

      {meta && meta.status !== "ok" && (
        <p style={{ marginTop: 16, padding: 12, background: "#fff4e5", color: "#000", borderRadius: 6 }}>
          {meta.status === "unreadable" && "The documents were too blurry to read. Try clearer photos. "}
          {meta.status === "not_financial_document" && "No receipts or financial documents were found. "}
          {meta.status === "partial" && "Only some files could be read. "}
          {meta.notes}
        </p>
      )}

      {rows.length > 0 && (
        <>
          <h2 style={{ marginTop: 32 }}>Summary</h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={card}>
              <div style={{ fontSize: 13 }}>Total expenses</div>
              <strong style={{ fontSize: 20 }}>{currency} {fmt(summary.expense)}</strong>
            </div>
            <div style={card}>
              <div style={{ fontSize: 13 }}>Total income</div>
              <strong style={{ fontSize: 20 }}>{currency} {fmt(summary.income)}</strong>
            </div>
            <div style={card}>
              <div style={{ fontSize: 13 }}>Net cash flow</div>
              <strong style={{ fontSize: 20, color: summary.net < 0 ? "crimson" : "green" }}>
                {summary.net < 0 ? "-" : ""}{currency} {fmt(Math.abs(summary.net))}
              </strong>
            </div>
            <div style={card}>
              <div style={{ fontSize: 13 }}>Need your review</div>
              <strong style={{ fontSize: 20 }}>{summary.review} of {rows.length}</strong>
            </div>
          </div>

          {summary.currencies.length > 1 && (
            <p style={{ color: "#b45309" }}>
              Multiple currencies found ({summary.currencies.join(", ")}). Totals above add them together without converting.
            </p>
          )}

          {summary.byCat.length > 0 && (
            <>
              <h3>Spending by category</h3>
              {summary.byCat.map(([cat, amt]) => (
                <div key={cat} style={{ marginBottom: 6, fontSize: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{LABEL[cat] || cat}</span>
                    <span>{currency} {fmt(amt)}</span>
                  </div>
                  <div style={{ background: "#eee", borderRadius: 4, height: 8 }}>
                    <div style={{ width: `${(amt / maxCat) * 100}%`, background: "#2563eb", height: 8, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </>
          )}

          <h2 style={{ marginTop: 32 }}>Records</h2>
          <p style={{ fontSize: 14 }}>You can fix the category, flow or total before exporting. Totals update automatically.</p>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ccc" }}>
                  <th style={{ padding: 6 }}>Date</th>
                  <th style={{ padding: 6 }}>Merchant</th>
                  <th style={{ padding: 6 }}>Flow</th>
                  <th style={{ padding: 6 }}>Category</th>
                  <th style={{ padding: 6 }}>Total</th>
                  <th style={{ padding: 6 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #ddd", verticalAlign: "top", background: needsReview(r) ? "#fffbeb" : "transparent" }}>
                    <td style={{ padding: 6 }}>{r.date || "-"}</td>
                    <td style={{ padding: 6 }}>
                      <div>{r.merchant || "Unknown"}</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>{r.doc_type} · {r.confidence} confidence</div>
                      {(r.flags || []).map((fl, i) => (
                        <div key={i} style={{ fontSize: 12, color: "#b45309" }}>⚠ {fl}</div>
                      ))}
                      {r.line_items.length > 0 && (
                        <details style={{ fontSize: 12, marginTop: 4 }}>
                          <summary style={{ cursor: "pointer" }}>{r.line_items.length} line items</summary>
                          {r.line_items.map((li, i) => (
                            <div key={i}>
                              {li.quantity ? `${li.quantity} × ` : ""}{li.name} — {fmt(li.total)}
                            </div>
                          ))}
                          {r.tax_amount != null && <div>Tax: {fmt(r.tax_amount)}</div>}
                          {r.discount != null && <div>Discount: {fmt(r.discount)}</div>}
                        </details>
                      )}
                    </td>
                    <td style={{ padding: 6 }}>
                      <select value={r.flow} onChange={(e) => updateRow(r.id, { flow: e.target.value })} style={input}>
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                      </select>
                    </td>
                    <td style={{ padding: 6 }}>
                      <select value={r.category} onChange={(e) => updateRow(r.id, { category: e.target.value })} style={input}>
                        {CATEGORIES.map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: 6 }}>
                      <input
                        type="number"
                        step="0.01"
                        value={r.total_amount}
                        onChange={(e) => updateRow(r.id, { total_amount: parseFloat(e.target.value) || 0 })}
                        style={{ ...input, width: 100 }}
                      />
                      <div style={{ fontSize: 12 }}>{r.currency || "MYR"}</div>
                    </td>
                    <td style={{ padding: 6 }}>
                      <button onClick={() => removeRow(r.id)} style={{ cursor: "pointer" }}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={() => downloadCsv(rows)} style={{ marginTop: 16, padding: "10px 20px", fontSize: 16, cursor: "pointer" }}>
            Download CSV (for Excel / accountant)
          </button>
        </>
      )}
    </main>
  );
}