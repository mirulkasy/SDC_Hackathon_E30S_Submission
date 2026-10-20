import { GoogleGenAI, Type } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODELS = ["gemini-3.5-flash"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    status: {
      type: Type.STRING,
      enum: ["ok", "needs_clarification", "not_inventory"],
    },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          action: { type: Type.STRING, enum: ["add", "remove", "set"] },
          quantity: { type: Type.NUMBER },
          unit: { type: Type.STRING, nullable: true },
          unit_price: { type: Type.NUMBER, nullable: true },
          currency: { type: Type.STRING, nullable: true },
        },
        required: ["name", "action", "quantity"],
      },
    },
    counterparty: { type: Type.STRING, nullable: true },
    clarification_question: { type: Type.STRING, nullable: true },
  },
  required: ["status", "items"],
};

const systemInstruction = `
You convert a business owner's casual message into structured inventory updates.

Rules:
- "add" = stock received or bought. "remove" = stock sold, used, damaged or given away. "set" = a stock count ("we have 40 left").
- One entry in "items" per product. Use singular, lowercase product names ("bubble tea cup").
- Put unit_price as the price PER UNIT. If only a total is given, divide by the quantity.
- If no currency is stated, use "MYR". Never invent prices; use null if no price is mentioned.
- Put the supplier or customer name in "counterparty" if one is mentioned, otherwise null.
- If a quantity or product is unclear, set status to "needs_clarification", fill "clarification_question" with one short question, and leave "items" empty or partial.
- If the message is not about stock or inventory, set status to "not_inventory" and return an empty "items" array.
- Never guess quantities. Output only data that the message supports.
`;

async function generate(question) {
  const config = {
    systemInstruction,
    responseMimeType: "application/json",
    responseSchema,
    temperature: 0.1, // low: we want accurate extraction, not creativity
    thinkingConfig: { thinkingBudget: 0 },
  };

  let lastError;
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await ai.models.generateContent({ model, contents: question, config });
      } catch (err) {
        lastError = err;
        const retryable = err?.status === 503 || err?.status === 429;
        if (!retryable) break;
        await sleep(800 * (attempt + 1));
      }
    }
  }
  throw lastError;
}

export async function POST(req) {
  try {
    const { question } = await req.json();
    const response = await generate(question);
    return NextResponse.json(JSON.parse(response.text ?? "{}"));
  } catch (err) {
    console.error(err);
    const busy = err?.status === 503 || err?.status === 429;
    return NextResponse.json(
      {
        error: busy
          ? "The AI service is busy right now. Please try again in a few seconds."
          : "Something went wrong",
      },
      { status: busy ? 503 : 500 }
    );
  }
}