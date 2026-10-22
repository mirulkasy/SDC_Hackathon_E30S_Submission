"use client";

import { useEffect, useRef, useState } from "react";

const ENDPOINT = "/api/text-to-inventory";
const KEY = "text-to-inventory-v1";
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CHATS = 30;
const MAX_SAMPLES = 8;
const MAX_SEND = 12; // recent messages sent to the AI

const SUGGESTIONS = [
  "Received 50 boxes of cups at RM12 each from Ali Supplies",
  "Sold 10 boxes of straws today",
  "Beli 20 kg gula, RM3.20 satu kg",
  "How many cups do I have left?",
];

// ---------------- Saved data (lives in this browser) ----------------

const emptyStore = () => ({ chats: [], stock: [], styleNotes: "", samples: [] });

function loadStore() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyStore();
    const s = JSON.parse(raw);
    return { ...emptyStore(), ...s, chats: Array.isArray(s?.chats) ? s.chats : [], stock: Array.isArray(s?.stock) ? s.stock : [] };
  } catch {
    return emptyStore();
  }
}

function saveStore(store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // storage full or blocked: everything still works for this visit
  }
}

function newChat() {
  const now = Date.now();
  return {
    id: `chat-${now}-${Math.random().toString(36).slice(2, 8)}`,
    title: "New chat",
    createdAt: now,
    updatedAt: now,
    messages: [],
    summary: "",
  };
}

function makeTitle(text) {
  const t = String(text).replace(/\s+/g, " ").trim();
  return t.length > 40 ? `${t.slice(0, 40).trimEnd()}…` : t || "New chat";
}

function upsertChat(store, chat) {
  const exists = store.chats.some((c) => c.id === chat.id);
  const chats = exists ? store.chats.map((c) => (c.id === chat.id ? chat : c)) : [chat, ...store.chats];
  chats.sort((a, b) => b.updatedAt - a.updatedAt);
  return { ...store, chats: chats.slice(0, MAX_CHATS) };
}

function appendMessage(store, chatId, message) {
  const chat = store.chats.find((c) => c.id === chatId);
  if (!chat) return store;
  return upsertChat(store, { ...chat, messages: [...chat.messages, message], updatedAt: Math.max(chat.updatedAt, message.ts) });
}

// A chat nobody touched for a day gets summarised.
const needsSummary = (chat) => chat.messages.length >= 2 && Date.now() - chat.updatedAt >= DAY_MS;

function applySummary(store, chatId, summary, styleNotes, cutoffTs) {
  const chat = store.chats.find((c) => c.id === chatId);
  if (!chat) return store;
  const next = { ...store, styleNotes: styleNotes || store.styleNotes };
  return upsertChat(next, { ...chat, summary, messages: chat.messages.filter((m) => m.ts > cutoffTs) });
}

// Keeps a few short examples of how the owner writes.
function addSample(store, text) {
  const t = String(text).replace(/\s+/g, " ").trim().slice(0, 160);
  if (t.length < 8) return store;
  return { ...store, samples: [...store.samples, t].slice(-MAX_SAMPLES) };
}

// ---------------- Stock maths ----------------

const norm = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const round2 = (n) => Math.round(n * 100) / 100;
const fmtQty = (n) => Number(n).toLocaleString("en-MY", { maximumFractionDigits: 2 });
const money = (n, cur) => `${cur || "MYR"} ${Number(n).toFixed(2)}`;
const stockOf = (stock, name) => stock.find((r) => norm(r.name) === norm(name));

function itemLine(it) {
  const verb = it.action === "add" ? "Add" : it.action === "remove" ? "Remove" : "Set to";
  return `${verb} ${fmtQty(it.quantity)}${it.unit ? ` ${it.unit}` : ""} ${it.name}${
    it.unit_price != null ? ` @ ${money(it.unit_price, it.currency)}` : ""
  }`;
}

// What the AI sees from earlier messages (text plus what happened to the proposed update)
function plain(m) {
  if (!m.items || m.items.length === 0) return m.text;
  const state = m.state === "applied" ? "applied" : m.state === "discarded" ? "discarded" : "not applied yet";
  return `${m.text} [${state}: ${m.items.map(itemLine).join("; ")}]`;
}

function applyItems(stock, items) {
  const next = stock.map((r) => ({ ...r }));
  const warnings = [];
  const now = Date.now();
  for (const it of items) {
    let row = stockOf(next, it.name);
    if (!row) {
      row = { name: it.name, quantity: 0, unit: it.unit || null, unitPrice: null, currency: null, updatedAt: now };
      next.push(row);
    }
    if (it.action === "add") row.quantity += it.quantity;
    else if (it.action === "remove") {
      if (it.quantity > row.quantity) {
        warnings.push(`You only had ${fmtQty(row.quantity)} ${it.name}, so it is now 0.`);
      }
      row.quantity = Math.max(0, row.quantity - it.quantity);
    } else row.quantity = it.quantity;
    if (it.unit) row.unit = it.unit;
    if (it.unit_price != null && it.action === "add") {
      row.unitPrice = it.unit_price;
      row.currency = it.currency || "MYR";
    }
    row.quantity = round2(row.quantity);
    row.updatedAt = now;
  }
  return { stock: next, warnings };
}

function downloadCsv(stock) {
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    ["Product", "Quantity", "Unit", "Last buying price", "Currency", "Updated"].map(cell).join(","),
    ...stock.map((r) =>
      [r.name, r.quantity, r.unit, r.unitPrice, r.currency, new Date(r.updatedAt).toISOString().slice(0, 10)].map(cell).join(",")
    ),
  ];
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "stock.csv";
  a.click();
  URL.revokeObjectURL(url);
}

const whenLabel = (ts) => {
  const d = new Date(ts);
  return new Date().toDateString() === d.toDateString()
    ? d.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("en-MY", { day: "numeric", month: "short" });
};

const post = (body) =>
  fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// Chats being summarised right now (stops double requests, e.g. React strict mode)
const summarizing = new Set();

const ACTION_STYLE = {
  add: { bg: "#dcfce7", color: "#166534", label: "Add" },
  remove: { bg: "#fee2e2", color: "#991b1b", label: "Remove" },
  set: { bg: "#dbeafe", color: "#1e40af", label: "Set" },
};

export default function TextToInventoryPage() {
  const [store, setStore] = useState(null); // null until loaded from the browser
  const [activeId, setActiveId] = useState(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const storeRef = useRef(null);
  const bottomRef = useRef(null);
  storeRef.current = store;

  // Load saved chats and stock once
  useEffect(() => {
    const s = loadStore();
    setStore(s);
    if (s.chats[0]) setActiveId(s.chats[0].id);
  }, []);

  // Save on every change
  useEffect(() => {
    if (store) saveStore(store);
  }, [store]);

  // Summarise chats that have not been used for a day
  useEffect(() => {
    if (!store) return undefined;
    let cancelled = false;

    async function run() {
      const old = storeRef.current.chats.filter(needsSummary).slice(0, 5);
      for (const chat of old) {
        if (cancelled || summarizing.has(chat.id)) continue;
        summarizing.add(chat.id);
        try {
          const cutoff = chat.messages[chat.messages.length - 1].ts;
          const res = await post({
            action: "summarize",
            previousSummary: chat.summary || "",
            previousStyleNotes: storeRef.current?.styleNotes || "",
            messages: chat.messages.map((m) => ({ role: m.role, text: plain(m) })),
          });
          if (!res.ok) continue;
          const data = await res.json();
          if (data.summary) setStore((prev) => applySummary(prev, chat.id, data.summary, data.styleNotes, cutoff));
        } catch {
          // try again next time the page opens
        } finally {
          summarizing.delete(chat.id);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store === null]);

  const chats = store ? store.chats : [];
  const stock = store ? store.stock : [];
  const active = chats.find((c) => c.id === activeId) || null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [active?.messages.length, sending]);

  function startNewChat() {
    if (sending) return;
    setActiveId(null);
    setInput("");
    setError("");
  }

  function deleteChat(id) {
    if (sending) return;
    setStore((prev) => ({ ...prev, chats: prev.chats.filter((c) => c.id !== id) }));
    if (activeId === id) setActiveId(null);
  }

  async function send(textOverride) {
    const text = String(textOverride ?? input).trim();
    if (!text || sending || !store) return;

    setError("");
    const now = Date.now();
    const base = active ?? newChat();
    const chat = {
      ...base,
      title: base.title === "New chat" ? makeTitle(text) : base.title,
      messages: [...base.messages, { role: "user", text: text.slice(0, 2000), ts: now }],
      updatedAt: now,
    };
    const cur = storeRef.current;

    setActiveId(chat.id);
    setStore((prev) => addSample(upsertChat(prev, chat), text));
    setInput("");
    setSending(true);

    try {
      const res = await post({
        action: "chat",
        messages: chat.messages.slice(-MAX_SEND).map((m) => ({ role: m.role, text: plain(m) })),
        summary: chat.summary || "",
        styleNotes: cur.styleNotes,
        styleSamples: cur.samples,
        stock: cur.stock.map((r) => ({ name: r.name, quantity: r.quantity, unit: r.unit })),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      const items = Array.isArray(data.items) ? data.items : [];
      setStore((prev) =>
        appendMessage(prev, chat.id, {
          role: "model",
          text: data.reply || "Done.",
          ts: Date.now(),
          status: data.status,
          items,
          counterparty: data.counterparty || null,
          state: items.length ? "pending" : null,
        })
      );
    } catch {
      setError("Could not reach the server. Is npm run dev running?");
    } finally {
      setSending(false);
    }
  }

  // Apply or discard the update the AI proposed
  function resolve(chatId, ts, decision) {
    setStore((prev) => {
      const chat = prev.chats.find((c) => c.id === chatId);
      const msg = chat?.messages.find((m) => m.ts === ts);
      if (!msg || msg.state !== "pending") return prev;
      let nextStock = prev.stock;
      let note = "";
      if (decision === "applied") {
        const r = applyItems(prev.stock, msg.items);
        nextStock = r.stock;
        note = r.warnings.join(" ");
      }
      const messages = chat.messages.map((m) => (m === msg ? { ...m, state: decision, note } : m));
      return { ...upsertChat(prev, { ...chat, messages, updatedAt: Date.now() }), stock: nextStock };
    });
  }

  const setQty = (i, value) =>
    setStore((prev) => ({
      ...prev,
      stock: prev.stock.map((r, j) => (j === i ? { ...r, quantity: Math.max(0, Number(value) || 0), updatedAt: Date.now() } : r)),
    }));
  const removeRow = (i) => setStore((prev) => ({ ...prev, stock: prev.stock.filter((_, j) => j !== i) }));
  const clearStock = () => {
    if (window.confirm("Clear your whole stock list? Your chats are kept.")) setStore((prev) => ({ ...prev, stock: [] }));
  };

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  const bubble = (mine) => ({
    alignSelf: mine ? "flex-end" : "flex-start",
    maxWidth: "88%",
    padding: "8px 12px",
    borderRadius: 12,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    lineHeight: 1.45,
    fontSize: 15,
    background: mine ? "#2563eb" : "#f1f1f1",
    color: mine ? "#fff" : "#000",
  });
  const th = { textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #ddd", whiteSpace: "nowrap" };
  const td = { padding: "6px 8px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" };
  const empty = !active || (active.messages.length === 0 && !active.summary);

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif", color: "#000" }}>
      <h1>Text to Inventory</h1>
      <p>
        Just tell me what happened to your stock, the way you would tell a friend. I will turn it into an update for you
        to check. If I am not sure, I will ask.
      </p>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        {/* ---------- Chat ---------- */}
        <section style={{ flex: "2 1 380px", border: "1px solid #ddd", borderRadius: 10, padding: 12, background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Chat</h2>
            <button onClick={startNewChat} disabled={sending} style={{ padding: "6px 14px", cursor: sending ? "not-allowed" : "pointer" }}>
              + New chat
            </button>
          </div>

          {chats.length > 0 && (
            <details style={{ marginTop: 8, fontSize: 14 }}>
              <summary style={{ cursor: "pointer" }}>Past chats ({chats.length})</summary>
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                {chats.map((c) => (
                  <div
                    key={c.id}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", borderRadius: 6, background: c.id === activeId ? "#e8f0fe" : "#f7f7f7" }}
                  >
                    <button
                      onClick={() => !sending && setActiveId(c.id)}
                      style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 4, color: "#000" }}
                    >
                      {c.title}
                      <span style={{ fontSize: 12, opacity: 0.65 }}>
                        {" "}
                        · {whenLabel(c.updatedAt)}
                        {c.summary ? " · summarised" : ""}
                      </span>
                    </button>
                    <button onClick={() => deleteChat(c.id)} aria-label={`Delete chat ${c.title}`} style={{ cursor: "pointer", fontSize: 12 }}>
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}

          <div
            style={{
              marginTop: 10,
              height: 440,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: 8,
              background: "#fafafa",
              borderRadius: 8,
            }}
          >
            {active?.summary && (
              <div style={{ fontSize: 13, background: "#fff8e1", padding: 8, borderRadius: 8 }}>
                <strong>Earlier in this chat (short summary):</strong>
                <div style={{ marginTop: 4 }}>{active.summary}</div>
              </div>
            )}

            {empty && (
              <div style={{ margin: "auto", textAlign: "center", maxWidth: 420, fontSize: 15 }}>
                <p style={{ margin: "0 0 8px" }}>
                  <strong>Hi! Tell me about your stock.</strong>
                </p>
                <p style={{ margin: "0 0 12px", opacity: 0.8 }}>
                  Stock in, stock out, or a count. English, Bahasa Malaysia or a mix is fine. Try one:
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)} disabled={sending || !store} style={{ padding: "6px 10px", cursor: "pointer", textAlign: "left" }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {active?.messages.map((m, i) => {
              if (m.role === "user") {
                return (
                  <div key={`${m.ts}-${i}`} style={bubble(true)}>
                    {m.text}
                  </div>
                );
              }
              const items = m.items || [];
              return (
                <div key={`${m.ts}-${i}`} style={bubble(false)}>
                  {m.text}
                  {items.length > 0 && (
                    <div style={{ marginTop: 8, background: "#fff", borderRadius: 8, padding: 8, border: "1px solid #e5e5e5" }}>
                      {m.counterparty && <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>With: {m.counterparty}</div>}
                      {items.map((it, k) => {
                        const st = ACTION_STYLE[it.action];
                        const row = stockOf(stock, it.name);
                        const before = row ? row.quantity : 0;
                        const after = it.action === "add" ? before + it.quantity : it.action === "remove" ? Math.max(0, before - it.quantity) : it.quantity;
                        return (
                          <div key={k} style={{ padding: "4px 0", borderTop: k ? "1px solid #eee" : "none", fontSize: 14 }}>
                            <span style={{ background: st.bg, color: st.color, fontSize: 12, fontWeight: 600, padding: "1px 8px", borderRadius: 10, marginRight: 6 }}>
                              {st.label}
                            </span>
                            {itemLine(it).replace(/^(Add|Remove|Set to) /, "")}
                            {m.state === "pending" && (
                              <div style={{ fontSize: 12, opacity: 0.75 }}>
                                In stock now: {fmtQty(before)} → after: {fmtQty(after)}
                                {it.action === "remove" && it.quantity > before ? ` (you only have ${fmtQty(before)})` : ""}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {m.state === "pending" && (
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <button onClick={() => resolve(active.id, m.ts, "applied")} style={{ padding: "6px 14px", cursor: "pointer", fontWeight: 600 }}>
                            Apply to stock
                          </button>
                          <button onClick={() => resolve(active.id, m.ts, "discarded")} style={{ padding: "6px 14px", cursor: "pointer" }}>
                            Discard
                          </button>
                        </div>
                      )}
                      {m.state === "applied" && <div style={{ fontSize: 13, color: "#166534", marginTop: 6 }}>✓ Applied to your stock. {m.note}</div>}
                      {m.state === "discarded" && <div style={{ fontSize: 13, opacity: 0.7, marginTop: 6 }}>Discarded. Nothing changed.</div>}
                    </div>
                  )}
                </div>
              );
            })}

            {sending && <div style={bubble(false)}>Thinking...</div>}
            <div ref={bottomRef} />
          </div>

          {error && <p style={{ color: "crimson", margin: "8px 0 0", fontSize: 14 }}>{error}</p>}

          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "flex-end" }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Example: received 50 boxes of cups from Ali. Press Enter to send."
              rows={2}
              style={{ flex: 1, padding: 10, fontSize: 16, boxSizing: "border-box", color: "#000", resize: "vertical" }}
            />
            <button
              onClick={() => send()}
              disabled={sending || !input.trim() || !store}
              style={{ padding: "10px 18px", fontSize: 16, cursor: sending || !input.trim() ? "not-allowed" : "pointer" }}
            >
              {sending ? "..." : "Send"}
            </button>
          </div>
          <p style={{ fontSize: 12, opacity: 0.7, margin: "8px 0 0" }}>
            Chats and stock are saved in this browser only. A chat you do not use for a day is shortened into a summary
            (your stock list is not affected). The AI can make mistakes, so check each update before you apply it.
          </p>
        </section>

        {/* ---------- Stock list ---------- */}
        <section style={{ flex: "1 1 300px", border: "1px solid #ddd", borderRadius: 10, padding: 12, background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Your stock</h2>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => downloadCsv(stock)} disabled={!stock.length} style={{ cursor: stock.length ? "pointer" : "not-allowed" }}>
                Download CSV
              </button>
              <button onClick={clearStock} disabled={!stock.length} style={{ cursor: stock.length ? "pointer" : "not-allowed" }}>
                Clear
              </button>
            </div>
          </div>

          {stock.length === 0 ? (
            <p style={{ fontSize: 14, opacity: 0.8 }}>Nothing yet. When you apply an update from the chat, your products show up here.</p>
          ) : (
            <div style={{ overflowX: "auto", marginTop: 8 }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
                <thead>
                  <tr>
                    <th style={th}>Product</th>
                    <th style={th}>Qty</th>
                    <th style={th}>Last price</th>
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {stock.map((r, i) => (
                    <tr key={`${r.name}-${i}`}>
                      <td style={td}>{r.name}</td>
                      <td style={td}>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={r.quantity}
                          onChange={(e) => setQty(i, e.target.value)}
                          style={{ width: 72, padding: 4, color: "#000" }}
                          aria-label={`Quantity of ${r.name}`}
                        />{" "}
                        {r.unit || ""}
                      </td>
                      <td style={td}>{r.unitPrice != null ? money(r.unitPrice, r.currency) : "-"}</td>
                      <td style={td}>
                        <button onClick={() => removeRow(i)} aria-label={`Remove ${r.name}`} style={{ cursor: "pointer", fontSize: 12 }}>
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}