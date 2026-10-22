import { promises as fs } from "fs";
import path from "path";

// Saved next to the project. Add .usage-data.json to .gitignore.
const FILE = path.join(process.cwd(), ".usage-data.json");
const WARN_AT = Number(process.env.CREDIT_WARN_PERCENT) || 80;
const CRITICAL_AT = Number(process.env.CREDIT_CRITICAL_PERCENT) || 95;

let queue = Promise.resolve(); // makes saves happen one at a time
const dayKey = () => new Date().toISOString().slice(0, 10);
const round2 = (n) => Math.round(n * 100) / 100;

async function readData() {
  try {
    const d = JSON.parse(await fs.readFile(FILE, "utf8"));
    return { days: d?.days || {}, depletedAt: d?.depletedAt || null };
  } catch {
    return { days: {}, depletedAt: null };
  }
}

async function writeData(data) {
  try {
    await fs.writeFile(FILE, JSON.stringify(data));
  } catch (e) {
    console.error("[usage] could not save:", e?.message);
  }
}

function update(fn) {
  queue = queue
    .then(async () => {
      const data = await readData();
      fn(data);
      await writeData(data);
    })
    .catch((e) => console.error("[usage]", e?.message));
  return queue;
}

// Call after every successful Gemini request, with response.usageMetadata.
export function recordUsage(meta) {
  const input = Number(meta?.promptTokenCount) || 0;
  const output = (Number(meta?.candidatesTokenCount) || 0) + (Number(meta?.thoughtsTokenCount) || 0);
  if (!input && !output) return Promise.resolve();
  return update((data) => {
    const k = dayKey();
    const day = data.days[k] || { input: 0, output: 0 };
    day.input += input;
    day.output += output;
    data.days[k] = day;
    data.depletedAt = null; // a successful call means credit works
  });
}

// Call when Gemini says the credit has run out.
export function markDepleted() {
  return update((data) => {
    data.depletedAt = new Date().toISOString();
  });
}

export async function creditStatus() {
  const data = await readData();
  const start = process.env.GEMINI_CREDIT_START || "1970-01-01";

  let input = 0;
  let output = 0;
  for (const [k, v] of Object.entries(data.days)) {
    if (k >= start) {
      input += v.input || 0;
      output += v.output || 0;
    }
  }

  const tokenBudget = Number(process.env.GEMINI_TOKEN_BUDGET) || 0;
  const usdBudget = Number(process.env.GEMINI_BUDGET_USD) || 0;
  const priceIn = Number(process.env.GEMINI_PRICE_INPUT_PER_M) || 0;
  const priceOut = Number(process.env.GEMINI_PRICE_OUTPUT_PER_M) || 0;

  let unit = null;
  let used = 0;
  let budget = 0;
  if (tokenBudget > 0) {
    unit = "tokens";
    used = input + output;
    budget = tokenBudget;
  } else if (usdBudget > 0 && (priceIn > 0 || priceOut > 0)) {
    unit = "USD";
    used = (input * priceIn + output * priceOut) / 1e6;
    budget = usdBudget;
  }

  const percentUsed = budget > 0 ? Math.min(100, Math.round((used / budget) * 100)) : null;
  const percentLeft = percentUsed == null ? null : 100 - percentUsed;
  const depleted = Boolean(data.depletedAt) || percentUsed === 100;

  let level = "unknown"; // no budget set
  if (depleted) level = "depleted";
  else if (percentUsed != null) level = percentUsed >= CRITICAL_AT ? "critical" : percentUsed >= WARN_AT ? "low" : "ok";

  const message =
    level === "depleted"
      ? "The AI credit may have run out. Please ask the key owner to top up."
      : level === "critical"
        ? `AI credit is almost gone (about ${percentLeft}% left). Please top up now.`
        : level === "low"
          ? `AI credit is running low (about ${percentLeft}% left). Please plan a top-up soon.`
          : null;

  return {
    level,
    message,
    percentUsed,
    percentLeft,
    unit,
    used: round2(used),
    budget,
    input,
    output,
    since: start === "1970-01-01" ? null : start,
  };
}

// The small version that is safe to show to every visitor of the site.
export const publicCredit = (c) => ({ level: c.level, percentLeft: c.percentLeft, message: c.message });