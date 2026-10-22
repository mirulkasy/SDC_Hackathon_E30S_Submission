import {
  Timestamp,
  collection,
  doc,
  addDoc,
  serverTimestamp,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

/* ------------------------------------------------------------------ */
/* Money — schema stores integer sen: RM 12.50 = 1250                  */
/* ------------------------------------------------------------------ */

export function senToRM(sen) {
  return (sen ?? 0) / 100;
}

export function formatRMFromSen(sen) {
  return `RM ${senToRM(sen).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Ringgit formatter for UI-ready numbers (used by mapped transactions). */
export function formatRM(value) {
  return `RM ${value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/* ------------------------------------------------------------------ */
/* Date ranges                                                         */
/* ------------------------------------------------------------------ */

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: Timestamp.fromDate(start), end: Timestamp.fromDate(end) };
}

/** [start, end) Timestamps covering one "yyyy-MM" month key. */
function monthRange(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return {
    start: Timestamp.fromDate(new Date(year, month - 1, 1)),
    end: Timestamp.fromDate(new Date(year, month, 1)),
  };
}

/** The last `count` "yyyy-MM" keys, oldest first (for the month bar). */
export function recentMonthKeys(count = 12) {
  const keys = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  return keys;
}

/* ------------------------------------------------------------------ */
/* Mapping: Firestore doc -> the shape the UI already uses             */
/* ------------------------------------------------------------------ */

export function mapTransaction(id, data) {
  const date = data.date?.toDate ? data.date.toDate() : new Date(data.date);
  return {
    id,
    title: data.description ?? "-",
    category: data.category ?? "other",
    // schema: "in" | "out"  ->  UI: "earning" | "spending"
    type: data.type === "in" ? "earning" : "spending",
    amount: senToRM(data.amount),
    date: date.toISOString(),
    method: data.paymentMethod ?? "-",
    reference: id,
    note: data.note ?? "",
  };
}

function isVisible(data) {
  return !data.deletedAt && data.status !== "pending_review";
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

/** Live daily totals for the home page. */
export function subscribeDailyStats(orgId, callback) {
  const { start, end } = todayRange();
  const q = query(
    collection(db, "organizations", orgId, "transactions"),
    where("date", ">=", start),
    where("date", "<", end),
  );

  return onSnapshot(
    q,
    (snap) => {
      let sales = 0;
      let spending = 0;
      snap.forEach((doc) => {
        const d = doc.data();
        if (!isVisible(d)) return;
        if (d.type === "in") sales += d.amount ?? 0;
        else if (d.type === "out") spending += d.amount ?? 0;
      });
      callback({ sales, spending, profit: sales - spending, loaded: true });
    },
    (err) => console.error("Daily stats listener failed:", err),
  );
}

/** All confirmed transactions of one month, newest first. */
export function subscribeMonthTransactions(orgId, monthKey, callback) {
  const { start, end } = monthRange(monthKey);
  const q = query(
    collection(db, "organizations", orgId, "transactions"),
    where("date", ">=", start),
    where("date", "<", end),
  );

  return onSnapshot(
    q,
    (snap) => {
      const items = [];
      snap.forEach((doc) => {
        const data = doc.data();
        if (!isVisible(data)) return;
        items.push(mapTransaction(doc.id, data));
      });
      items.sort((a, b) => new Date(b.date) - new Date(a.date));
      callback(items);
    },
    (err) => console.error("Transaction listener failed:", err),
  );
}

/** One-time read of a single transaction (detail page). */
export async function getTransaction(orgId, txId) {
  const snap = await getDoc(
    doc(db, "organizations", orgId, "transactions", txId),
  );
  if (!snap.exists()) return null;
  const data = snap.data();
  if (!isVisible(data)) return null;
  return mapTransaction(snap.id, data);
}

/** Add one confirmed transaction. Amount arrives in RM and is stored as sen. */
export async function addTransaction({ orgId, user, transaction }) {
  const { type, amount, category, description, date, paymentMethod, note } =
    transaction;

  await addDoc(collection(db, "organizations", orgId, "transactions"), {
    type, // "in" | "out"
    amount: Math.round(amount * 100), // integer sen, matches the schema
    category,
    description: description.trim(),
    // date input gives "YYYY-MM-DD"; keep it at local midnight
    date: Timestamp.fromDate(new Date(`${date}T00:00:00`)),
    paymentMethod,
    note: note?.trim() ?? "",
    status: "confirmed",
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/* ------------------------------------------------------------------ */
/* Display helpers (moved from data/transactions.js)                   */
/* ------------------------------------------------------------------ */

export const categoryColors = {
  Salary: "#2563eb",
  Freelance: "#7c3aed",
  Investment: "#0891b2",
  Bonus: "#f59e0b",
  Food: "#e11d48",
  Transport: "#312e81",
  Utilities: "#0d9488",
  Entertainment: "#ea580c",
  Shopping: "#7d909b",
  // cash-flow schema categories
  sales: "#059669",
  stock_purchase: "#e11d48",
  rent: "#312e81",
  utilities: "#0d9488",
  salary: "#2563eb",
  marketing: "#ea580c",
  platform_fee: "#7d909b",
  tax: "#f59e0b",
  other: "#7d909b",
};

export function getCategoryColor(category) {
  return categoryColors[category] || "#7d909b";
}

export function formatAmount(item) {
  const sign = item.type === "earning" ? "+" : "-";
  return `${sign} ${formatRM(item.amount)}`;
}

export function formatDate(value) {
  return new Date(value).toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
