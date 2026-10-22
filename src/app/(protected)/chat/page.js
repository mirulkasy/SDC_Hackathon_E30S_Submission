<<<<<<< Updated upstream
import styles from "./chat.module.css";

export default function ChatPage() {
  return (<main className={styles.chatPage}></main>);
}
=======
"use client";
 
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
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
 
export default function ChatPage() {
  const [greeting, setGreeting] = useState(GREETINGS[0]);
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState([]);
  const fileInputRef = useRef(null);
 
  // Randomise after mount so server and client HTML match (no hydration error)
  useEffect(() => {
    setGreeting(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
  }, []);
 
  const canSend = message.trim().length > 0 || attachments.length > 0;
 
  function handleNewChat() {
    setMessage("");
    setAttachments([]);
    setGreeting(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
    // TODO: clear conversation state from the AI model here
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
    // TODO: send { text: message, files: attachments } to teammate's AI model
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
 
  return (
    <main className={styles.chatPage}>
      {/* ── Section 1: Top bar ── */}
      <section className={styles.topBar}>
        <Link href="/" className={styles.topButton} aria-label="Back to homepage">
          <Image src="/assets/icon/back.svg" alt="" width={40} height={40} />
        </Link>
        <button
          type="button"
          className={styles.topButton}
          onClick={handleNewChat}
          aria-label="Start new chat"
        >
          <Image src="/assets/icon/contract-edit.svg" alt="" width={40} height={40} />
        </button>
      </section>
 
      {/* ── Section 2: Mascot & greeting ── */}
      <section className={styles.mascotSection}>
        <div className={styles.mascot}>
          <Image
            src="/assets/icon/profile.svg"
            alt="AI mascot"
            width={150}
            height={150}
          />
          <h1>{greeting}</h1>
        </div>
      </section>
 
      {/* ── Section 3: Suggestions ── */}
      <section className={styles.suggestSection}>
        <div className={styles.suggestGrid}>
          {SUGGESTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.suggestItem}
              onClick={() => setMessage(item.label)}
            >
              <Image src="/assets/icon/profile.svg" alt="" width={30} height={30} />
              <p>{item.label}</p>
            </button>
          ))}
        </div>
      </section>
 
      {/* ── Section 4: Chat box ── */}
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
                <span aria-hidden="true">×</span>
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
            <Image src="/assets/icon/add.svg" alt="" width={30} height={30} />
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
            <Image src="/assets/icon/right.svg" alt="" width={24} height={24} />
          </button>
        </div>
      </section>
    </main>
  );
}
>>>>>>> Stashed changes
