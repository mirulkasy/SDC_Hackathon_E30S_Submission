import { NextResponse } from "next/server";

// Read ONLY on the server, from this project's .env.local.
// Never prefix these with NEXT_PUBLIC_ (that would expose them to the browser).
const PROVIDER = (process.env.BALANCE_PROVIDER || "gemini").toLowerCase();
const LABEL = process.env.BALANCE_LABEL || "API key";
const TIMEOUT_MS = 8000;

const round2 = (n) => Math.round(n * 100) / 100;
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

class ConfigError extends Error {}
class UpstreamError extends Error {
  constructor(status) {
    super(`Upstream responded ${status}`);
    this.status = status;
  }
}

async function upstream(url, headers) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", ...headers },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new UpstreamError(res.status);
  return res;
}

// Each adapter returns a safe, normalised object. Raw provider responses are never forwarded.
const adapters = {
  // OpenRouter: GET /api/v1/credits -> { data: { total_credits, total_usage } }
  async openrouter() {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new ConfigError("OPENROUTER_API_KEY is not set");
    const res = await upstream("https://openrouter.ai/api/v1/credits", { Authorization: `Bearer ${key}` });
    const d = (await res.json())?.data ?? {};
    const total = num(d.total_credits);
    const used = num(d.total_usage);
    if (total === null || used === null) throw new Error("Unexpected response shape");
    return {
      provider: "OpenRouter",
      balanceSupported: true,
      currency: "USD",
      total: round2(total),
      used: round2(used),
      remaining: round2(total - used),
      note: null,
      dashboardUrl: "https://openrouter.ai/credits",
    };
  },

  // DeepSeek: GET /user/balance -> { is_available, balance_infos: [{ currency, total_balance }] }
  async deepseek() {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) throw new ConfigError("DEEPSEEK_API_KEY is not set");
    const res = await upstream("https://api.deepseek.com/user/balance", { Authorization: `Bearer ${key}` });
    const json = await res.json();
    const info = Array.isArray(json?.balance_infos) ? json.balance_infos[0] : null;
    const remaining = num(info?.total_balance);
    if (remaining === null) throw new Error("Unexpected response shape");
    return {
      provider: "DeepSeek",
      balanceSupported: true,
      currency: String(info.currency || "USD").slice(0, 5),
      total: null,
      used: null,
      remaining: round2(remaining),
      note: json?.is_available === false ? "Balance is too low to make API calls." : null,
      dashboardUrl: "https://platform.deepseek.com/usage",
    };
  },

  // Google Gemini: no public endpoint returns remaining credit.
  // We can only confirm the key works and link to the billing dashboard.
  async gemini() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new ConfigError("GEMINI_API_KEY is not set");
    await upstream("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", { "x-goog-api-key": key });
    return {
      provider: "Google Gemini",
      balanceSupported: false,
      currency: null,
      total: null,
      used: null,
      remaining: null,
      note: "Google does not offer a balance API for Gemini keys. Your key works, but check credit and spend in Google AI Studio or Google Cloud Billing.",
      dashboardUrl: "https://aistudio.google.com/usage",
    };
  },
};

// Short, safe messages for the browser. Full details only go to the server log.
function safeError(err) {
  console.error("[balance]", err?.name, err?.message);
  if (err instanceof ConfigError) return { status: 500, error: "The API key is missing on the server. Check your .env.local file." };
  if (err instanceof UpstreamError) {
    if ([400, 401, 403].includes(err.status)) return { status: 502, error: "The provider rejected this API key. It may be invalid, expired or revoked." };
    if (err.status === 429) return { status: 429, error: "Too many requests to the provider. Please wait a moment and refresh." };
    return { status: 502, error: "The provider is having problems right now. Please try again shortly." };
  }
  if (err?.name === "TimeoutError" || err?.name === "AbortError") return { status: 504, error: "The provider took too long to respond. Please try again." };
  return { status: 500, error: "Could not read the balance. Please try again." };
}

export async function GET() {
  const adapter = adapters[PROVIDER];
  if (!adapter) {
    console.error(`[balance] Unknown BALANCE_PROVIDER "${PROVIDER}"`);
    return NextResponse.json({ error: "Balance provider is not configured correctly." }, { status: 500 });
  }

  try {
    const data = await adapter();
    return NextResponse.json(
      { label: LABEL, ...data, checkedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const { status, error } = safeError(err);
    return NextResponse.json({ error }, { status });
  }
}