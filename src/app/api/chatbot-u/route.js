import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Tried in order. Add or change names to match your AI Studio model list.
const MODELS = ["gemini-3.5-flash"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function startStream(question) {
  const config = {
    systemInstruction: `
      - Answer the user's question in 3 sentences or fewer.
      - Answer only questions related to business and finance.
      - If the question is not about business or finance, reply exactly: Sorry, I can only answer business and finance questions.
    `,
    temperature: 1.0,
    thinkingConfig: { thinkingBudget: 0 },
  };

  let lastError;
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await ai.models.generateContentStream({
          model,
          contents: question,
          config,
        });
      } catch (err) {
        lastError = err;
        const retryable = err?.status === 503 || err?.status === 429;
        if (!retryable) break; // try the next model
        await sleep(800 * (attempt + 1));
      }
    }
  }
  throw lastError;
}

export async function POST(req) {
  try {
    const { question } = await req.json();
    const stream = await startStream(question);

    const encoder = new TextEncoder();
    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              controller.enqueue(encoder.encode(chunk.text ?? ""));
            }
          } catch (e) {
            console.error(e);
          } finally {
            controller.close();
          }
        },
      }),
      { headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
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