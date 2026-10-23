import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { CHECKLIST, CHECKLIST_TOTAL } from "./checklist";
import {
  LOW_STOCK_THRESHOLD,
  addProduct,
  deleteProduct,
  getProduct,
  mapProduct,
  updateProduct,
} from "./inventory";
import { addTransaction } from "./transactions";
import {
  addTicket,
  getTicket,
  mapTicket,
  updateTicketStatus,
} from "./tickets";
import { subscribeSummary } from "./summary";
import { DAY_KEYS, subscribePublicity, weekRange } from "./publicity";
import {
  PAYMENT_METHODS,
  PRODUCT_CATS,
  TICKET_CATS,
  TICKET_PRIOS,
  TICKET_STATS,
  TX_CATEGORIES,
} from "./chatToolSchemas";

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

const norm = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const r2 = (n) => Math.round(n * 100) / 100;
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);
const isoDay = (d) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD
const tsDate = (v) => (v?.toDate ? v.toDate() : new Date(v));
const validDate = (s) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(new Date(`${s}T00:00:00`).getTime());
const pick = (list, v) => list.find((x) => norm(x) === norm(v)) ?? null;
const title = (s) =>
  String(s).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const rm = (n) => `RM ${Number(n).toFixed(2)}`;
const bad = (error) => ({ ok: false, error });
const row = (label, value, from) =>
  from === undefined
    ? { label, value: String(value) }
    : { label, value: String(value), from: String(from) };
const nameMatches = (name, q) => {
  const n = norm(name);
  return norm(q)
    .split(" ")
    .every((t) => n.includes(t));
};

// Tiny cache so the AI can look things up several times without re-reading Firestore.
const cache = new Map();
async function cached(key, ttl, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ttl) return hit.v;
  const v = await fn();
  cache.set(key, { t: Date.now(), v });
  return v;
}
export const invalidateCache = () => cache.clear();

// Wraps a subscribe-style helper into a one-shot read.
function once(subscribe, ms = 8000) {
  return new Promise((resolve, reject) => {
    let unsub = () => {};
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      unsub();
      reject(new Error("Timed out reading data"));
    }, ms);
    unsub = subscribe((value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(value);
      setTimeout(() => unsub(), 0);
    });
  });
}

/* ------------------------------------------------------------------ */
/* Data access                                                         */
/* ------------------------------------------------------------------ */

const fetchProducts = (orgId) =>
  cached(`products:${orgId}`, 15000, async () => {
    const snap = await getDocs(
      query(
        collection(db, "organizations", orgId, "products"),
        orderBy("name"),
      ),
    );
    return snap.docs
      .filter((d) => !d.data().deletedAt)
      .map((d) => mapProduct(d.id, d.data()));
  });

async function getRawTx(orgId, id) {
  if (!id) return null;
  const snap = await getDoc(doc(db, "organizations", orgId, "transactions", id));
  if (!snap.exists() || snap.data().deletedAt) return null;
  const d = snap.data();
  return {
    id,
    type: d.type,
    amount: r2((d.amount ?? 0) / 100),
    category: d.category ?? "other",
    description: d.description ?? "",
    date: isoDay(tsDate(d.date)),
    paymentMethod: d.paymentMethod ?? "",
    note: d.note ?? "",
  };
}

const RECEIPT_CATEGORY = {
  inventory_stock: "stock_purchase",
  supplies: "stock_purchase",
  food_beverage: "other",
  utilities: "utilities",
  rent: "rent",
  transport: "other",
  equipment: "other",
  marketing: "marketing",
  other: "other",
};

/* ------------------------------------------------------------------ */
/* READ tools (run immediately, return compact data)                   */
/* ------------------------------------------------------------------ */

export const READ_RUNNERS = {
  async search_products(a, ctx) {
    let list = await fetchProducts(ctx.orgId);
    const q = norm(a.query);
    if (q) {
      list = list.filter((p) => nameMatches(p.name, q) || norm(p.barcode) === q);
    }
    const cat = pick(PRODUCT_CATS, a.category);
    if (cat) list = list.filter((p) => p.category === cat);
    if (a.lowStockOnly) list = list.filter((p) => p.stock <= LOW_STOCK_THRESHOLD);
    const limit = clamp(Math.round(num(a.limit) ?? 15), 1, 30);
    return {
      totalMatches: list.length,
      lowStockThreshold: LOW_STOCK_THRESHOLD,
      products: list.slice(0, limit).map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        stock: p.stock,
        cost: p.cost,
        price: p.price,
        dueDate: p.dueDate || null,
        barcode: p.barcode || null,
      })),
    };
  },

  async list_transactions(a, ctx) {
    const month = /^\d{4}-\d{2}$/.test(a.month ?? "")
      ? a.month
      : isoDay(new Date()).slice(0, 7);
    const [y, m] = month.split("-").map(Number);
    const snap = await getDocs(
      query(
        collection(db, "organizations", ctx.orgId, "transactions"),
        where("date", ">=", Timestamp.fromDate(new Date(y, m - 1, 1))),
        where("date", "<", Timestamp.fromDate(new Date(y, m, 1))),
      ),
    );
    let rows = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((r) => !r.deletedAt && r.status !== "pending_review");
    if (a.type === "in" || a.type === "out") rows = rows.filter((r) => r.type === a.type);
    const cat = pick(TX_CATEGORIES, a.category);
    if (cat) rows = rows.filter((r) => r.category === cat);
    if (norm(a.query)) rows = rows.filter((r) => nameMatches(r.description, a.query));
    rows.sort((x, y2) => tsDate(y2.date) - tsDate(x.date));

    const sum = (type) =>
      r2(rows.filter((r) => r.type === type).reduce((s, r) => s + (r.amount ?? 0), 0) / 100);
    const limit = clamp(Math.round(num(a.limit) ?? 20), 1, 40);
    return {
      month,
      count: rows.length,
      totalIn: sum("in"),
      totalOut: sum("out"),
      transactions: rows.slice(0, limit).map((r) => ({
        id: r.id,
        type: r.type,
        amount: r2((r.amount ?? 0) / 100),
        category: r.category,
        description: r.description,
        date: isoDay(tsDate(r.date)),
        paymentMethod: r.paymentMethod,
      })),
    };
  },

  async get_summary(a, ctx) {
    const period = ["daily", "weekly", "monthly", "annual"].includes(a.period)
      ? a.period
      : "monthly";
    const s = await once((cb) => subscribeSummary(ctx.orgId, period, cb));
    const sum = (arr) => r2(arr.reduce((x, y) => x + y, 0));
    const products = await fetchProducts(ctx.orgId);
    return {
      period: s.title,
      range: s.note,
      sales: sum(s.sales),
      spending: sum(s.spending),
      grossProfit: sum(s.gross),
      netProfit: sum(s.net),
      previousPeriod: s.hasPrev
        ? {
            sales: sum(s.prevSales),
            spending: sum(s.prevSpending),
            netProfit: sum(s.prevNet),
          }
        : null,
      spendingBreakdown: s.breakdown.map((b) => ({
        category: b.name,
        percent: b.percent,
      })),
      trend: s.labels.map((label, i) => ({
        label,
        sales: r2(s.sales[i]),
        spending: r2(s.spending[i]),
      })),
      stock: {
        totalProducts: products.length,
        outOfStock: products.filter((p) => p.stock <= 0).length,
        lowStock: products.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD).length,
        valueAtCost: r2(products.reduce((t, p) => t + p.cost * p.stock, 0)),
      },
    };
  },

  async get_checklist(a, ctx) {
    const snap = await getDocs(
      collection(db, "organizations", ctx.orgId, "checklist"),
    );
    const done = new Set(snap.docs.filter((d) => d.data().done).map((d) => d.id));
    const groups = CHECKLIST.map((g) => ({
      group: g.title,
      done: g.items.filter((i) => done.has(i.id)).length,
      total: g.items.length,
      pending: g.items
        .filter((i) => !done.has(i.id))
        .map((i) => ({ title: i.title, frequency: i.frequency })),
    }));
    return {
      completed: groups.reduce((s, g) => s + g.done, 0),
      total: CHECKLIST_TOTAL,
      groups: a.onlyPending ? groups.filter((g) => g.pending.length) : groups,
    };
  },

  async get_publicity(a, ctx) {
    const { state, weeks } = await once((cb) => subscribePublicity(ctx.orgId, cb));
    if (!state) return { started: false, note: "The user has not opened Publicity yet." };
    const total = (v) => DAY_KEYS.reduce((s, k) => s + (Number(v?.[k]) || 0), 0);
    const current = weeks[state.week];
    const recentWeeks = Object.keys(weeks)
      .map(Number)
      .sort((x, y) => y - x)
      .slice(0, 3)
      .map((n) => {
        const v = weeks[n].views;
        const logged = DAY_KEYS.filter((k) => v[k] !== null && v[k] !== undefined);
        const best = [...logged].sort((x, y) => v[y] - v[x])[0] ?? null;
        return {
          week: n,
          range: weekRange(state.startMonday, n),
          totalViews: total(v),
          bestDay: best,
          viewsByDay: Object.fromEntries(logged.map((k) => [k, v[k]])),
        };
      });
    return {
      started: true,
      currentWeek: state.week,
      platform: state.platform,
      postsPerWeek: state.postsPerWeek,
      topic: state.topic || null,
      plannedDays: (current?.planned ?? []).map((p) => ({ day: p.day, reason: p.reason })),
      recentWeeks,
    };
  },

  async list_tickets(a, ctx) {
    const snap = await getDocs(
      query(
        collection(db, "organizations", ctx.orgId, "tickets"),
        orderBy("createdAt", "desc"),
      ),
    );
    let list = snap.docs.map((d) => mapTicket(d.id, d.data()));
    if (pick(TICKET_STATS, a.status)) list = list.filter((t) => t.status === a.status);
    if (norm(a.query)) list = list.filter((t) => nameMatches(t.title, a.query));
    const limit = clamp(Math.round(num(a.limit) ?? 15), 1, 30);
    return {
      totalMatches: list.length,
      tickets: list.slice(0, limit).map((t) => ({
        id: t.id,
        ticketNo: t.ticketNo,
        title: t.title,
        status: t.status,
        priority: t.priority,
        category: t.category,
        created: t.createdLabel,
        description: t.description.slice(0, 120),
      })),
    };
  },

  async scan_receipts(a, ctx) {
    if (!ctx.files?.length) return { error: "No files are attached to this message." };
    const res = await fetch("/api/receipt-processing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: ctx.files.map(({ mimeType, data }) => ({ mimeType, data })),
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { error: json.error || "Could not read the receipt." };
    const docs = json.documents || [];
    if (docs.length === 0) return { error: "No receipt was found in the files." };
    return {
      receipts: docs.map((d, i) => ({
        receiptNo: i + 1,
        merchant: d.merchant,
        date: d.date,
        total: d.total_amount,
        tax: d.tax_amount,
        suggestedCategory: RECEIPT_CATEGORY[d.category] || "other",
        items: (d.line_items || []).slice(0, 6).map((li) => `${li.quantity}x ${li.name}`),
        totalUnreadable: !d.total_amount,
      })),
    };
  },
};

export const STEP_LABEL = {
  search_products: "Checking your inventory...",
  list_transactions: "Looking through transactions...",
  get_summary: "Reading your summary...",
  get_checklist: "Checking your checklist...",
  get_publicity: "Checking your publicity plan...",
  list_tickets: "Checking reports...",
  scan_receipts: "Reading your receipt...",
};

/* ------------------------------------------------------------------ */
/* WRITE tools                                                         */
/* prepare(args, ctx) validates and builds the card (no data changes). */
/* run(args, ctx) only runs after the user taps Allow.                 */
/* ------------------------------------------------------------------ */

const PRODUCT_LABEL = {
  name: "Name",
  category: "Category",
  stock: "Stock",
  cost: "Cost",
  price: "Price",
  dueDate: "Due date",
  barcode: "Barcode",
};
const productFmt = (k, v) =>
  k === "cost" || k === "price" ? rm(v) : v === "" || v == null ? "-" : String(v);

const TX_LABEL = {
  type: "Type",
  amount: "Amount",
  category: "Category",
  description: "Description",
  date: "Date",
  paymentMethod: "Payment",
  note: "Note",
};
const txFmt = (k, v) =>
  k === "amount"
    ? rm(v)
    : k === "type"
      ? v === "in"
        ? "Earning"
        : "Spending"
      : k === "category"
        ? title(v)
        : v === "" || v == null
          ? "-"
          : String(v);

const TICKET_LABEL = {
  title: "Title",
  description: "Description",
  category: "Category",
  priority: "Priority",
  status: "Status",
};
const ticketFmt = (k, v) =>
  k === "category" || k === "status" || k === "priority" ? title(v) : String(v ?? "-").slice(0, 80);

const changedKeys = (cur, patch) =>
  Object.keys(patch).filter((k) => String(patch[k]) !== String(cur[k] ?? ""));
const diffRows = (cur, patch, keys, labels, fmt) =>
  keys.map((k) => row(labels[k] || title(k), fmt(k, patch[k]), fmt(k, cur[k])));
const only = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj[k]]));

export const WRITE_TOOLS = {
  /* ------------------------- products ------------------------- */
  add_product: {
    async prepare(a, ctx) {
      const name = String(a.name ?? "").trim();
      const category = pick(PRODUCT_CATS, a.category);
      const stock = num(a.stock);
      const cost = num(a.cost);
      const price = num(a.price);
      const dueDate = category === "Food" ? String(a.dueDate ?? "") : "";
      const miss = [];
      if (!name) miss.push("name");
      if (!category) miss.push("category (Food, Drinks or Household)");
      if (stock === null || stock < 0 || !Number.isInteger(stock)) miss.push("stock (whole number)");
      if (cost === null || cost < 0) miss.push("cost");
      if (price === null || price < 0) miss.push("price");
      if (category === "Food" && !validDate(dueDate)) miss.push("dueDate (YYYY-MM-DD)");
      if (miss.length) return bad(`Missing or invalid: ${miss.join(", ")}. Ask the user with ask_user.`);

      const barcode = String(a.barcode ?? "").trim();
      const warnings = [];
      const dupe = (await fetchProducts(ctx.orgId)).find((p) => norm(p.name) === norm(name));
      if (dupe) warnings.push(`"${dupe.name}" already exists (${dupe.stock} in stock). Allowing adds a second product.`);
      if (price < cost) warnings.push("The price is lower than the cost.");

      const rows = [
        row("Name", name),
        row("Category", category),
        row("Stock", stock),
        row("Cost", rm(cost)),
        row("Price", rm(price)),
      ];
      if (category === "Food") rows.push(row("Due date", dueDate));
      if (barcode) rows.push(row("Barcode", barcode));
      return {
        ok: true,
        kind: "add",
        title: `Add product: ${name}`,
        args: { name, category, stock, cost, price, dueDate, barcode },
        rows,
        warnings,
      };
    },
    async run(a, ctx) {
      await addProduct({ orgId: ctx.orgId, user: ctx.user, product: a });
      return { note: "Added to your inventory." };
    },
  },

  update_product: {
    async prepare(a, ctx) {
      const cur = a.id ? await getProduct(ctx.orgId, String(a.id)) : null;
      if (!cur) return bad("Product not found. Use search_products to get a valid id.");

      const patch = {};
      if (a.name !== undefined) {
        const n = String(a.name).trim();
        if (!n) return bad("name cannot be empty.");
        patch.name = n;
      }
      if (a.category !== undefined) {
        const c = pick(PRODUCT_CATS, a.category);
        if (!c) return bad("category must be Food, Drinks or Household.");
        patch.category = c;
      }
      if (a.stock !== undefined) {
        const s = num(a.stock);
        if (s === null || s < 0 || !Number.isInteger(s)) return bad("stock must be a whole number of 0 or more.");
        patch.stock = s;
      }
      if (a.stockChange !== undefined) {
        const d = num(a.stockChange);
        if (d === null || !Number.isInteger(d)) return bad("stockChange must be a whole number.");
        if (cur.stock + d < 0) return bad(`Stock would go below 0 (current stock is ${cur.stock}).`);
        patch.stock = cur.stock + d;
      }
      for (const k of ["cost", "price"]) {
        if (a[k] === undefined) continue;
        const n = num(a[k]);
        if (n === null || n < 0) return bad(`${k} must be 0 or more.`);
        patch[k] = r2(n);
      }
      if (a.dueDate !== undefined) {
        if (!validDate(String(a.dueDate))) return bad("dueDate must be YYYY-MM-DD.");
        patch.dueDate = String(a.dueDate);
      }
      if (a.barcode !== undefined) patch.barcode = String(a.barcode).trim();

      const next = { ...cur, ...patch };
      if (next.category === "Food" && !validDate(next.dueDate)) {
        return bad("Food products need a due date (YYYY-MM-DD). Ask the user.");
      }
      const keys = changedKeys(cur, patch);
      if (keys.length === 0) return bad("Nothing would change.");
      return {
        ok: true,
        kind: "update",
        title: `Update product: ${cur.name}`,
        args: { id: cur.id, patch: only(patch, keys) },
        rows: diffRows(cur, patch, keys, PRODUCT_LABEL, productFmt),
        warnings: [],
      };
    },
    async run(a, ctx) {
      const cur = await getProduct(ctx.orgId, a.id);
      if (!cur) throw new Error("This product no longer exists.");
      await updateProduct({
        orgId: ctx.orgId,
        productId: a.id,
        product: { ...cur, ...a.patch },
      });
      return { note: "Product updated." };
    },
  },

  delete_product: {
    async prepare(a, ctx) {
      const cur = a.id ? await getProduct(ctx.orgId, String(a.id)) : null;
      if (!cur) return bad("Product not found. Use search_products to get a valid id.");
      return {
        ok: true,
        kind: "delete",
        title: `Delete product: ${cur.name}`,
        args: { id: cur.id },
        rows: [row("Category", cur.category), row("Stock", cur.stock), row("Price", rm(cur.price))],
        warnings: cur.stock > 0 ? [`It still has ${cur.stock} in stock.`] : [],
      };
    },
    async run(a, ctx) {
      await deleteProduct({ orgId: ctx.orgId, productId: a.id });
      return { note: "Product deleted." };
    },
  },

  /* ----------------------- transactions ----------------------- */
  add_transaction: {
    async prepare(a) {
      const type = a.type === "in" || a.type === "out" ? a.type : null;
      const amount = num(a.amount);
      const category = pick(TX_CATEGORIES, a.category);
      const description = String(a.description ?? "").trim();
      const date = a.date ? String(a.date) : isoDay(new Date());
      const paymentMethod = pick(PAYMENT_METHODS, a.paymentMethod);
      const miss = [];
      if (!type) miss.push("type (in or out)");
      if (amount === null || amount <= 0) miss.push("amount");
      if (!category) miss.push("category");
      if (!description) miss.push("description");
      if (!validDate(date)) miss.push("date (YYYY-MM-DD)");
      if (!paymentMethod) miss.push("paymentMethod");
      if (miss.length) return bad(`Missing or invalid: ${miss.join(", ")}. Ask the user with ask_user.`);

      const note = String(a.note ?? "").trim();
      const warnings = [];
      if (date > isoDay(new Date())) warnings.push("This date is in the future.");
      const rows = [
        row("Type", txFmt("type", type)),
        row("Amount", rm(amount)),
        row("Category", title(category)),
        row("Date", date),
        row("Payment", paymentMethod),
      ];
      if (note) rows.push(row("Note", note));
      return {
        ok: true,
        kind: "add",
        title: `${type === "in" ? "Record earning" : "Record spending"}: ${description}`,
        args: { type, amount: r2(amount), category, description, date, paymentMethod, note },
        rows,
        warnings,
      };
    },
    async run(a, ctx) {
      await addTransaction({ orgId: ctx.orgId, user: ctx.user, transaction: a });
      return { note: "Transaction recorded." };
    },
  },

  update_transaction: {
    async prepare(a, ctx) {
      const cur = await getRawTx(ctx.orgId, a.id ? String(a.id) : "");
      if (!cur) return bad("Transaction not found. Use list_transactions to get a valid id.");

      const patch = {};
      if (a.type !== undefined) {
        if (a.type !== "in" && a.type !== "out") return bad("type must be in or out.");
        patch.type = a.type;
      }
      if (a.amount !== undefined) {
        const n = num(a.amount);
        if (n === null || n <= 0) return bad("amount must be above 0.");
        patch.amount = r2(n);
      }
      if (a.category !== undefined) {
        const c = pick(TX_CATEGORIES, a.category);
        if (!c) return bad("Invalid category.");
        patch.category = c;
      }
      if (a.description !== undefined) {
        const d = String(a.description).trim();
        if (!d) return bad("description cannot be empty.");
        patch.description = d;
      }
      if (a.date !== undefined) {
        if (!validDate(String(a.date))) return bad("date must be YYYY-MM-DD.");
        patch.date = String(a.date);
      }
      if (a.paymentMethod !== undefined) {
        const m = pick(PAYMENT_METHODS, a.paymentMethod);
        if (!m) return bad("Invalid payment method.");
        patch.paymentMethod = m;
      }
      if (a.note !== undefined) patch.note = String(a.note).trim();

      const keys = changedKeys(cur, patch);
      if (keys.length === 0) return bad("Nothing would change.");
      return {
        ok: true,
        kind: "update",
        title: `Update transaction: ${cur.description}`,
        args: { id: cur.id, patch: only(patch, keys) },
        rows: diffRows(cur, patch, keys, TX_LABEL, txFmt),
        warnings: [],
      };
    },
    async run(a, ctx) {
      const cur = await getRawTx(ctx.orgId, a.id);
      if (!cur) throw new Error("This transaction no longer exists.");
      const m = { ...cur, ...a.patch };
      await updateDoc(doc(db, "organizations", ctx.orgId, "transactions", a.id), {
        type: m.type,
        amount: Math.round(m.amount * 100),
        category: m.category,
        description: m.description,
        date: Timestamp.fromDate(new Date(`${m.date}T00:00:00`)),
        paymentMethod: m.paymentMethod,
        note: m.note,
        updatedAt: serverTimestamp(),
      });
      return { note: "Transaction updated." };
    },
  },

  delete_transaction: {
    async prepare(a, ctx) {
      const cur = await getRawTx(ctx.orgId, a.id ? String(a.id) : "");
      if (!cur) return bad("Transaction not found. Use list_transactions to get a valid id.");
      return {
        ok: true,
        kind: "delete",
        title: `Delete transaction: ${cur.description}`,
        args: { id: cur.id },
        rows: [
          row("Type", txFmt("type", cur.type)),
          row("Amount", rm(cur.amount)),
          row("Date", cur.date),
        ],
        warnings: [],
      };
    },
    async run(a, ctx) {
      // Soft delete, same as the rest of the app (deletedAt is filtered out everywhere)
      await updateDoc(doc(db, "organizations", ctx.orgId, "transactions", a.id), {
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { note: "Transaction deleted." };
    },
  },

  /* ------------------- reports (tickets) ------------------- */
  add_ticket: {
    async prepare(a) {
      const ticketTitle = String(a.title ?? "").trim();
      const description = String(a.description ?? "").trim();
      const miss = [];
      if (!ticketTitle) miss.push("title");
      if (!description) miss.push("description");
      if (miss.length) return bad(`Missing: ${miss.join(", ")}. Ask the user with ask_user.`);
      const category = pick(TICKET_CATS, a.category) ?? "other";
      const priority = pick(TICKET_PRIOS, a.priority) ?? "medium";
      const transactionId = a.transactionId ? String(a.transactionId) : null;
      return {
        ok: true,
        kind: "add",
        title: `Create report: ${ticketTitle}`,
        args: { title: ticketTitle, description, category, priority, transactionId },
        rows: [
          row("Category", title(category)),
          row("Priority", title(priority)),
          row("Description", description.slice(0, 160)),
        ],
        warnings: [],
      };
    },
    async run(a, ctx) {
      await addTicket({ orgId: ctx.orgId, user: ctx.user, ticket: a });
      return { note: "Report created." };
    },
  },

  update_ticket: {
    async prepare(a, ctx) {
      const cur = a.id ? await getTicket(ctx.orgId, String(a.id)) : null;
      if (!cur) return bad("Report not found. Use list_tickets to get a valid id.");

      const patch = {};
      if (a.title !== undefined) {
        const t = String(a.title).trim();
        if (!t) return bad("title cannot be empty.");
        patch.title = t;
      }
      if (a.description !== undefined) {
        const d = String(a.description).trim();
        if (!d) return bad("description cannot be empty.");
        patch.description = d;
      }
      if (a.category !== undefined) {
        const c = pick(TICKET_CATS, a.category);
        if (!c) return bad("Invalid category.");
        patch.category = c;
      }
      if (a.priority !== undefined) {
        const p = pick(TICKET_PRIOS, a.priority);
        if (!p) return bad("Invalid priority.");
        patch.priority = p;
      }
      if (a.status !== undefined) {
        const s = pick(TICKET_STATS, a.status);
        if (!s) return bad("Invalid status.");
        if (!ctx.isOwner) return bad("Only the owner can change a report's status. Tell the user.");
        patch.status = s;
      }
      const keys = changedKeys(cur, patch);
      if (keys.length === 0) return bad("Nothing would change.");
      return {
        ok: true,
        kind: "update",
        title: `Update report: ${cur.ticketNo}`,
        args: { id: cur.id, patch: only(patch, keys) },
        rows: diffRows(cur, patch, keys, TICKET_LABEL, ticketFmt),
        warnings: [],
      };
    },
    async run(a, ctx) {
      const { status, ...rest } = a.patch;
      if (Object.keys(rest).length) {
        await updateDoc(doc(db, "organizations", ctx.orgId, "tickets", a.id), {
          ...rest,
          updatedAt: serverTimestamp(),
        });
      }
      if (status) await updateTicketStatus({ orgId: ctx.orgId, ticketId: a.id, status });
      return { note: "Report updated." };
    },
  },

  delete_ticket: {
    async prepare(a, ctx) {
      if (!ctx.isOwner) return bad("Only the owner can delete reports. Tell the user.");
      const cur = a.id ? await getTicket(ctx.orgId, String(a.id)) : null;
      if (!cur) return bad("Report not found. Use list_tickets to get a valid id.");
      return {
        ok: true,
        kind: "delete",
        title: `Delete report: ${cur.ticketNo}`,
        args: { id: cur.id },
        rows: [
          row("Title", cur.title),
          row("Status", title(cur.status)),
          row("Priority", title(cur.priority)),
        ],
        warnings: [],
      };
    },
    async run(a, ctx) {
      await deleteDoc(doc(db, "organizations", ctx.orgId, "tickets", a.id));
      return { note: "Report deleted." };
    },
  },
};

/** Runs an approved action. Called only after the user taps Allow. */
export async function executeAction(action, ctx) {
  const tool = WRITE_TOOLS[action.tool];
  if (!tool) throw new Error("Unknown action.");
  try {
    return await tool.run(action.args, ctx);
  } finally {
    invalidateCache();
  }
}
