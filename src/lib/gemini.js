import { GoogleGenAI } from "@google/genai";

/**
 * Gemini with automatic key failover. Server-side only.
 *
 * .env.local:
 *   GEMINI_API_KEYS=key1,key2,key3,...,key10
 *   (GEMINI_API_KEY still works too; it is added as the last key)
 *
 * Keys are tried in order. A key that is busy / out of quota / invalid is put
 * on a short cooldown, so the next requests skip it instead of waiting on it.
 */

function loadKeys() {
  const list = (process.env.GEMINI_API_KEYS || "")
    .split(/[,\s]+/)
    .map((k) => k.trim())
    .filter(Boolean);
  if (process.env.GEMINI_API_KEY) list.push(process.env.GEMINI_API_KEY.trim());
  return [...new Set(list)];
}

const KEYS = loadKeys();
const clients = KEYS.map((apiKey) => new GoogleGenAI({ apiKey }));
const coolUntil = new Array(KEYS.length).fill(0);

const BUSY_COOLDOWN_MS = 60_000; // 429 / 5xx
const BAD_KEY_COOLDOWN_MS = 10 * 60_000; // revoked / invalid key

const BUSY_STATUS = new Set([429, 500, 502, 503, 504]);
const isBadKey = (err) =>
  err?.status === 401 ||
  err?.status === 403 ||
  /api key (not valid|expired)|API_KEY_INVALID/i.test(err?.message || "");
const shouldRotate = (err) => BUSY_STATUS.has(err?.status) || isBadKey(err);

export async function generateContent(params) {
  if (!clients.length) {
    throw new Error("No Gemini key found. Set GEMINI_API_KEYS in .env.local");
  }

  // Ready keys first (original order kept), cooling ones only as a last resort
  const now = Date.now();
  const order = clients
    .map((_, i) => i)
    .sort((a, b) => (coolUntil[a] > now) - (coolUntil[b] > now));

  let lastError;
  for (const i of order) {
    try {
      const res = await clients[i].models.generateContent(params);
      coolUntil[i] = 0;
      return res;
    } catch (err) {
      lastError = err;
      if (!shouldRotate(err)) throw err; // a real error (bad request, unknown model): don't burn other keys
      coolUntil[i] =
        Date.now() + (isBadKey(err) ? BAD_KEY_COOLDOWN_MS : BUSY_COOLDOWN_MS);
      console.warn(
        `[gemini] key #${i + 1}/${clients.length} failed (${err?.status}), trying the next one`,
      );
    }
  }
  throw lastError; // every key failed
}

// Drop-in stand-in so existing `ai.models.generateContent(...)` calls keep working
export const ai = { models: { generateContent } };