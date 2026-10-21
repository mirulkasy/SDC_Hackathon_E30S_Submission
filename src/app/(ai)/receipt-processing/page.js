"use client";

import { useEffect, useMemo, useState } from "react";

const MAX_FILES = 8;
const MAX_PDF_BYTES = 4 * 1024 * 1024;
const STORAGE_KEY = "sme_receipt_scans_v1";

const CATEGORIES = [
  ["inventory_stock", "Stock / Ingredients"],
  ["supplies", "Packaging & Supplies"],
  ["food_beverage", "Food & Beverage"],
  ["utilities", "Utilities (Electric/Water/Net)"],
  ["rent", "Rent"],
  ["transport", "Transport & Delivery"],
  ["equipment", "Equipment & Repair"],
  ["marketing", "Marketing & Ads"],
  ["other", "Other Expense"],
];
const LABEL = Object.fromEntries(CATEGORIES);

const fmt = (n) =>
  Number(n || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

async function fileToPayload(file) {
  if (file.type === "application/pdf") {
    if (file.size > MAX_PDF_BYTES) throw new Error(`${file.name} is too large (PDF limit 4MB).`);
    const dataUrl = await readAsDataURL(file);
    return { name: file.name, mimeType: "application/pdf", data: dataUrl.split(",")[1], preview: null };
  }
  if (!file.type.startsWith("image/")) {
    throw new Error(`${file.name}: only images and PDFs are supported.`);
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { name: file.name, mimeType: "image/jpeg", data: dataUrl.split(",")[1], preview: dataUrl };
}

function downloadCsv(rows) {
  const header = ["Date", "Merchant / Vendor", "Category", "Tax / SST (RM)", "Total Amount (RM)", "Items"];
  const lines = rows.map((r) =>
    [
      r.date || "-",
      r.merchant || "Unknown",
      LABEL[r.category] || r.category,
      r.tax_amount || 0,
      r.total_amount || 0,
      (r.line_items || []).map((i) => `${i.name} (x${i.quantity || 1})`).join("; "),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [header.join(","), ...lines].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "receipts_summary.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReceiptProcessingPage() {
  const [files, setFiles] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setRows(parsed);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch (e) {
      console.error(e);
    }
  }, [rows, loaded]);

  async function handleFiles(e) {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    setError("");

    const room = MAX_FILES - files.length;
    if (picked.length > room) setError(`You can add up to ${MAX_FILES} files.`);

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

    try {
      const res = await fetch("/api/receipt-processing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: files.map(({ mimeType, data }) => ({ mimeType, data })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Request failed");
        return;
      }
      setRows((prev) => [...(data.documents || []), ...prev]);
      setFiles([]);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  const updateRow = (id, patch) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const removeRow = (id) => setRows((prev) => prev.filter((r) => r.id !== id));

  const clearAllData = () => {
    if (window.confirm("Clear all saved receipts?")) {
      setRows([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const summary = useMemo(() => {
    let totalExpense = 0;
    let totalTax = 0;
    const byCat = {};

    for (const r of rows) {
      const amt = Number(r.total_amount) || 0;
      const tax = Number(r.tax_amount) || 0;
      totalExpense += amt;
      totalTax += tax;
      byCat[r.category] = (byCat[r.category] || 0) + amt;
    }

    return {
      totalExpense,
      totalTax,
      byCat: Object.entries(byCat).sort((a, b) => b[1] - a[1]),
    };
  }, [rows]);

  const maxCat = summary.byCat[0]?.[1] || 1;

  return (
    <main style={{ maxWidth: 800, margin: "30px auto", padding: "0 16px", fontFamily: "sans-serif" }}>
      <h2>Receipt & Expense Scanner</h2>
      <p style={{ color: "#555", fontSize: 14 }}>
        Upload receipt photos or PDFs. Scanned items automatically save to your browser storage.
      </p>

      <div style={{ background: "#f9fafb", border: "2px dashed #d1d5db", padding: 20, borderRadius: 8, textAlign: "center" }}>
        <input type="file" accept="image/*,application/pdf" multiple onChange={handleFiles} />
        {files.length > 0 && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12, justifyContent: "center" }}>
            {files.map((f, i) => (
              <div key={i} style={{ position: "relative", width: 80, fontSize: 11 }}>
                {f.preview ? (
                  <img src={f.preview} alt={f.name} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 6 }} />
                ) : (
                  <div style={{ width: 80, height: 80, background: "#eee", borderRadius: 6, display: "grid", placeItems: "center" }}>PDF</div>
                )}
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleAnalyze}
        disabled={loading || files.length === 0}
        style={{
          marginTop: 16,
          width: "100%",
          padding: "12px",
          background: loading || files.length === 0 ? "#ccc" : "#16a34a",
          color: "#fff",
          fontWeight: "bold",
          fontSize: 16,
          border: "none",
          borderRadius: 6,
          cursor: loading || files.length === 0 ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Scanning Receipts..." : `Scan ${files.length} Receipt(s)`}
      </button>

      {error && <p style={{ color: "crimson", marginTop: 12, fontWeight: "500" }}>{error}</p>}

      {rows.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>Summary</h3>
            <span style={{ fontSize: 12, color: "#16a34a", fontWeight: "bold" }}>
              ✓ Auto-saved in browser
            </span>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 160, padding: 14, background: "#f3f4f6", borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: "#666" }}>Total Expenses</div>
              <strong style={{ fontSize: 22, color: "#111" }}>RM {fmt(summary.totalExpense)}</strong>
            </div>
            <div style={{ flex: 1, minWidth: 160, padding: 14, background: "#f3f4f6", borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: "#666" }}>SST / Tax Paid</div>
              <strong style={{ fontSize: 22, color: "#2563eb" }}>RM {fmt(summary.totalTax)}</strong>
            </div>
            <div style={{ flex: 1, minWidth: 160, padding: 14, background: "#f3f4f6", borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: "#666" }}>Saved Receipts</div>
              <strong style={{ fontSize: 22, color: "#111" }}>{rows.length}</strong>
            </div>
          </div>

          {summary.byCat.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h4 style={{ marginBottom: 8 }}>Spending by Category</h4>
              {summary.byCat.map(([cat, amt]) => (
                <div key={cat} style={{ marginBottom: 8, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span>{LABEL[cat] || cat}</span>
                    <strong style={{ color: "#333" }}>RM {fmt(amt)}</strong>
                  </div>
                  <div style={{ background: "#e5e7eb", borderRadius: 4, height: 8 }}>
                    <div style={{ width: `${(amt / maxCat) * 100}%`, background: "#16a34a", height: 8, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <h3 style={{ marginTop: 28 }}>Scanned Receipt Items</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {rows.map((r) => (
              <div key={r.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, background: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                  <div>
                    <input
                      type="text"
                      value={r.merchant || ""}
                      onChange={(e) => updateRow(r.id, { merchant: e.target.value })}
                      placeholder="Vendor Name"
                      style={{ fontWeight: "bold", fontSize: 15, padding: "4px 8px", borderRadius: 4, border: "1px solid #ccc" }}
                    />
                    <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>Date: {r.date || "N/A"}</div>
                  </div>

                  <div style={{ textAlign: "right", display: "flex", gap: 12, alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 12, color: "#666" }}>Total Amount (RM):</div>
                      <input
                        type="number"
                        step="0.01"
                        value={r.total_amount || 0}
                        onChange={(e) => updateRow(r.id, { total_amount: parseFloat(e.target.value) || 0 })}
                        style={{ fontWeight: "bold", fontSize: 16, width: 100, textAlign: "right", padding: "4px 8px", border: "1px solid #ccc", borderRadius: 4 }}
                      />
                    </div>
                    <button
                      onClick={() => removeRow(r.id)}
                      style={{ background: "#ef4444", color: "#fff", border: "none", padding: "6px 10px", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {r.line_items && r.line_items.length > 0 && (
                  <div style={{ background: "#f9fafb", padding: 10, borderRadius: 6, fontSize: 13, marginTop: 8 }}>
                    <strong style={{ fontSize: 12, color: "#555" }}>Items Extracted:</strong>
                    {r.line_items.map((li, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                        <span>{li.quantity ? `${li.quantity}x ` : ""}{li.name}</span>
                        <span>RM {fmt(li.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button
              onClick={() => downloadCsv(rows)}
              style={{
                padding: "10px 18px",
                background: "#0284c7",
                color: "#fff",
                fontWeight: "bold",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Download CSV Report
            </button>
            <button
              onClick={clearAllData}
              style={{
                padding: "10px 18px",
                background: "#6b7280",
                color: "#fff",
                fontWeight: "bold",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Clear Saved Data
            </button>
          </div>
        </div>
      )}
    </main>
  );
}