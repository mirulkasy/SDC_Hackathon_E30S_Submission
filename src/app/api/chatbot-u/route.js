import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req) {
  try {
    const { question } = await req.json();

    const stream = await ai.models.generateContentStream({
      model: "gemini-3.8-flash", // change back if your 3.8 name works
      contents: question,
      config: {
        systemInstruction: `
          - Answer the user's question in 3 sentences or fewer.
          - Answer only questions related to business and finance.
          - If the question is not about business or finance, reply exactly: Sorry, I can only answer business and finance questions.
        `,
        temperature: 1.0,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

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
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}