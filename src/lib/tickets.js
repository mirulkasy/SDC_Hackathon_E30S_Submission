import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

/* ------------------------------------------------------------------ */
/* Tickets live at organizations/{orgId}/tickets                       */
/* Statuses: open | in_progress | on_hold | resolved | closed          */
/* ------------------------------------------------------------------ */

export const TICKET_CATEGORIES = [
  { value: "cash_flow", label: "Cash Flow" },
  { value: "inventory", label: "Inventory" },
  { value: "invoice", label: "Invoice" },
  { value: "account", label: "Account" },
  { value: "bug", label: "Bug" },
  { value: "other", label: "Other" },
];

export const TICKET_PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export const TICKET_STATUSES = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

/* ---- Display metadata (label + CSS class name) ---- */

const STATUS_META = {
  open: { label: "Open", className: "statusOpen" },
  in_progress: { label: "In Progress", className: "statusInProgress" },
  on_hold: { label: "On Hold", className: "statusOnHold" },
  resolved: { label: "Resolved", className: "statusResolved" },
  closed: { label: "Closed", className: "statusClosed" },
};

const PRIORITY_META = {
  low: { label: "Low", className: "priorityLow" },
  medium: { label: "Medium", className: "priorityMedium" },
  high: { label: "High", className: "priorityHigh" },
};

export function getStatusMeta(status) {
  return STATUS_META[status] ?? STATUS_META.open;
}

export function getPriorityMeta(priority) {
  return PRIORITY_META[priority] ?? PRIORITY_META.medium;
}

export function getCategoryLabel(category) {
  return TICKET_CATEGORIES.find((c) => c.value === category)?.label ?? "Other";
}

/* ---- Mapping: Firestore doc -> UI shape ---- */

function toDate(value) {
  if (!value) return null;
  return value.toDate ? value.toDate() : new Date(value);
}

export function formatTicketDate(value) {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function mapTicket(id, data) {
  const created = toDate(data.createdAt);
  const resolved = toDate(data.resolvedAt);
  return {
    id,
    ticketNo: data.ticketNo ?? id.slice(0, 6).toUpperCase(),
    title: data.title ?? "-",
    description: data.description ?? "",
    category: data.category ?? "other",
    status: data.status ?? "open",
    priority: data.priority ?? "medium",
    reportedBy: data.reportedBy ?? { uid: null, name: "Unknown" },
    transactionId: data.transactionId ?? null,
    createdLabel: created ? formatTicketDate(created) : "",
    resolvedLabel: resolved ? formatTicketDate(resolved) : "",
  };
}

/* ---- Queries ---- */

/** Live ticket list, newest first. */
export function subscribeTickets(orgId, callback) {
  const q = query(
    collection(db, "organizations", orgId, "tickets"),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => mapTicket(d.id, d.data())));
    },
    (err) => console.error("Tickets listener failed:", err),
  );
}

/** One-time read of a single ticket (detail page). */
export async function getTicket(orgId, ticketId) {
  const snap = await getDoc(
    doc(db, "organizations", orgId, "tickets", ticketId),
  );
  if (!snap.exists()) return null;
  return mapTicket(snap.id, snap.data());
}

/**
 * Create a ticket. The friendly number (TKT-0001, ...) comes from
 * counters/ticketNo, incremented safely inside a transaction so two
 * people submitting at once never get the same number.
 */
export async function addTicket({ orgId, user, ticket }) {
  const counterRef = doc(db, "organizations", orgId, "counters", "ticketNo");
  let ticketNo = "TKT-0001";
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? snap.data().value ?? 0 : 0;
    const next = current + 1;
    tx.set(counterRef, { value: next, updatedAt: serverTimestamp() });
    ticketNo = `TKT-${String(next).padStart(4, "0")}`;
  });

  const ref = await addDoc(collection(db, "organizations", orgId, "tickets"), {
    ticketNo,
    title: ticket.title.trim(),
    description: ticket.description.trim(),
    category: ticket.category,
    priority: ticket.priority,
    status: "open",
    reportedBy: {
      uid: user.uid,
      name: user.displayName ?? "Unknown",
    },
    transactionId: ticket.transactionId ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Change the status. Stamps resolvedAt when the ticket reaches a
 * terminal state so the UI can show when it was closed out.
 */
export async function updateTicketStatus({ orgId, ticketId, status }) {
  const terminal = status === "resolved" || status === "closed";
  await updateDoc(doc(db, "organizations", orgId, "tickets", ticketId), {
    status,
    resolvedAt: terminal ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  });
}