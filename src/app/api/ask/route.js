import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req) {
  try {
    const { question } = await req.json();


    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: question,
      config: {
        responseMimeType: "application/json",
        systemInstruction: `
      - Answer the user's question. Reply only with JSON in this format: {"answer": "your answer here"}
      - Answer only questions related to business and finance.
      - If the question is not about business or finance, reply with: {"answer": "Sorry, I can only answer business and finance questions."}
    `,
    temperature: 1.0,
      },
    });

    return NextResponse.json(JSON.parse(response.text ?? "{}"));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}