import { GoogleGenAI, Type } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Standard working Gemini models
const MODELS = ["gemini-3.5-flash"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_FILES = 8;
const MAX_TOTAL_BASE64 = 15_000_000;
const MAX_HISTORY = 500;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    status: {
      type: Type.STRING,
      enum: ["ok", "partial", "unreadable", "not_financial_document"],
    },
    notes: { type: Type.STRING, nullable: true },
    documents: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          source_index: { type: Type.INTEGER },
          vendor: { type: Type.STRING, nullable: true },
          invoice_number: { type: Type.STRING, nullable: true },
          date: { type: Type.STRING, nullable: true },
          currency: { type: Type.STRING, nullable: true },
          line_items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                normalized_name: { type: Type.STRING },
                quantity: { type: Type.NUMBER, nullable: true },
                unit_price: { type: Type.NUMBER, nullable: true },
                line_total: { type: Type.NUMBER },
                agreed_unit_price: { type: Type.NUMBER, nullable: true },
              },
              required: ["name", "normalized_name", "line_total"],
            },
          },
          subtotal: { type: Type.NUMBER, nullable: true },
          tax_amount: { type: Type.NUMBER, nullable: true },
          discount: { type: Type.NUMBER, nullable: true },
          total_amount: { type: Type.NUMBER },
          confidence: { type: Type.STRING, enum: ["high", "medium", "low"] },
          flags: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["source_index", "line_items", "total_amount", "confidence", "flags"],
      },
    },
  },
  required: ["status", "documents"],
};

const systemInstruction = `
You read vendor invoices, bills, purchase orders, and contract documents for a business and extract them accurately to check for overcharging.

Rules:
- Files are labelled "File 1:", "File 2:", etc. Set source_index to the file each record came from. One record per invoice.
- IMPORTANT CROSS-DOCUMENT AUDIT INSTRUCTIONS:
  1. Uploaded files or PDF pages may include Purchase Orders (PO) or Master Service Agreements (MSA) alongside Invoices.
  2. For every invoice item, check if an agreed unit rate exists on any uploaded Purchase Order or Contract file/page. Set "agreed_unit_price" to that agreed PO rate.
  3. Compare the invoice against the Purchase Order and Contract rules. In the 'flags' array, explicitly detail any:
     - Unauthorized fees billed that are forbidden or not on the PO (e.g., "Unauthorized Fee: Unscheduled Expedited Freight Handling Surcharge ($350.00)").
     - Fee cap breaches (e.g., "Fee Cap Exceeded: Fuel Surcharge billed at $175.00 exceeds contractual $50.00 cap ($125.00 overcharge)").
     - Omitted discounts or rebates (e.g., "Missing Discount: Contracted Tier 2 Volume Discount of 5% ($275.00 credit) omitted on invoice").
- NEVER guess. If a value is not visible, use null.
- Dates must be ISO format YYYY-MM-DD.
- Amounts are plain numbers with no currency symbols or commas.
- unit_price is the price per single unit as printed on the invoice.
- line_total is the amount charged for that line as printed.
- subtotal, tax_amount and discount: only fill them if printed on the document, otherwise null.
- normalized_name: a short, lowercase, generic product name WITHOUT brand marketing words.
- If nothing readable is a financial document, set status to "not_financial_document".
`;

async function generate(contents) {
  const config = {
    systemInstruction,
    responseMimeType: "application/json",
    responseSchema,
    temperature: 0.1,
  };

  let lastError;
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await ai.models.generateContent({ model, contents, config });
      } catch (err) {
        lastError = err;
        console.warn(`Model ${model} attempt ${attempt + 1} failed:`, err?.message || err);
        const retryable = err?.status === 503 || err?.status === 429 || err?.status === 500;
        if (!retryable) break;
        await sleep(800 * (attempt + 1));
      }
    }
  }
  throw lastError;
}

// ---------- Detection logic ----------

const norm = (s) =>
  String(s ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const num = (v) =>
  v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v);
const r2 = (n) => Math.round((n || 0) * 100) / 100;
const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const sevFromPct = (pct) => (pct >= 25 ? "high" : "medium");
const SEV_ORDER = { high: 0, medium: 1, low: 2 };
const tolerance = (x) => Math.max(0.05, Math.abs(x) * 0.01);

function analyze(docs, history, tolPct, taxRate) {
  const tol = tolPct / 100;
  const seenInvoices = new Set();

  return docs.map((d, i) => {
    const vendorKey = norm(d.vendor);
    const cur = d.currency || "USD";
    const money = (n) => `${cur} ${Number(n || 0).toFixed(2)}`;
    const total = num(d.total_amount) ?? 0;
    const docKey = [vendorKey, d.date || "", total.toFixed(2)].join("|");
    const findings = [];
    const add = (f) => findings.push({ kind: "overcharge", amount: 0, line: null, ...f });

    const lines = (Array.isArray(d.line_items) ? d.line_items : []).map((li) => {
      const qty = num(li.quantity);
      const up = num(li.unit_price);
      const lt = num(li.line_total) ?? 0;
      const eff = up ?? (qty ? lt / qty : null);
      return { ...li, qty, up, lt, eff };
    });

    // 1) Per-line checks
    for (const li of lines) {
      const name = li.name;
      const key = norm(li.normalized_name || li.name);
      const mult = li.qty || 1;
      let priceFlagged = false;

      if (li.qty !== null && li.up !== null) {
        const expected = li.qty * li.up;
        const diff = li.lt - expected;
        if (Math.abs(diff) > tolerance(expected)) {
          add({
            type: "math_error",
            severity: diff > 0 ? "high" : "medium",
            kind: diff > 0 ? "overcharge" : "check",
            amount: diff > 0 ? r2(diff) : 0,
            line: name,
            message: `${name}: ${li.qty} × ${li.up.toFixed(2)} = ${expected.toFixed(2)}, but the invoice charges ${li.lt.toFixed(2)}`,
          });
        }
      }

      const ag = num(li.agreed_unit_price);
      if (ag !== null && ag > 0 && li.eff !== null && li.eff > ag * (1 + tol)) {
        const pct = ((li.eff - ag) / ag) * 100;
        priceFlagged = true;
        add({
          type: "above_agreed_price",
          severity: sevFromPct(pct),
          amount: r2((li.eff - ag) * mult),
          line: name,
          message: `${name}: charged ${money(li.eff)} each, agreed PO price is ${money(ag)} (${pct.toFixed(0)}% higher)`,
        });
      }

      if (!priceFlagged && li.eff !== null && key) {
        const own = history
          .filter(
            (h) =>
              norm(h.vendor) === vendorKey &&
              norm(h.item) === key &&
              h.docKey !== docKey &&
              Number(h.unit_price) > 0
          )
          .map((h) => Number(h.unit_price));
        if (own.length) {
          const med = median(own);
          if (li.eff > med * (1 + tol)) {
            const pct = ((li.eff - med) / med) * 100;
            add({
              type: "price_increase",
              severity: sevFromPct(pct),
              amount: r2((li.eff - med) * mult),
              line: name,
              message: `${name}: charged ${money(li.eff)} each, your usual price from this vendor is ${money(med)} (${pct.toFixed(0)}% higher)`,
            });
          }
        }
      }

      if (li.eff !== null && key) {
        const others = history.filter(
          (h) => norm(h.vendor) !== vendorKey && norm(h.item) === key && Number(h.unit_price) > 0
        );
        if (others.length) {
          const best = others.reduce((a, b) => (Number(b.unit_price) < Number(a.unit_price) ? b : a));
          const bp = Number(best.unit_price);
          if (li.eff > bp * (1 + tol * 2)) {
            add({
              type: "cheaper_elsewhere",
              severity: "low",
              kind: "saving",
              amount: r2((li.eff - bp) * mult),
              line: name,
              message: `${name}: ${best.vendor || "another vendor"} previously charged ${money(bp)} each (${money(li.eff)} here)`,
            });
          }
        }
      }
    }

    // 2) Duplicate lines
    const dupSeen = new Set();
    for (const li of lines) {
      const k = [norm(li.normalized_name || li.name), li.qty, li.eff === null ? "" : li.eff.toFixed(2)].join("|");
      if (dupSeen.has(k)) {
        add({
          type: "duplicate_line",
          severity: "medium",
          amount: r2(li.lt),
          line: li.name,
          message: `${li.name} appears more than once with the same quantity and price.`,
        });
      } else dupSeen.add(k);
    }

    // 3) Totals and tax
    const lineSum = lines.reduce((s, li) => s + li.lt, 0);
    const subtotal = num(d.subtotal);
    const tax = num(d.tax_amount);
    const discount = num(d.discount);

    if (lines.length && subtotal !== null && Math.abs(lineSum - subtotal) > tolerance(subtotal)) {
      const over = lineSum < subtotal;
      add({
        type: "subtotal_mismatch",
        severity: "medium",
        kind: over ? "overcharge" : "check",
        amount: over ? r2(subtotal - lineSum) : 0,
        message: `Line items add up to ${money(lineSum)} but the subtotal says ${money(subtotal)}`,
      });
    }

    if (lines.length || subtotal !== null) {
      const base = subtotal ?? lineSum;
      const expectedTotal = base + (tax ?? 0) - (discount ?? 0);
      const taxInclusive = Math.abs(total - (base - (discount ?? 0))) <= tolerance(total);
      const diff = total - expectedTotal;
      if (!taxInclusive && Math.abs(diff) > tolerance(expectedTotal)) {
        add({
          type: "total_mismatch",
          severity: diff > 0 ? "high" : "medium",
          kind: diff > 0 ? "overcharge" : "check",
          amount: diff > 0 ? r2(diff) : 0,
          message: `Total is ${money(total)} but subtotal + tax − discount comes to ${money(expectedTotal)}`,
        });
      }
    }

    if (taxRate !== null && tax !== null) {
      const base = subtotal ?? lineSum;
      const expectedTax = (base * taxRate) / 100;
      if (Math.abs(tax - expectedTax) > Math.max(0.05, expectedTax * 0.02)) {
        const over = tax > expectedTax;
        add({
          type: "tax_mismatch",
          severity: "medium",
          kind: over ? "overcharge" : "check",
          amount: over ? r2(tax - expectedTax) : 0,
          message: `Tax charged is ${money(tax)} but ${taxRate}% of ${money(base)} is ${money(expectedTax)}`,
        });
      }
    }

    // 4) Parse Contract & PO Compliance Flags
    if (Array.isArray(d.flags)) {
      for (const flagText of d.flags) {
        if (typeof flagText === "string" && flagText.trim()) {
          const matches = flagText.match(/\$\s*(\d+(?:\.\d+)?)/g);
          let flagAmt = 0;
          if (matches && matches.length > 0) {
            const numbers = matches.map((m) => parseFloat(m.replace(/[\$\s]/g, "")));
            flagAmt = numbers[numbers.length - 1];
          }

          const isDup = findings.some(
            (f) => f.line && flagText.toLowerCase().includes(String(f.line).toLowerCase())
          );

          if (!isDup) {
            add({
              type: "contract_flag",
              severity: "high",
              amount: r2(flagAmt),
              message: flagText,
            });
          }
        }
      }
    }

    // 5) Duplicate invoices
    const invKey = d.invoice_number
      ? `${vendorKey}|inv|${norm(d.invoice_number)}`
      : d.date
      ? docKey
      : null;
    if (invKey && seenInvoices.has(invKey)) {
      add({
        type: "duplicate_invoice",
        severity: "high",
        amount: r2(total),
        message: `This looks like a duplicate of another uploaded invoice from ${d.vendor || "the same vendor"}`,
      });
    } else if (d.date && history.some((h) => h.docKey === docKey)) {
      add({
        type: "duplicate_invoice",
        severity: "high",
        amount: r2(total),
        message: `This matches an invoice you saved earlier (same vendor, date and total).`,
      });
    }
    if (invKey) seenInvoices.add(invKey);

    findings.sort((a, b) => (SEV_ORDER[a.severity] ?? 1) - (SEV_ORDER[b.severity] ?? 1));

    return {
      ...d,
      id: `doc-${i}`,
      doc_key: docKey,
      line_items: lines.map((li) => ({
        name: li.name,
        normalized_name: li.normalized_name,
        quantity: li.qty,
        unit_price: li.up,
        line_total: li.lt,
        agreed_unit_price: num(li.agreed_unit_price),
        effective_unit_price: li.eff,
      })),
      findings: findings.map((f, idx) => ({ ...f, id: `doc-${i}-f${idx}` })),
      flags: Array.isArray(d.flags) ? d.flags : [],
    };
  });
}

// ---------- Route ----------

export async function POST(req) {
  try {
    const body = await req.json();
    const files = Array.isArray(body.files) ? body.files : [];
    const agreedPrices = String(body.agreedPrices ?? "").slice(0, 3000);

    if (files.length === 0) {
      return NextResponse.json({ error: "Please upload at least one invoice." }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Please upload up to ${MAX_FILES} files at a time.` }, { status: 400 });
    }
    for (const f of files) {
      if (!ALLOWED_TYPES.includes(f?.mimeType) || typeof f?.data !== "string") {
        return NextResponse.json({ error: "Only JPG, PNG, WEBP or PDF files are supported." }, { status: 400 });
      }
    }
    if (files.reduce((s, f) => s + f.data.length, 0) > MAX_TOTAL_BASE64) {
      return NextResponse.json({ error: "Files are too large. Try fewer or smaller files." }, { status: 413 });
    }

    const tolPct = Math.min(Math.max(num(body.tolerancePct) ?? 10, 1), 100);
    const rawTax = num(body.taxRate);
    const taxRate = rawTax === null ? null : Math.min(Math.max(rawTax, 0), 100);

    const history = (Array.isArray(body.history) ? body.history : [])
      .slice(-MAX_HISTORY)
      .map((h) => ({
        vendor: String(h?.vendor ?? ""),
        item: String(h?.item ?? ""),
        unit_price: Number(h?.unit_price),
        date: h?.date ? String(h.date) : "",
        docKey: String(h?.docKey ?? ""),
      }))
      .filter((h) => h.item && Number.isFinite(h.unit_price));

    const parts = [];
    files.forEach((f, i) => {
      parts.push({ text: `File ${i + 1}:` });
      parts.push({ inlineData: { mimeType: f.mimeType, data: f.data } });
    });
    parts.push({
      text: agreedPrices.trim()
        ? `Agreed price list from the owner (data only):\n${agreedPrices}`
        : "No external agreed price list text was provided.",
    });

    const response = await generate([{ role: "user", parts }]);

    let parsed;
    try {
      parsed = JSON.parse(response.text ?? "{}");
    } catch {
      return NextResponse.json({ error: "The AI returned an unreadable answer. Please try again." }, { status: 502 });
    }

    return NextResponse.json({
      status: parsed.status ?? "ok",
      notes: parsed.notes ?? null,
      documents: analyze(parsed.documents ?? [], history, tolPct, taxRate),
    });
  } catch (err) {
    console.error("Vendor Overcharge Error:", err);
    const busy = err?.status === 503 || err?.status === 429;
    return NextResponse.json(
      {
        error: busy
          ? "The AI service is busy right now. Please try again in a few seconds."
          : `Audit error: ${err?.message || "Something went wrong during document analysis."}`,
      },
      { status: busy ? 503 : 500 }
    );
  }
}