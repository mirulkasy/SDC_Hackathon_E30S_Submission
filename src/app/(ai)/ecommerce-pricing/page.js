"use client";

import { useState } from "react";

const fmt = (n) =>
  Number(n || 0).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function EcommercePricingPage() {
  const [productName, setProductName] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [targetMargin, setTargetMargin] = useState("25");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleCalculate(e) {
    e.preventDefault();
    if (!productName || !costPrice || !targetMargin) return;

    setLoading(true);
    try {
      const res = await fetch("/api/ecommerce-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName,
          costPrice: parseFloat(costPrice),
          targetMargin: parseFloat(targetMargin),
        }),
      });
      const data = await res.json();
      if (data.platformPrices) {
        setResults(data);
      }
    } catch {
      alert("Error calculating prices.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 650,
        margin: "40px auto",
        padding: "0 16px",
        fontFamily: "sans-serif",
      }}
    >
      <h2 style={{ fontSize: 24, fontWeight: "bold", marginBottom: 8 }}>
        SME Smart Pricing Calculator
      </h2>
      <p style={{ color: "#666", marginBottom: 24, fontSize: 14 }}>
        Enter product details to calculate selling prices across all platforms.
      </p>

      {/* 3 Input Form */}
      <form
        onSubmit={handleCalculate}
        style={{
          background: "#f9fafb",
          padding: 24,
          borderRadius: 10,
          border: "1px solid #e5e7eb",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Input 1: Product Name */}
          <div>
            <label
              style={{
                display: "block",
                fontWeight: "600",
                fontSize: 14,
                marginBottom: 6,
              }}
            >
              1. Product Name
            </label>
            <input
              type="text"
              placeholder="e.g. Nasi Lemak Ayam / Air Sirap"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                fontSize: 15,
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Inputs 2 & 3: Cost & Target Profit */}
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: "block",
                  fontWeight: "600",
                  fontSize: 14,
                  marginBottom: 6,
                }}
              >
                2. Cost / Modal (RM)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 3.50"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  fontSize: 15,
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: "block",
                  fontWeight: "600",
                  fontSize: 14,
                  marginBottom: 6,
                }}
              >
                3. Targeted Profit (%)
              </label>
              <input
                type="number"
                step="1"
                placeholder="e.g. 25"
                value={targetMargin}
                onChange={(e) => setTargetMargin(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  fontSize: 15,
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              padding: "12px",
              background: "#16a34a",
              color: "#fff",
              fontWeight: "bold",
              fontSize: 16,
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            {loading ? "Calculating..." : "Calculate Suggested Prices"}
          </button>
        </div>
      </form>

      {/* Results Table */}
      {results && (
        <div
          style={{
            marginTop: 24,
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: 20,
          }}
        >
          <h3 style={{ margin: "0 0 4px 0", fontSize: 18 }}>
            Suggested Prices: <strong>{results.productName}</strong>
          </h3>
          <p style={{ fontSize: 13, color: "#666", marginTop: 0 }}>
            Modal: RM {fmt(results.costPrice)} | Target Profit Margin:{" "}
            {results.targetMargin}%
          </p>

          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: 12,
              fontSize: 14,
            }}
          >
            <thead>
              <tr style={{ background: "#f3f4f6", textAlign: "left" }}>
                <th style={{ padding: "10px 12px" }}>Platform / Channel</th>
                <th style={{ padding: "10px 12px" }}>Suggested Price (RM)</th>
                <th style={{ padding: "10px 12px" }}>Est. Profit (RM)</th>
              </tr>
            </thead>
            <tbody>
              {results.platformPrices.map((p, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 12px", fontWeight: "600" }}>
                    {p.name}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      fontWeight: "bold",
                      color: "#0284c7",
                    }}
                  >
                    RM {fmt(p.suggestedPrice)}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      color: "#16a34a",
                      fontWeight: "bold",
                    }}
                  >
                    RM {fmt(p.expectedProfit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}