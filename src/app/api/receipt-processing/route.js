import { GoogleGenAI, Type } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Active model specified by Google GenAI API
const MODELS = ["gemini-3.5-flash"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    status: { type: Type.STRING },
    documents: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          merchant: { type: Type.STRING, nullable: true },
          date: { type: Type.STRING, nullable: true },
          category: { type: Type.STRING, nullable: true },
          tax_amount: { type: Type.NUMBER, nullable: true },
          service_charge: { type: Type.NUMBER, nullable: true },
          total_amount: { type: Type.NUMBER, nullable: true },
          line_items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                quantity: { type: Type.NUMBER, nullable: true },
                total: { type: Type.NUMBER, nullable: true },
              },
              required: ["name"],
            },
          },
        },
        required: ["total_amount"],
      },
    },
  },
  required: ["documents"],
};

const systemInstruction = `
You are an expert receipt parser for Malaysian SME businesses.
Scan the uploaded receipt/invoice image and extract:
1. merchant: Vendor or restaurant name (e.g. "Elcerdo TTDI").
2. date: Date in YYYY-MM-DD format.
3. line_items: List of items with item name, quantity (default 1), and total price per item line.
4. tax_amount: Total Service Tax / SST (6%, 8%, etc.).
5. service_charge: 10% Service Charge if present.
6. total_amount: Grand Total price paid.
7. category: Choose best fit (inventory_stock, supplies, food_beverage, utilities, rent, transport, equipment, marketing, or other).
`;

async function generate(contents) {
  let lastError;
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema,
            temperature: 0.1,
          },
        });
      } catch (err) {
        console.warn(`Model ${model} attempt ${attempt + 1} failed:`, err?.message || err);
        lastError = err;
        await sleep(800 * (attempt + 1));
      }
    }
  }
  throw lastError;
}

export async function POST(req) {
  try {
    const { files = [] } = await req.json();

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: "Please upload at least one receipt image or PDF." }, { status: 400 });
    }

    const parts = [];
    files.forEach((f, i) => {
      parts.push({ text: `File ${i + 1}:` });
      parts.push({ inlineData: { mimeType: f.mimeType, data: f.data } });
    });

    const response = await generate([{ role: "user", parts }]);

    let parsed;
    try {
      parsed = JSON.parse(response.text ?? "{}");
    } catch {
      return NextResponse.json({ error: "The AI returned invalid JSON output. Please try again." }, { status: 502 });
    }

    const rawDocs = parsed.documents || [];
    const documents = rawDocs.map((d, i) => ({
      id: `doc_${Date.now()}_${i}_${Math.random().toString(36).substring(7)}`,
      merchant: d.merchant || "Unknown Merchant",
      date: d.date || null,
      category: d.category || "other",
      tax_amount: Number(d.tax_amount) || 0,
      service_charge: Number(d.service_charge) || 0,
      total_amount: Number(d.total_amount) || 0,
      line_items: Array.isArray(d.line_items)
        ? d.line_items.map((li) => ({
            name: li.name || "Item",
            quantity: Number(li.quantity) || 1,
            total: Number(li.total) || 0,
          }))
        : [],
    }));

    return NextResponse.json({
      status: parsed.status || "ok",
      documents,
    });
  } catch (err) {
    console.error("Receipt Scanner Server Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to scan receipt. Please check your GEMINI_API_KEY environment variable." },
      { status: 500 }
    );
  }
}