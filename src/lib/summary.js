import {
  Timestamp,
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { getCategoryColor } from "./transactions";

const toDate = (v) => (v?.toDate ? v.toDate() : v ? new Date(v) : null);
const mondayIndex = (d) => (d.getDay() + 6) % 7;
const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
const fmtDay = (d) =>
  d.toLocaleDateString("en-MY", { day: "numeric", month: "short" });

const CATEGORY_LABELS = {
  sales: "Sales",
  stock_purchase: "Stock Purchase",
  rent: "Rent",
  utilities: "Utilities",
  salary: "Salary",
  marketing: "Marketing",
  platform_fee: "Platform Fee",
  tax: "Tax",
  other: "Other",
};

const categoryLabel = (key) =>
  CATEGORY_LABELS[key] ??
  key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * One definition per filter: the current range, the previous range of the
 * same length (prevStart = null means no comparison), the x-axis labels and
 * which bucket a date falls into.
 */
export function getPeriod(key, now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  switch (key) {
    case "daily":
      return {
        title: "Today",
        note: new Date(y, m, d).toLocaleDateString("en-MY", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        labels: ["12am", "4am", "8am", "12pm", "4pm", "8pm"],
        start: new Date(y, m, d),
        end: new Date(y, m, d + 1),
        prevStart: new Date(y, m, d - 1),
        // Manual entries are saved at midnight, so use the time the entry
        // was created when it was made on the same day.
        bucket: (date, created) =>
          Math.floor(
            (created && sameDay(created, date) ? created : date).getHours() / 4,
          ),
      };

    case "weekly": {
      const i = mondayIndex(now);
      return {
        title: "This Week",
        note: `${fmtDay(new Date(y, m, d - i))} – ${fmtDay(new Date(y, m, d - i + 6))}`,
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        start: new Date(y, m, d - i),
        end: new Date(y, m, d - i + 7),
        prevStart: new Date(y, m, d - i - 7),
        bucket: (date) => mondayIndex(date),
      };
    }

    case "annual":
      return {
        title: "This Year",
        note: `Jan – Dec ${y}`,
        labels: ["Q1", "Q2", "Q3", "Q4"],
        start: new Date(y, 0, 1),
        end: new Date(y + 1, 0, 1),
        prevStart: new Date(y - 1, 0, 1),
        bucket: (date) => Math.floor(date.getMonth() / 3),
      };

    case "all":
      return {
        title: "All Time",
        note: `${y - 4} – ${y}`,
        labels: Array.from({ length: 5 }, (_, i) => String(y - 4 + i)),
        start: new Date(y - 4, 0, 1),
        end: new Date(y + 1, 0, 1),
        prevStart: null,
        bucket: (date) => date.getFullYear() - (y - 4),
      };

    default: // monthly
      return {
        title: "This Month",
        note: new Date(y, m, 1).toLocaleDateString("en-MY", {
          month: "long",
          year: "numeric",
        }),
        labels: ["W1", "W2", "W3", "W4", "W5"],
        start: new Date(y, m, 1),
        end: new Date(y, m + 1, 1),
        prevStart: new Date(y, m - 1, 1),
        bucket: (date) => Math.min(4, Math.floor((date.getDate() - 1) / 7)),
      };
  }
}

function isVisible(data) {
  return !data.deletedAt && data.status !== "pending_review";
}

function summarise(p, rows) {
  const zeros = () => p.labels.map(() => 0);
  const sales = zeros();
  const spending = zeros();
  const purchases = zeros();
  const prevSales = zeros();
  const prevSpending = zeros();
  const categories = {};

  for (const r of rows) {
    const date = toDate(r.date);
    if (!date) continue;
    const i = p.bucket(date, toDate(r.createdAt));
    if (i < 0 || i >= p.labels.length) continue;

    const amount = (r.amount ?? 0) / 100; // sen -> RM
    const isCurrent = date >= p.start;

    if (r.type === "in") {
      (isCurrent ? sales : prevSales)[i] += amount;
    } else if (r.type === "out") {
      (isCurrent ? spending : prevSpending)[i] += amount;
      if (isCurrent) {
        if (r.category === "stock_purchase") purchases[i] += amount;
        const cat = r.category ?? "other";
        categories[cat] = (categories[cat] ?? 0) + amount;
      }
    }
  }

  // Spending breakdown: top 4 categories, the rest grouped as "Others"
  const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((s, [, v]) => s + v, 0);
  const pct = (v) => Math.round((v / total) * 1000) / 10;
  const breakdown = sorted.slice(0, 4).map(([key, value]) => ({
    name: categoryLabel(key),
    percent: pct(value),
    color: getCategoryColor(key),
  }));
  const rest = sorted.slice(4).reduce((s, [, v]) => s + v, 0);
  if (rest > 0) {
    breakdown.push({ name: "Others", percent: pct(rest), color: "#cbd5e1" });
  }

  return {
    title: p.title,
    note: p.note,
    labels: p.labels,
    hasPrev: Boolean(p.prevStart),
    sales,
    spending,
    // No cost-of-goods data, so stock purchases stand in for it
    gross: sales.map((s, i) => s - purchases[i]),
    net: sales.map((s, i) => s - spending[i]),
    prevSales,
    prevSpending,
    prevNet: prevSales.map((s, i) => s - prevSpending[i]),
    breakdown,
  };
}

/** Zeros with the right labels, shown until the first snapshot arrives. */
export function blankSummary(key) {
  return summarise(getPeriod(key), []);
}

/** Live summary for one filter. Returns the unsubscribe function. */
export function subscribeSummary(orgId, key, callback) {
  const p = getPeriod(key);
  // One range query covers the current AND previous period (date only,
  // so no composite index is needed).
  const q = query(
    collection(db, "organizations", orgId, "transactions"),
    where("date", ">=", Timestamp.fromDate(p.prevStart ?? p.start)),
    where("date", "<", Timestamp.fromDate(p.end)),
  );

  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => d.data()).filter(isVisible);
      callback(summarise(p, rows));
    },
    (err) => console.error("Summary listener failed:", err),
  );
}
