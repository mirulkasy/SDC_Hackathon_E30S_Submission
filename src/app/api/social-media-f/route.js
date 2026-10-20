import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// Keep only the fields we expect, so the prompt can't be bloated or polluted
function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-104) // at most ~2 years of weeks
    .map((week) => ({
      weekStart: String(week?.weekStart ?? "").slice(0, 10),
      posts: Array.isArray(week?.posts)
        ? week.posts.slice(0, 50).map((p) => ({
            day: String(p?.day ?? "").slice(0, 12),
            time: String(p?.time ?? "").slice(0, 5),
            views: Math.max(0, Number(p?.views) || 0),
          }))
        : [],
    }))
    .filter((w) => w.weekStart && w.posts.length > 0);
}

// Gemini sometimes wraps JSON in code fences even in JSON mode; be forgiving
function parseJson(text) {
  const cleaned = String(text ?? "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned || "{}");
}

function scheduleInstruction({ history, today, weekStart, weekEnd, timeZone, isLastDayOfWeek }) {
  return `
You are an assistant that helps the user get the maximum number of views on their social media posts by choosing WHEN to post. The user records their weekly view counts by hand, and you learn from all of the weeks recorded so far.

## Current context (provided by the app on every request)
- Today's date: ${today}
- Current week: ${weekStart} to ${weekEnd} (weeks run Monday to Sunday)
- User's time zone: ${timeZone} (all times below are in the user's local time)
- Number of past weeks recorded: ${history.length}
- Is today the last day of the week: ${isLastDayOfWeek}

## The data
The user message contains the full history as JSON: a list of weeks, each with the posts made that week (day, time posted, views received). This is the only data you may rely on.

## Rules
1. Never invent, estimate, or assume view counts. Only quote figures that appear in the history.
2. If the history is empty (first week): suggest 2-3 good posting times based on general social media best practice, and say clearly that this is general guidance and not based on the user's own data yet.
3. If there is history: analyse ALL weeks, not just the most recent one. Compare views by day of week and by time of day, and look for patterns that repeat across weeks. Give slightly more weight to recent weeks, but keep earlier weeks in mind so one unusual week doesn't mislead you.
4. Recommend 2-3 specific day and time slots for the current week, best first, each on a DIFFERENT day. Each needs a short reason that refers to the data. "day" must be a full English weekday name (Monday ... Sunday) and "time" must be 24-hour HH:MM.
5. If there are fewer than 4 weeks of data, or only a few posts, set confidence to "low" and make one of the slots an untested time so the app can learn more.
6. If today is the last day of the week, set "reminder" to a short message asking the user to enter this week's views. Otherwise set it to null.
7. Be short and friendly.

## Output
Return ONLY a JSON object in exactly this shape:
{
  "summary": "one or two friendly sentences",
  "recommended_times": [
    { "day": "Monday", "time": "18:00", "reason": "short reason" }
  ],
  "pattern_insights": ["short insight", "short insight"],
  "confidence": "low" | "medium" | "high",
  "weeks_analysed": ${history.length},
  "reminder": "string or null"
}
`;
}

function formatInstruction({ history, today, weekStart, weekEnd, timeZone, day, time, niche }) {
  return `
You are a short-form video strategist. The user will post on ${day} at ${time} (their local time, ${timeZone}) during the week ${weekStart} to ${weekEnd}. Today is ${today}. Suggest ONE video concept for that slot.

## What you know
- The user's niche / topic: ${niche || "not provided (keep the idea broadly applicable and say so in the tip)"}
- Their posting history is in the user message (day, time, views per post). It does NOT contain video content, so you cannot know which formats worked. Never claim a format "performed well" and never invent view counts. You may use the history only to judge the audience's mood at that time, e.g. whether ${day} ${time} is a historically strong slot.

## Guidance
- Match the format to the moment: a weekday evening audience is usually relaxed and scrolling; a morning audience wants quick, useful content; weekends suit longer, entertaining or story-led videos. Treat this as a general guide, not a fact about the user.
- Make it concrete and easy to film with a phone.
- Keep each field short (1-3 sentences).

## Output
Return ONLY a JSON object in exactly this shape:
{
  "title": "working title of the video",
  "context": "what the video is about and why it suits this day/time",
  "duration": "e.g. 20-30 seconds",
  "shot": "how to film it: framing, setting, hook in the first 2 seconds, editing style",
  "promo_caption": "ready-to-paste caption including 2-4 hashtags",
  "tip": "one short extra tip"
}
`;
}

export async function POST(req) {
  try {
    const body = await req.json();

    const mode = body.mode === "format" ? "format" : "schedule";
    const history = cleanHistory(body.history);
    const today = String(body.today ?? "").slice(0, 10);
    const weekStart = String(body.weekStart ?? "").slice(0, 10);
    const weekEnd = String(body.weekEnd ?? "").slice(0, 10);
    const timeZone = String(body.timeZone ?? "unknown").slice(0, 60);

    let systemInstruction;

    if (mode === "format") {
      const day = DAYS.includes(body.day) ? body.day : null;
      const time = /^\d{2}:\d{2}$/.test(String(body.time ?? "")) ? body.time : null;
      if (!day || !time) {
        return NextResponse.json({ error: "A valid day and time are required" }, { status: 400 });
      }
      const niche = String(body.niche ?? "").trim().slice(0, 200);
      systemInstruction = formatInstruction({
        history, today, weekStart, weekEnd, timeZone, day, time, niche,
      });
    } else {
      systemInstruction = scheduleInstruction({
        history,
        today,
        weekStart,
        weekEnd,
        timeZone,
        isLastDayOfWeek: body.isLastDayOfWeek === true,
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Posting history (JSON): ${JSON.stringify(history)}`,
      config: {
        responseMimeType: "application/json",
        systemInstruction,
        temperature: mode === "format" ? 0.9 : 0.4, // creative ideas vs consistent analysis
      },
    });

    return NextResponse.json(parseJson(response.text));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}