"use client";

import { useState } from "react";

export default function DemoPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAsk() {
    if (!question.trim()) return;

    setLoading(true);
    setError("");
    setAnswer("");

    try {
      const res = await fetch("/api/chatbot-u", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Request failed");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setAnswer((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      setError("Could not reach the server. Is npm run dev running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 640,
        margin: "40px auto",
        padding: "0 16px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1>AI Demo</h1>
      <p>Type a question. The answer streams in live.</p>

      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Type your question here..."
        rows={4}
        style={{
          width: "100%",
          padding: 12,
          fontSize: 16,
          boxSizing: "border-box",
          color: "#000",
        }}
      />

      <button
        onClick={handleAsk}
        disabled={loading}
        style={{
          marginTop: 12,
          padding: "10px 20px",
          fontSize: 16,
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Thinking..." : "Send"}
      </button>

      {error && <p style={{ color: "crimson", marginTop: 16 }}>{error}</p>}

      {answer && (
        <>
          <h2>Answer</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{answer}</p>
        </>
      )}
    </main>
  );
}