"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { WRITE_TOOLS, executeAction } from "@/lib/chatTools";
import {
  addMessage,
  createChat,
  patchChat,
  removeChat,
  subscribeChats,
  subscribeMessages,
  updateMessage,
} from "@/lib/chat";
import { messageToText, runAgent } from "@/lib/chatAgent";
import { MAX_FILES, fileToPayload } from "@/lib/chatFiles";
import styles from "./chat.module.css";
import ui from "./chatMessages.module.css";
import Link from "next/link";

const GREETINGS = [
  "How can we help you?",
  "What are you working on today?",
  "Ready when you are",
  "What would you like to do?",
  "Ask us anything",
];

const SUGGESTIONS = [
  { label: "Add a new product", icon: "products" },
  { label: "Record a sale", icon: "spreadsheet" },
  { label: "How is my week going?", icon: "summarise" },
  { label: "What is low on stock?", icon: "products" },
];

// Summarise once this many messages are unsummarised; keep the newest KEEP as-is
const SUMMARY_TRIGGER = 14;
const SUMMARY_KEEP = 6;
const MAX_CONTEXT_MESSAGES = 24;

function Icon({ d, size = 22, strokeWidth = 1.5 }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={strokeWidth}
      stroke="currentColor"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

const ICONS = {
  menu: "M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5",
  close: "M6 18 18 6M6 6l12 12",
  compose:
    "M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10",
  search:
    "m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z",
  bubble:
    "M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z",
  plus: "M12 4.5v15m7.5-7.5h-15",
  send: "M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3",
  trash:
    "m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0",
  spreadsheet:
    "M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625c0-.621.504-1.125 1.125-1.125h18.75c.621 0 1.125.504 1.125 1.125v12.75m-21.75 0a1.125 1.125 0 0 0 1.125 1.125m20.625 0a1.125 1.125 0 0 1-1.125-1.125m-8.25-9.75h3.375c.621 0 1.125.504 1.125 1.125v3.375c0 .621-.504 1.125-1.125 1.125H12.75m-3.75-4.5v4.5m4.5-4.5h3m-3 2.25h3m-3 2.25h3m-7.5 0H9m3.75 0H9",
  products:
    "m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z",
  summarise:
    "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
};

/* ---------------- helpers ---------------- */

const pickGreeting = () =>
  GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
const makeTitle = (t) => {
  const s = String(t).replace(/\s+/g, " ").trim();
  return s.length > 40 ? `${s.slice(0, 40).trimEnd()}…` : s || "New chat";
};
const makePreview = (t) => String(t).replace(/\s+/g, " ").trim().slice(0, 90);

function groupChats(list) {
  const day = 86400000;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const t = start.getTime();
  const groups = { Today: [], Yesterday: [], "Previous 7 days": [], Older: [] };
  for (const c of list) {
    const u = c.updatedAt || 0;
    if (u >= t) groups.Today.push(c);
    else if (u >= t - day) groups.Yesterday.push(c);
    else if (u >= t - 7 * day) groups["Previous 7 days"].push(c);
    else groups.Older.push(c);
  }
  return Object.entries(groups)
    .filter(([, v]) => v.length)
    .map(([group, chats]) => ({ group, chats }));
}

function timeLabel(ts) {
  const d = new Date(ts || Date.now());
  return new Date().toDateString() === d.toDateString()
    ? d.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("en-MY", { day: "numeric", month: "short" });
}

/* ---------------- tiny text renderer (**bold**, - lists, 1. lists) ---------------- */

const inline = (text) =>
  text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((p, i) =>
      p.length > 4 && p.startsWith("**") && p.endsWith("**") ? (
        <strong key={i}>{p.slice(2, -2)}</strong>
      ) : (
        p
      ),
    );

function RichText({ text }) {
  const blocks = String(text || "").split(/\n{2,}/);
  return blocks.map((block, i) => {
    const lines = block.split("\n");
    if (lines.every((l) => /^\s*[-•]\s+/.test(l))) {
      return (
        <ul key={i}>
          {lines.map((l, j) => (
            <li key={j}>{inline(l.replace(/^\s*[-•]\s+/, ""))}</li>
          ))}
        </ul>
      );
    }
    if (lines.every((l) => /^\s*\d+\.\s+/.test(l))) {
      return (
        <ol key={i}>
          {lines.map((l, j) => (
            <li key={j}>{inline(l.replace(/^\s*\d+\.\s+/, ""))}</li>
          ))}
        </ol>
      );
    }
    return (
      <p key={i}>
        {lines.map((l, j) => (
          <span key={j}>
            {j > 0 && <br />}
            {inline(l)}
          </span>
        ))}
      </p>
    );
  });
}

/* ---------------- approval card ---------------- */

const KIND_LABEL = { add: "Add", update: "Update", delete: "Delete" };

function ActionCard({ action, running, onAllow, onDeny }) {
  const working = action.status === "running" && running;
  const waiting =
    action.status === "pending" ||
    action.status === "failed" ||
    (action.status === "running" && !running);

  return (
    <div className={ui.card}>
      <div className={ui.cardHead}>
        <span className={`${ui.kind} ${ui[`kind_${action.kind}`] ?? ""}`}>
          {KIND_LABEL[action.kind] ?? "Change"}
        </span>
        <h4>{action.title}</h4>
      </div>

      <div className={ui.rows}>
        {action.rows.map((r, i) => (
          <div key={i} className={ui.row}>
            <span>{r.label}</span>
            <b>
              {r.from !== undefined && (
                <span className={ui.from}>{r.from}</span>
              )}
              {r.value}
            </b>
          </div>
        ))}
      </div>

      {action.warnings?.map((w, i) => (
        <p key={i} className={ui.warning}>
          ⚠ {w}
        </p>
      ))}

      {action.status === "failed" && (
        <p className={ui.failed}>
          Failed: {action.note || "Something went wrong."}
        </p>
      )}

      {waiting && (
        <div className={ui.cardActions}>
          <button
            type="button"
            className={`${ui.allowBtn} ${action.kind === "delete" ? ui.allowDanger : ""}`}
            onClick={onAllow}
          >
            {action.status === "failed" ? "Try again" : "Allow"}
          </button>
          <button type="button" className={ui.denyBtn} onClick={onDeny}>
            Deny
          </button>
        </div>
      )}
      {working && <p className={ui.cardState}>Working…</p>}
      {action.status === "done" && (
        <p className={ui.cardDone}>✓ {action.note || "Done."}</p>
      )}
      {action.status === "rejected" && (
        <p className={ui.cardState}>Denied. Nothing changed.</p>
      )}
    </div>
  );
}

function InterviewCard({ form, action, running, onSubmit, onCancel }) {
  const [values, setValues] = useState({});
  const known = action?.args || {};

  // value the user typed, else what the AI already filled in
  const current = (key) =>
    values[key] !== undefined && values[key] !== "" ? values[key] : known[key];

  // Food products also need a due date once the category is known
  const needsDueDate =
    form.fields.some((f) => f.key === "dueDate") &&
    current("category") === "Food";

  const visibleFields = form.fields.filter(
    (f) =>
      form.missingKeys.includes(f.key) ||
      (f.key === "dueDate" && needsDueDate && !known.dueDate),
  );

  const requiredKeys = [
    ...form.missingKeys,
    ...(needsDueDate && !known.dueDate ? ["dueDate"] : []),
  ];
  const complete = requiredKeys.every(
    (k) => values[k] !== undefined && values[k] !== "",
  );

  // Details the AI already understood, shown read-only
  const knownRows = form.fields
    .filter((f) => known[f.key] != null && known[f.key] !== "")
    .map((f) => {
      const raw = known[f.key];
      const label =
        f.type === "select"
          ? (f.options.find((o) => o.value === raw)?.label ?? raw)
          : raw;
      return { key: f.key, label: f.label, value: String(label) };
    });

  const fieldValue = (f) =>
    f.type === "number"
      ? values[f.key] === undefined || values[f.key] === ""
        ? ""
        : Number(values[f.key])
      : (values[f.key] ?? "");

  return (
    <div className={ui.formCard}>
      <div className={ui.formCardHead}>
        <h4>{form.title}</h4>
        <span className={ui.formStep}>{visibleFields.length} missing</span>
      </div>

      {knownRows.length > 0 && (
        <div className={ui.rows}>
          {knownRows.map((r) => (
            <div key={r.key} className={ui.row}>
              <span>{r.label}</span>
              <b>{r.value}</b>
            </div>
          ))}
        </div>
      )}

      {visibleFields.map((f) => (
        <div key={f.key} className={ui.formField}>
          <label>
            {f.label}
            {requiredKeys.includes(f.key) && <span> *</span>}
          </label>
          {f.type === "select" ? (
            <select
              className={ui.formSelect}
              value={values[f.key] ?? ""}
              onChange={(e) =>
                setValues((v) => ({ ...v, [f.key]: e.target.value }))
              }
            >
              <option value="">Select…</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              className={ui.formInput}
              type={
                f.type === "number"
                  ? "number"
                  : f.type === "date" || f.key === "dueDate"
                    ? "date"
                    : "text"
              }
              inputMode={f.type === "number" ? "decimal" : undefined}
              min={f.min}
              step={f.type === "number" ? "any" : undefined}
              placeholder={f.placeholder}
              value={fieldValue(f)}
              onChange={(e) =>
                setValues((v) => ({ ...v, [f.key]: e.target.value }))
              }
            />
          )}
        </div>
      ))}

      <div className={ui.formCardActions}>
        <button
          type="button"
          className={ui.allowBtn}
          disabled={!complete || running}
          onClick={() => onSubmit(values)}
        >
          Confirm
        </button>
        <button
          type="button"
          className={ui.denyBtn}
          onClick={onCancel}
          disabled={running}
        >
          Cancel
        </button>
      </div>
      {!complete && (
        <p className={ui.cardState}>Fill in the required fields, or cancel.</p>
      )}
    </div>
  );
}

/* ---------------- page ---------------- */

export default function ChatPage() {
  const { user, profile } = useAuth();
  const orgId = profile?.orgId;

  const [greeting, setGreeting] = useState(GREETINGS[0]);
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");

  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [org, setOrg] = useState(null);

  const [busy, setBusy] = useState(false);
  const [stepLabel, setStepLabel] = useState("");
  const [error, setError] = useState("");
  const [runningKeys, setRunningKeys] = useState(new Set());

  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);
  const messagesRef = useRef([]);
  const chatsRef = useRef([]);
  const runningRef = useRef(new Set());
  messagesRef.current = messages;
  chatsRef.current = chats;

  useEffect(() => {
    setGreeting(pickGreeting());
  }, []);

  // Sidebar: lock page scroll and close on Escape
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e) => e.key === "Escape" && setSidebarOpen(false);
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [sidebarOpen]);

  // Organization name and type (sent to the AI as context)
  useEffect(() => {
    if (!orgId) return;
    getDoc(doc(db, "organizations", orgId))
      .then((s) => s.exists() && setOrg(s.data()))
      .catch(() => {});
  }, [orgId]);

  // Chat list
  useEffect(() => {
    if (!orgId || !user) return;
    return subscribeChats(orgId, user.uid, setChats);
  }, [orgId, user]);

  // Messages of the open chat
  useEffect(() => {
    setMessages([]);
    if (!orgId || typeof orgId !== "string") return;
    if (!activeId || typeof activeId !== "string") return;
    return subscribeMessages(orgId, activeId, setMessages);
  }, [orgId, activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, busy, stepLabel]);

  const canSend =
    (message.trim().length > 0 || attachments.length > 0) && !busy;
  const showThread = messages.length > 0 || busy;

  /* ---------- sidebar actions ---------- */

  function handleNewChat() {
    if (busy) return;
    setActiveId(null);
    setMessage("");
    setAttachments([]);
    setError("");
    setSidebarOpen(false);
    setGreeting(pickGreeting());
  }

  function handleSelectChat(id) {
    if (busy) return;
    setActiveId(id);
    setError("");
    setSidebarOpen(false);
  }

  async function handleDeleteChat(c) {
    if (busy || !window.confirm(`Delete "${c.title}"? This cannot be undone.`))
      return;
    if (activeId === c.id) setActiveId(null);
    try {
      await removeChat(orgId, c.id);
    } catch (err) {
      console.error(err);
      setError("Couldn't delete that chat.");
    }
  }

  /* ---------- files ---------- */

  async function handleFiles(event) {
    const picked = Array.from(event.target.files || []);
    event.target.value = "";
    setError("");
    const room = MAX_FILES - attachments.length;
    if (picked.length > room)
      setError(`You can attach up to ${MAX_FILES} files.`);
    const next = [];
    for (const f of picked.slice(0, Math.max(room, 0))) {
      try {
        next.push(await fileToPayload(f));
      } catch (err) {
        setError(err.message);
      }
    }
    setAttachments((prev) => [...prev, ...next]);
  }

  /* ---------- sending ---------- */

  async function send(override) {
    const typed = String(override ?? message).trim();
    if ((!typed && attachments.length === 0) || busy || !orgId || !user) return;

    const text = typed || "Please process the attached file(s).";
    const files = attachments;
    setError("");
    setBusy(true);
    setStepLabel("Thinking…");

    let chatId = activeId;
    let chat = chatsRef.current.find((c) => c.id === chatId);
    if (!chatId) {
      chatId = await createChat({
        orgId,
        uid: user.uid,
        title: makeTitle(text),
      });
      if (!chatId || typeof chatId !== "string") {
        setError("Could not create chat. Please try again.");
        setBusy(false);
        return;
      }
      chat = { summary: "", summarizedUpTo: 0 };
      setActiveId(chatId);
    }

    const userMsg = {
      role: "user",
      text: text.slice(0, 2000),
      attachments: files.map((f) => ({ name: f.name })),
      ts: Date.now(),
    };
    const userId = addMessage(orgId, chatId, userMsg, user.uid);
    setMessage("");
    setAttachments([]);

    // Only what the AI needs: the saved summary + messages newer than it
    const upTo = chat?.summarizedUpTo || 0;
    const base = (activeId === chatId ? messagesRef.current : []).filter(
      (m) => m.ts > upTo,
    );
    const unsummarized = [...base, { ...userMsg, id: userId }];

    try {
      const result = await runAgent({
        messages: unsummarized.slice(-MAX_CONTEXT_MESSAGES),
        summary: chat?.summary || "",
        context: {
          today: new Date().toLocaleDateString("en-CA"),
          weekday: new Date().toLocaleDateString("en-US", { weekday: "long" }),
          userName: profile?.name || user.displayName || "",
          role: profile?.role === "owner" ? "owner" : "staff",
          orgName: org?.name || "",
          businessType: org?.businessType || "",
        },
        ctx: { orgId, user, isOwner: profile?.role === "owner", files },
        onStep: setStepLabel,
      });

      const aiMsg = {
        role: "assistant",
        text: result.text,
        actions: result.actions,
        choices: result.choices,
        form: result.form || null,
        ts: Date.now(),
      };
      addMessage(orgId, chatId, aiMsg, user.uid);
      patchChat(orgId, chatId, {
        updatedAt: aiMsg.ts,
        lastPreview: makePreview(result.text),
      });
      maybeSummarize(chatId, chat?.summary || "", [...unsummarized, aiMsg]);
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong. Please try again.");
      patchChat(orgId, chatId, { updatedAt: Date.now() });
    } finally {
      setBusy(false);
      setStepLabel("");
    }
  }

  // Saves a short summary so the AI never has to re-read the whole chat
  async function maybeSummarize(chatId, previousSummary, unsummarized) {
    if (unsummarized.length <= SUMMARY_TRIGGER) return;
    const old = unsummarized.slice(0, unsummarized.length - SUMMARY_KEEP);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "summarize",
          previousSummary,
          messages: old.map((m) => ({
            role: m.role === "user" ? "user" : "assistant",
            text: messageToText(m),
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.summary) return;
      patchChat(orgId, chatId, {
        summary: data.summary,
        summarizedUpTo: old[old.length - 1].ts,
      });
    } catch {
      // try again after the next message
    }
  }

  /* ---------- approval cards ---------- */

  async function runActions(msg, ids, decision) {
    if (!activeId || runningRef.current.has(msg.id)) return;
    const chatId = activeId;
    runningRef.current.add(msg.id);
    setRunningKeys(new Set(runningRef.current));

    const latest = messagesRef.current.find((m) => m.id === msg.id) || msg;
    const actions = (latest.actions || []).map((a) => ({ ...a }));
    const save = () => updateMessage(orgId, chatId, msg.id, { actions });
    const ctx = { orgId, user, isOwner: profile?.role === "owner", files: [] };

    try {
      for (const id of ids) {
        const a = actions.find((x) => x.id === id);
        if (!a || !["pending", "failed", "running"].includes(a.status))
          continue;

        if (decision === "deny") {
          a.status = "rejected";
          a.note = "";
          save();
          continue;
        }
        a.status = "running";
        save();
        try {
          const out = await executeAction(a, ctx);
          a.status = "done";
          a.note = out?.note || "Done.";
        } catch (err) {
          console.error(err);
          a.status = "failed";
          a.note = err?.message || "Something went wrong.";
        }
        save();
      }
    } finally {
      runningRef.current.delete(msg.id);
      setRunningKeys(new Set(runningRef.current));
    }
  }

  async function submitInterview(m, values) {
    if (runningRef.current.has(m.id)) return;
    runningRef.current.add(m.id);
    setRunningKeys(new Set(runningRef.current));
    const chatId = activeId;
    const actions = (m.actions || []).map((a) => ({ ...a }));
    const a = actions[0];
    const ctx = { orgId, user, isOwner: profile?.role === "owner", files: [] };
    try {
      const merged = { ...a.args };
      for (const f of m.form.fields) {
        const v = values[f.key];
        if (v === undefined || v === "") continue;
        merged[f.key] = f.type === "number" ? Number(v) : v;
      }
      const prep = await WRITE_TOOLS[a.tool].prepare(merged, ctx);
      if (!prep.ok) {
        setError(prep.error);
        return;
      } // form stays open
      const out = await executeAction({ ...a, args: prep.args }, ctx);
      a.args = prep.args;
      a.title = prep.title;
      a.rows = prep.rows;
      a.status = "done";
      a.note = out?.note || "Done.";
      await updateMessage(orgId, chatId, m.id, {
        actions,
        form: { ...m.form, status: "done" },
      });
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong.");
    } finally {
      runningRef.current.delete(m.id);
      setRunningKeys(new Set(runningRef.current));
    }
  }

  async function cancelInterview(m) {
    const actions = (m.actions || []).map((a) => ({
      ...a,
      status: "rejected",
    }));
    await updateMessage(orgId, activeId, m.id, {
      actions,
      form: { ...m.form, status: "cancelled" },
    });
  }

  const isWaiting = (a) => ["pending", "failed", "running"].includes(a.status);

  function handleKeyDown(event) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      send();
    }
  }

  const q = historySearch.toLowerCase();
  const filteredHistory = groupChats(
    chats.filter(
      (c) =>
        (c.title || "").toLowerCase().includes(q) ||
        (c.lastPreview || "").toLowerCase().includes(q),
    ),
  );
  const lastId = messages[messages.length - 1]?.id;

  return (
    <>
      {/* ── Sidebar: chat history ── */}
      <div
        className={`${styles.backdrop} ${sidebarOpen ? styles.backdropOpen : ""}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />
      <aside
        className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}
        aria-label="Chat history"
        aria-hidden={!sidebarOpen}
        inert={!sidebarOpen}
      >
        <div className={styles.sidebarHeader}>
          <h2>Chats</h2>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <Icon d={ICONS.close} />
          </button>
        </div>

        <div className={styles.sidebarTools}>
          <button
            type="button"
            className={styles.newChatBtn}
            onClick={handleNewChat}
          >
            <Icon d={ICONS.compose} size={18} />
            New chat
          </button>
          <div className={styles.historySearch}>
            <Icon d={ICONS.search} size={16} />
            <input
              type="text"
              placeholder="Search chats"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.historyScroll}>
          {filteredHistory.map((group) => (
            <section key={group.group} className={styles.historyGroup}>
              <h3>{group.group}</h3>
              {group.chats.map((chat) => (
                <div key={chat.id} className={ui.chatRow}>
                  <button
                    type="button"
                    className={`${styles.chatCard} ${activeId === chat.id ? styles.chatCardActive : ""}`}
                    onClick={() => handleSelectChat(chat.id)}
                    aria-current={activeId === chat.id ? "true" : undefined}
                  >
                    <span className={styles.chatCardIcon}>
                      <Icon d={ICONS.bubble} size={18} />
                    </span>
                    <span className={styles.chatCardBody}>
                      <span className={styles.chatCardTop}>
                        <span className={styles.chatCardTitle}>
                          {chat.title}
                        </span>
                        <span className={styles.chatCardTime}>
                          {timeLabel(chat.updatedAt)}
                        </span>
                      </span>
                      <span className={styles.chatCardPreview}>
                        {chat.lastPreview}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={ui.chatDelete}
                    onClick={() => handleDeleteChat(chat)}
                    aria-label={`Delete chat ${chat.title}`}
                  >
                    <Icon d={ICONS.trash} size={16} />
                  </button>
                </div>
              ))}
            </section>
          ))}
          {filteredHistory.length === 0 && (
            <p className={styles.historyEmpty}>No chats found</p>
          )}
        </div>
      </aside>

      {/* ── Top bar ── */}
      <header className={styles.topBar}>
        <div className={styles.rightTopBar}>
          <Link type="button" href="/home">
            <svg
              className={styles.backIcon}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
              />
            </svg>
          </Link>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => setSidebarOpen(true)}
            aria-label="Open chat history"
            aria-expanded={sidebarOpen}
          >
            <Icon d={ICONS.menu} />
          </button>
        </div>
        <Image
          className={styles.topLogo}
          src="/assets/biscoach/logo.png"
          alt="Biscoach"
          width={110}
          height={33}
          priority
        />
        <button
          type="button"
          className={styles.iconBtn}
          onClick={handleNewChat}
          aria-label="New chat"
        >
          <Icon d={ICONS.compose} />
        </button>
      </header>

      <main className={`${styles.chatPage} ${ui.pageExtra}`}>
        {!showThread ? (
          <>
            <section className={styles.mascotSection}>
              <div className={styles.mascot}>
                <Image
                  src="/assets/biscoach/think.png"
                  alt="Biscoach mascot"
                  width={160}
                  height={160}
                />
                <h1>{greeting}</h1>
              </div>
            </section>

            <section className={styles.suggestSection} aria-label="Suggestions">
              <div className={styles.suggestRow}>
                {SUGGESTIONS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className={styles.suggestChip}
                    onClick={() => send(item.label)}
                    disabled={busy || !orgId}
                  >
                    <Icon d={ICONS[item.icon]} size={18} />
                    {item.label}
                  </button>
                ))}
              </div>
            </section>
          </>
        ) : (
          <section className={ui.thread} aria-live="polite">
            {messages.map((m) => {
              if (m.role === "user") {
                return (
                  <div key={m.id} className={ui.userRow}>
                    {m.attachments?.map((f, i) => (
                      <span key={i} className={ui.fileTag}>
                        📎 {f.name}
                      </span>
                    ))}
                    <div className={ui.userBubble}>{m.text}</div>
                  </div>
                );
              }

              const actions = m.actions || [];
              const waitingIds = actions.filter(isWaiting).map((a) => a.id);
              return (
                <div key={m.id} className={ui.aiRow}>
                  <div className={ui.aiText}>
                    <RichText text={m.text} />
                  </div>

                  {actions
                    .filter((a) => a.status !== "needs_input")
                    .map((a) => (
                      <ActionCard
                        key={a.id}
                        action={a}
                        running={runningKeys.has(m.id)}
                        onAllow={() => runActions(m, [a.id], "allow")}
                        onDeny={() => runActions(m, [a.id], "deny")}
                      />
                    ))}

                  {m.form?.status === "open" && m.actions?.[0] && (
                    <InterviewCard
                      form={m.form}
                      action={m.actions[0]}
                      running={runningKeys.has(m.id)}
                      onSubmit={(values) => submitInterview(m, values)}
                      onCancel={() => cancelInterview(m)}
                    />
                  )}
                  {m.form?.status === "done" && (
                    <p className={ui.formDone}>✓ Done.</p>
                  )}
                  {m.form?.status === "cancelled" && (
                    <p className={ui.formCancelled}>
                      Cancelled. Nothing changed.
                    </p>
                  )}

                  {waitingIds.length > 1 && !runningKeys.has(m.id) && (
                    <div className={ui.cardActions}>
                      <button
                        type="button"
                        className={ui.allowBtn}
                        onClick={() => runActions(m, waitingIds, "allow")}
                      >
                        Allow all ({waitingIds.length})
                      </button>
                      <button
                        type="button"
                        className={ui.denyBtn}
                        onClick={() => runActions(m, waitingIds, "deny")}
                      >
                        Deny all
                      </button>
                    </div>
                  )}

                  {m.id === lastId && !busy && m.choices?.length > 0 && (
                    <div className={ui.choices}>
                      {m.choices.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={ui.choice}
                          onClick={() => send(c)}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {busy && (
              <div className={ui.aiRow}>
                <div className={ui.typing}>
                  <span className={ui.dots}>
                    <i />
                    <i />
                    <i />
                  </span>
                  {stepLabel && <span>{stepLabel}</span>}
                </div>
              </div>
            )}
            <div ref={bottomRef} className={ui.bottomAnchor} />
          </section>
        )}

        {/* ── Chat box ── */}
        <section className={`${styles.chatBoxSection} ${ui.composer}`}>
          {error && (
            <p className={ui.errorBar} role="alert">
              {error}
            </p>
          )}

          {attachments.length > 0 && (
            <div className={styles.attachmentList}>
              {attachments.map((file, index) => (
                <button
                  key={`${file.name}-${index}`}
                  type="button"
                  className={styles.attachmentChip}
                  onClick={() =>
                    setAttachments((prev) => prev.filter((_, i) => i !== index))
                  }
                  aria-label={`Remove ${file.name}`}
                >
                  <span>{file.name}</span>
                  <span aria-hidden="true">&times;</span>
                </button>
              ))}
            </div>
          )}

          <div className={styles.chatBox}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              hidden
              onChange={handleFiles}
            />
            <button
              type="button"
              className={styles.addButton}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach receipts or files"
              disabled={busy}
            >
              <Icon d={ICONS.plus} strokeWidth={2} />
            </button>

            <input
              type="text"
              className={styles.chatInput}
              placeholder={
                attachments.length
                  ? "Add a note, or just send"
                  : "Ask me anything"
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
            />

            <button
              type="button"
              className={styles.sendButton}
              onClick={() => send()}
              disabled={!canSend}
              aria-label="Send message"
            >
              <Icon d={ICONS.send} size={20} strokeWidth={2} />
            </button>
          </div>
        </section>
      </main>
    </>
  );
}
