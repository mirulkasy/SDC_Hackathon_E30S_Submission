import { GoogleGenAI, Type } from "@google/genai";
import { NextResponse } from "next/server";
import { ai } from "@/lib/gemini";

const MODELS = [
  { name: "gemini-2.5-flash", tries: 3 },
  { name: "gemini-3.5-flash", tries: 2 },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

// All possible action types the AI can propose
const ACTION_TYPES = [
  "add_product",
  "update_product",
  "add_transaction",
  "update_transaction",
];

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    status: {
      type: Type.STRING,
      enum: ["ok", "partial", "unreadable", "not_business_document"],
    },
    summary: { type: Type.STRING },
    notes: { type: Type.STRING, nullable: true },
    actions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          action_type: {
            type: Type.STRING,
            enum: ACTION_TYPES,
          },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          // Product fields
          product_name: { type: Type.STRING, nullable: true },
          product_category: {
            type: Type.STRING,
            enum: ["Food", "Drinks", "Household", null],
            nullable: true,
          },
          product_stock: { type: Type.INTEGER, nullable: true },
          product_stock_change: { type: Type.INTEGER, nullable: true },
          product_cost: { type: Type.NUMBER, nullable: true },
          product_price: { type: Type.NUMBER, nullable: true },
          product_due_date: { type: Type.STRING, nullable: true },
          product_barcode: { type: Type.STRING, nullable: true },
          // Transaction fields
          tx_type: {
            type: Type.STRING,
            enum: ["in", "out", null],
            nullable: true,
          },
          tx_amount: { type: Type.NUMBER, nullable: true },
          tx_description: { type: Type.STRING, nullable: true },
          tx_category: {
            type: Type.STRING,
            enum: [
              "sales",
              "stock_purchase",
              "rent",
              "utilities",
              "salary",
              "marketing",
              "platform_fee",
              "tax",
              "other",
              null,
            ],
            nullable: true,
          },
          tx_date: { type: Type.STRING, nullable: true },
          tx_payment_method: {
            type: Type.STRING,
            enum: [
              "Cash",
              "Bank Transfer",
              "Online Banking",
              "Debit Card",
              "Credit Card",
              "E-Wallet",
              null,
            ],
            nullable: true,
          },
          tx_note: { type: Type.STRING, nullable: true },
        },
        required: ["action_type", "title", "description"],
      },
    },
  },
  required: ["status", "summary", "actions"],
};

const systemInstruction = `
You are an intelligent business document analyser for Malaysian SMEs. 
Analyse the uploaded image and extract ALL useful business actions.

You can propose these action types:
- add_product: A new product to add to inventory
- update_product: Update existing product stock or details (use product_stock_change for +/- changes)
- add_transaction: A money-in (sales) or money-out (expense/purchase) transaction
- update_transaction: Update an existing transaction

Document types you should handle:
- RECEIPTS / INVOICES: Identify the vendor, date, items, total. Propose add_transaction (type "out") for each expense. If items match inventory products, also propose update_product with stock change.
- SALES RECORDS / SALES RECEIPTS: Propose add_transaction (type "in") for revenue. Propose update_product (stockChange negative) for items sold.
- DELIVERY ORDERS / STOCK ARRIVAL: Propose update_product (stockChange positive) for received stock. Also propose add_transaction (type "out") for the payment.
- PRICE LISTS / SUPPLIER LISTS: Propose add_product or update_product for each item with cost/price info.
- INVENTORY COUNTS / STOCK TAKES: Propose update_product with the counted stock level.
- HANDWRITTEN NOTES about transactions or stock: Extract what you can, be transparent about uncertain values.

Rules:
- Currency is Malaysian Ringgit (RM). All amounts are in RM.
- Dates in YYYY-MM-DD format. If unclear, use today's date and note it.
- product_category must be Food, Drinks, or Household. Infer from context (food items = Food, beverages = Drinks, other = Household).
- For stock changes from a receipt (items purchased/sold), use product_stock_change, not product_stock.
- For inventory counts (exact stock on hand), use product_stock.
- If a product category can't be determined, default to "Household".
- If an amount is partially visible, note it in description and use your best read.
- Group line items intelligently: a receipt for 5 products = 1 add_transaction + 5 update_product (or add_product if new).
- status: "not_business_document" if the image has no business relevance. "unreadable" if too blurry/dark. "partial" if some parts readable. "ok" if fully readable.
- summary: 1-2 sentences describing what was found.
- Be conservative: never invent numbers not present in the image.
`;

async function generate(contents) {
  let busyError = null;
  let lastError = null;

  for (const model of MODELS) {
    for (let attempt = 0; attempt < model.tries; attempt++) {
      try {
        return await ai.models.generateContent({
          model: model.name,
          contents,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema,
            temperature: 0.1,
          },
        });
      } catch (err) {
        console.warn(
          `Model ${model.name} attempt ${attempt + 1} failed:`,
          err?.message || err,
        );
        lastError = err;
        const busy =
          err?.status === 503 || err?.status === 429 || err?.status === 500;
        if (busy) busyError = err;
        if (!busy) break;
        await sleep(1200 * (attempt + 1));
      }
    }
  }
  throw busyError || lastError;
}

export async function POST(req) {
  try {
    const { files = [] } = await req.json();

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: "Please upload at least one image." },
        { status: 400 },
      );
    }

    if (files.length > 4) {
      return NextResponse.json(
        { error: "Please upload up to 4 images at a time." },
        { status: 400 },
      );
    }

    for (const f of files) {
      if (!ALLOWED_TYPES.includes(f?.mimeType)) {
        return NextResponse.json(
          { error: "Only JPG, PNG, WEBP and PDF files are supported." },
          { status: 400 },
        );
      }
    }

    const parts = [];
    files.forEach((f, i) => {
      parts.push({ text: `Image ${i + 1}:` });
      parts.push({ inlineData: { mimeType: f.mimeType, data: f.data } });
    });
    parts.push({
      text: "Analyse all images above and extract every relevant business action.",
    });

    const response = await generate([{ role: "user", parts }]);

    let parsed;
    try {
      parsed = JSON.parse(response.text ?? "{}");
    } catch {
      return NextResponse.json(
        { error: "The AI returned an unreadable response. Please try again." },
        { status: 502 },
      );
    }

    // Stamp each action with a unique id
    const actions = (parsed.actions ?? []).map((a, i) => ({
      ...a,
      id: `action-${Date.now()}-${i}`,
    }));

    return NextResponse.json({
      status: parsed.status || "ok",
      summary: parsed.summary || "Image processed.",
      notes: parsed.notes || null,
      actions,
    });
  } catch (err) {
    console.error("Image Processing Error:", err);
    const busy = err?.status === 503 || err?.status === 429;
    return NextResponse.json(
      {
        error: busy
          ? "The AI service is busy. Please try again in a few seconds."
          : err?.message || "Something went wrong. Please try again.",
      },
      { status: busy ? 503 : 500 },
    );
  }
}
