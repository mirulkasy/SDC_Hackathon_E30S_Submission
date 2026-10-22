"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import styles from "./chat.module.css";

const GREETINGS = [
  "How can we help you?",
  "What are you working on today?",
  "Ready when you are",
  "What would you like to do?",
  "Ask us anything",
];

const SUGGESTIONS = [
  { id: "spreadsheet", label: "Make a spreadsheet" },
  { id: "products", label: "Search for products" },
  { id: "summarise", label: "Summarise a document" },
];

// Mock history for the sidebar. Replace with real conversations later.
const CHAT_HISTORY = [
  {
    group: "Today",
    chats: [
      {
        id: "c1",
        title: "Price my nasi lemak set",
        preview: "Based on your costs, RM 12.90 gives about 38% profit...",
        time: "2:14 PM",
      },
      {
        id: "c2",
        title: "Low stock this week",
        preview: "Eggs, cooking oil and sugar are below the minimum.",
        time: "10:02 AM",
      },
    ],
  },
  {
    group: "Yesterday",
    chats: [
      {
        id: "c3",
        title: "SST registration help",
        preview: "You only need to register once taxable turnover passes...",
        time: "Thu",
      },
    ],
  },
  {
    group: "Previous 7 days",
    chats: [
      {
        id: "c4",
        title: "Summarise supplier invoice",
        preview: "The invoice totals RM 3,420 across 14 line items.",
        time: "Mon",
      },
      {
        id: "c5",
        title: "Weekend promo ideas",
        preview: "A Friday lunch bundle worked best for similar stalls.",
        time: "Sun",
      },
    ],
  },
];

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
  spreadsheet:
    "M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625c0-.621.504-1.125 1.125-1.125h18.75c.621 0 1.125.504 1.125 1.125v12.75m-21.75 0a1.125 1.125 0 0 0 1.125 1.125m20.625 0a1.125 1.125 0 0 1-1.125-1.125m-8.25-9.75h3.375c.621 0 1.125.504 1.125 1.125v3.375c0 .621-.504 1.125-1.125 1.125H12.75m-3.75-4.5v4.5m4.5-4.5h3m-3 2.25h3m-3 2.25h3m-7.5 0H9m3.75 0H9",
  products:
    "m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z",
  summarise:
    "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
};

export default function ChatPage() {
  const [greeting, setGreeting] = useState(GREETINGS[0]);
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeChat, setActiveChat] = useState(null);
  const [historySearch, setHistorySearch] = useState("");
  const fileInputRef = useRef(null);

  // Randomise after mount so server and client HTML match (no hydration error)
  useEffect(() => {
    setGreeting(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
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

  const canSend = message.trim().length > 0 || attachments.length > 0;

  function handleNewChat() {
    setMessage("");
    setAttachments([]);
    setActiveChat(null);
    setSidebarOpen(false);
    setGreeting(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
    // TODO: clear conversation state from the AI model here
  }

  function handleSelectChat(id) {
    setActiveChat(id);
    setSidebarOpen(false);
    // TODO: load this conversation
  }

  function handleFiles(event) {
    const picked = Array.from(event.target.files || []);
    setAttachments((prev) => [...prev, ...picked]);
    event.target.value = ""; // allow re-picking the same file
  }

  function removeAttachment(index) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSend() {
    if (!canSend) return;
    // TODO: send { text: message, files: attachments } to the AI model
    console.log({ text: message, files: attachments });
    setMessage("");
    setAttachments([]);
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  const filteredHistory = CHAT_HISTORY.map((g) => ({
    ...g,
    chats: g.chats.filter((c) =>
      c.title.toLowerCase().includes(historySearch.toLowerCase()),
    ),
  })).filter((g) => g.chats.length > 0);

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
                <button
                  key={chat.id}
                  type="button"
                  className={`${styles.chatCard} ${
                    activeChat === chat.id ? styles.chatCardActive : ""
                  }`}
                  onClick={() => handleSelectChat(chat.id)}
                  aria-current={activeChat === chat.id ? "true" : undefined}
                >
                  <span className={styles.chatCardIcon}>
                    <Icon d={ICONS.bubble} size={18} />
                  </span>
                  <span className={styles.chatCardBody}>
                    <span className={styles.chatCardTop}>
                      <span className={styles.chatCardTitle}>{chat.title}</span>
                      <span className={styles.chatCardTime}>{chat.time}</span>
                    </span>
                    <span className={styles.chatCardPreview}>
                      {chat.preview}
                    </span>
                  </span>
                </button>
              ))}
            </section>
          ))}

          {filteredHistory.length === 0 && (
            <p className={styles.historyEmpty}>No chats found</p>
          )}
        </div>
      </aside>

      {/* ── Custom top bar: menu · logo · new chat ── */}
      <header className={styles.topBar}>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={() => setSidebarOpen(true)}
          aria-label="Open chat history"
          aria-expanded={sidebarOpen}
        >
          <Icon d={ICONS.menu} />
        </button>

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

      <main className={styles.chatPage}>
        {/* ── Mascot & greeting ── */}
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

        {/* ── Quick suggestions ── */}
        <section className={styles.suggestSection} aria-label="Suggestions">
          <div className={styles.suggestRow}>
            {SUGGESTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.suggestChip}
                onClick={() => setMessage(item.label)}
              >
                <Icon d={ICONS[item.id]} size={18} />
                {item.label}
              </button>
            ))}
          </div>
        </section>

        {/* ── Chat box ── */}
        <section className={styles.chatBoxSection}>
          {attachments.length > 0 && (
            <div className={styles.attachmentList}>
              {attachments.map((file, index) => (
                <button
                  key={`${file.name}-${index}`}
                  type="button"
                  className={styles.attachmentChip}
                  onClick={() => removeAttachment(index)}
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
              multiple
              hidden
              onChange={handleFiles}
            />
            <button
              type="button"
              className={styles.addButton}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Add images or files"
            >
              <Icon d={ICONS.plus} strokeWidth={2} />
            </button>

            <input
              type="text"
              className={styles.chatInput}
              placeholder="Ask me anything"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
            />

            <button
              type="button"
              className={styles.sendButton}
              onClick={handleSend}
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
