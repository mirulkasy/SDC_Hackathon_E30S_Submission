import { READ_RUNNERS, STEP_LABEL, WRITE_TOOLS } from "./chatTools";
import { buildInterview } from "./chatInterview";

const MAX_STEPS = 6;

const STATUS_TEXT = {
  needs_input: "waiting for the user to fill in a form",
  pending: "waiting for the user to approve",
  running: "waiting for the user to approve",
  done: "approved and done",
  rejected: "denied by the user, nothing changed",
  failed: "approved but failed",
};

/** Plain-text version of a stored message (this is what the AI sees from earlier turns). */
export function messageToText(m, { filesNow = false } = {}) {
  let text = m.text || "";
  if (m.role === "user" && m.attachments?.length) {
    const names = m.attachments.map((f) => f.name).join(", ");
    text += filesNow
      ? `\n[Attached files: ${names}. Use scan_receipts to read them.]`
      : `\n[Attached files: ${names} (already handled)]`;
  }
  if (m.role !== "user") {
    for (const a of m.actions || []) {
      const args = JSON.stringify(a.args || {}).slice(0, 300);
      text += `\n[Proposed: ${a.title} ${args} - ${STATUS_TEXT[a.status] || a.status}${a.note && a.status === "failed" ? `: ${a.note}` : ""}]`;
    }
    if (m.choices?.length)
      text += `\n[Offered options: ${m.choices.join(" | ")}]`;
  }
  return text.trim();
}

/** Saved messages -> Gemini contents (consecutive same-role messages are merged). */
export function buildContents(messages, filesNow) {
  const out = [];
  messages.forEach((m, i) => {
    const role = m.role === "user" ? "user" : "model";
    const text = messageToText(m, {
      filesNow: filesNow && i === messages.length - 1,
    });
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.role === role) last.parts[0].text += `\n\n${text}`;
    else out.push({ role, parts: [{ text }] });
  });
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

async function callChat(body) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(json.error || "Something went wrong. Please try again.");
  return json;
}

const fr = (name, result) => ({
  functionResponse: { name, response: { result } },
});
const cleanOptions = (opts) =>
  (Array.isArray(opts) ? opts : [])
    .map((o) => String(o).trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 6);

/**
 * Runs one user turn.
 *  - read tools run right away and their results go back to the model
 *  - write tools become approval cards (nothing is changed here)
 *  - ask_user ends the turn with a question
 * Returns { text, actions, choices }.
 */
export async function runAgent({ messages, summary, context, ctx, onStep }) {
  const convo = buildContents(messages, (ctx.files?.length ?? 0) > 0);

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await callChat({ contents: convo, summary, context });
    const calls = res.calls || [];

    if (calls.length === 0) {
      return {
        text:
          res.text ||
          "Sorry, I didn't catch that. Could you say it another way?",
        actions: [],
        choices: null,
      };
    }

    const hasAdd = calls.some(
      (c) => c.name === "add_product" || c.name === "add_transaction",
    );
    const ask = hasAdd ? null : calls.find((c) => c.name === "ask_user");
    if (ask) {
      const question = String(
        ask.args?.question || res.text || "Could you tell me a bit more?",
      ).trim();
      return {
        text: question,
        actions: [],
        choices: cleanOptions(ask.args?.options),
      };
    }

    const responses = [];
    const actions = [];
    const problems = [];
    let form = null;

    for (const call of calls) {
      const name = call.name;
      const args = call.args || {};

      if (READ_RUNNERS[name]) {
        onStep?.(STEP_LABEL[name] || "Working...");
        try {
          responses.push(fr(name, await READ_RUNNERS[name](args, ctx)));
        } catch (err) {
          console.error(name, err);
          responses.push(fr(name, { error: "Could not read that data." }));
        }
      } else if (WRITE_TOOLS[name]) {
        onStep?.("Preparing...");
        try {
          const draft = { tool: name, args };
          const interview = await buildInterview(draft, ctx);
          if (interview && !form) {
            form = {
              title: "A few details needed",
              status: "open",
              ...interview,
            };
            actions.push({
              id: `${Date.now()}-${actions.length}`,
              tool: name,
              kind: "add",
              title: "Waiting for your details",
              rows: [],
              warnings: [],
              args,
              status: "needs_input",
              note: "",
            });
            responses.push(fr(name, { status: "form_shown_to_user" }));
            continue;
          }
          const prep = await WRITE_TOOLS[name].prepare(args, ctx);
          if (prep.ok) {
            actions.push({
              id: `${Date.now()}-${actions.length}`,
              tool: name,
              kind: prep.kind,
              title: prep.title,
              rows: prep.rows,
              warnings: prep.warnings || [],
              args: prep.args,
              status: "pending",
              note: "",
            });
            responses.push(
              fr(name, { status: "shown_to_user_awaiting_approval" }),
            );
          } else {
            problems.push(prep.error);
            responses.push(fr(name, { error: prep.error }));
          }
        } catch (err) {
          console.error(name, err);
          problems.push("Could not prepare this action.");
          responses.push(fr(name, { error: "Could not prepare this action." }));
        }
      } else {
        responses.push(fr(name, { error: "Unknown tool." }));
      }
    }

    // Write proposals end the turn: the cards are the answer
    if (actions.length) {
      let text =
        res.text ||
        (form
          ? "Please fill in the details below."
          : /* existing text */ "Here's what I'll do. Tap Allow to confirm.");
      if (problems.length)
        text += `\n\nI couldn't prepare one of them: ${problems[0]}`;
      return { text, actions, choices: null, form };
    }

    // Otherwise feed the results back and let the model continue
    convo.push(res.modelContent, { role: "user", parts: responses });
  }

  return {
    text: "That needed too many steps. Could you try a simpler request?",
    actions: [],
    choices: null,
  };
}
