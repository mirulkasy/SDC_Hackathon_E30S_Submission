import { NextResponse } from "next/server";

// In-memory store for short-lived public CSV links, keyed by token.
// Good enough for a single dev/demo server; it resets on redeploy or
// cold start, which is fine since links are meant to be used right away.
const STORE = globalThis.__sheetExportStore ?? new Map();
globalThis.__sheetExportStore = STORE;

const TTL_MS = 30 * 60 * 1000; // 30 minutes
const ALLOWED_PAGES = new Set([
  "summary",
  "transaction",
  "report",
  "inventory",
]);

function cleanup() {
  const now = Date.now();
  for (const [token, entry] of STORE) {
    if (now - entry.createdAt > TTL_MS) STORE.delete(token);
  }
}

function makeToken() {
  return (
    crypto.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

// POST: client sends { csv, filename }, gets back a public GET url.
export async function POST(req, { params }) {
  const { page } = await params;
  if (!ALLOWED_PAGES.has(page)) {
    return NextResponse.json(
      { error: "Unknown export page." },
      { status: 400 },
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const csv = typeof body?.csv === "string" ? body.csv : "";
  if (!csv.trim()) {
    return NextResponse.json({ error: "No data to export." }, { status: 400 });
  }
  if (csv.length > 2_000_000) {
    return NextResponse.json(
      { error: "Export is too large." },
      { status: 413 },
    );
  }

  cleanup();
  const token = makeToken();
  STORE.set(token, {
    csv,
    page,
    filename: typeof body?.filename === "string" ? body.filename : page,
    createdAt: Date.now(),
  });

  const url = new URL(`/api/sheet/${page}`, req.url);
  url.searchParams.set("t", token);

  return NextResponse.json({
    token,
    url: url.toString(),
    expiresInMinutes: 30,
  });
}

// GET: public CSV fetch, used for direct download AND for Google Sheets'
// =IMPORTDATA(url), which fetches the url server-side with no auth/cookies.
export async function GET(req, { params }) {
  const { page } = await params;
  const token = new URL(req.url).searchParams.get("t");
  if (!token) {
    return NextResponse.json(
      { error: "Missing export token." },
      { status: 400 },
    );
  }

  cleanup();
  const entry = STORE.get(token);
  if (!entry || entry.page !== page) {
    return NextResponse.json(
      { error: "This export link has expired. Please export again." },
      { status: 404 },
    );
  }

  return new NextResponse(entry.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${entry.filename}.csv"`,
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
