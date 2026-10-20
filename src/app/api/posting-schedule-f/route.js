import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

export async function POST(req) {
  try {
    const body = await req.json();

    const history = cleanHistory(body.history);
    const today = String(body.today ?? "").slice(0, 10);
    const weekStart = String(body.weekStart ?? "").slice(0, 10);
    const weekEnd = String(body.weekEnd ?? "").slice(0, 10);
    const timeZone = String(body.timeZone ?? "unknown").slice(0, 60);
    const isLastDayOfWeek = body.isLastDayOfWeek === true;

    // The model can't know the date or what is stored, so the app injects it here.
    const systemInstruction = `
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
2. If the history is empty (first week): suggest 2-3 good posting times based on general social media best practice, and say clearly that this is general guidance and not based on the user's own data yet. Ask them to enter their views at the end of the week so you can start learning their pattern.
3. If there is history: analyse ALL weeks, not just the most recent one. Compare views by day of week and by time of day, and look for patterns that repeat across weeks. Give slightly more weight to recent weeks, but keep earlier weeks in mind so one unusual week doesn't mislead you.
4. Recommend 2-3 specific day and time slots for the current week, best first. Each needs a short reason that refers to the data.
5. If there are fewer than 4 weeks of data, or only a few posts, set confidence to "low" and suggest that one of the slots be an untested time so the app can learn more.
6. If today is the last day of the week, set "reminder" to a short message asking the user to enter this week's views. Otherwise set it to null.
7. Be short and friendly. Don't repeat the reminder if there is nothing new.

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

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Posting history (JSON): ${JSON.stringify(history)}`,
      config: {
        responseMimeType: "application/json",
        systemInstruction,
        temperature: 0.4, // lower than 1.0 so the analysis stays consistent
      },
    });

    return NextResponse.json(JSON.parse(response.text ?? "{}"));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
