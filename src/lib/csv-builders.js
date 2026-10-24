import { toCsv } from "@/lib/csv";

const money = (n) => Number(n || 0).toFixed(2);

/**
 * Builds the CSV for the Summary page from what the page already has
 * in state: `current` (the period's summary object) and `stock`
 * (the derived inventory-health object).
 */
export function buildSummaryCsv(current, stock) {
  const rows = [];

  // Section: period trend (sales / spending / gross / net per label)
  rows.push({ section: "Performance", metric: "Period", value: current.note });
  current.labels.forEach((label, i) => {
    rows.push({
      section: "Performance",
      metric: `${label} — Sales`,
      value: money(current.sales[i]),
    });
    rows.push({
      section: "Performance",
      metric: `${label} — Spending`,
      value: money(current.spending[i]),
    });
    rows.push({
      section: "Performance",
      metric: `${label} — Gross Profit`,
      value: money(current.gross[i]),
    });
    rows.push({
      section: "Performance",
      metric: `${label} — Net Profit`,
      value: money(current.net[i]),
    });
  });

  // Section: spending breakdown by category
  current.breakdown.forEach((b) => {
    rows.push({
      section: "Spending Breakdown",
      metric: b.name,
      value: `${b.percent}%`,
    });
  });

  // Section: stock health
  rows.push({ section: "Stock", metric: "Units on hand", value: stock.units });
  rows.push({
    section: "Stock",
    metric: "Inventory value (cost)",
    value: money(stock.value),
  });
  rows.push({
    section: "Stock",
    metric: "In stock %",
    value: `${stock.pctIn}%`,
  });
  rows.push({
    section: "Stock",
    metric: "Low stock %",
    value: `${stock.pctLow}%`,
  });
  rows.push({
    section: "Stock",
    metric: "Out of stock %",
    value: `${stock.pctOut}%`,
  });
  stock.byCategory.forEach((c) => {
    rows.push({
      section: "Stock by Category",
      metric: c.name,
      value: `${c.sold} units`,
    });
  });
  stock.alerts.forEach((a) => {
    rows.push({
      section: "Low Stock Alerts",
      metric: a.name,
      value: `${a.stock} left`,
    });
  });

  const csv = toCsv(rows, [
    { key: "section", label: "Section" },
    { key: "metric", label: "Metric" },
    { key: "value", label: "Value" },
  ]);

  const filename = `summary-${current.title.toLowerCase().replace(/\s+/g, "-")}`;
  return { csv, filename };
}

/**
 * Transaction page: `transactions` is the month's full list from
 * subscribeMonthTransactions, `month` is the "yyyy-MM" key.
 */
export function buildTransactionCsv(transactions, month) {
  const rows = transactions.map((t) => ({
    date: new Date(t.date).toLocaleDateString("en-CA"),
    type: t.type === "earning" ? "Earning" : "Spending",
    description: t.title,
    category: t.category,
    amount: money(t.amount),
    method: t.method,
    reference: t.reference,
    note: t.note || "",
  }));

  const csv = toCsv(rows, [
    { key: "date", label: "Date" },
    { key: "type", label: "Type" },
    { key: "description", label: "Description" },
    { key: "category", label: "Category" },
    { key: "amount", label: "Amount (RM)" },
    { key: "method", label: "Payment Method" },
    { key: "reference", label: "Reference" },
    { key: "note", label: "Note" },
  ]);

  return { csv, filename: `transactions-${month}` };
}

/**
 * Report (tickets) page: `tickets` is the full list from subscribeTickets.
 */
export function buildReportCsv(tickets) {
  const rows = tickets.map((t) => ({
    ticketNo: t.ticketNo,
    title: t.title,
    status: t.status,
    priority: t.priority,
    category: t.category,
    created: t.createdLabel,
    resolved: t.resolvedLabel || "",
    reportedBy: t.reportedBy?.name || "",
    description: t.description,
  }));

  const csv = toCsv(rows, [
    { key: "ticketNo", label: "Ticket No" },
    { key: "title", label: "Title" },
    { key: "status", label: "Status" },
    { key: "priority", label: "Priority" },
    { key: "category", label: "Category" },
    { key: "created", label: "Created" },
    { key: "resolved", label: "Resolved" },
    { key: "reportedBy", label: "Reported By" },
    { key: "description", label: "Description" },
  ]);

  return { csv, filename: "reports" };
}

/**
 * Inventory page: `products` is the full list from subscribeProducts.
 */
export function buildInventoryCsv(products) {
  const rows = products.map((p) => ({
    name: p.name,
    category: p.category,
    stock: p.stock,
    cost: money(p.cost),
    price: money(p.price),
    dueDate: p.dueDate || "",
    barcode: p.barcode || "",
  }));

  const csv = toCsv(rows, [
    { key: "name", label: "Product Name" },
    { key: "category", label: "Category" },
    { key: "stock", label: "Stock" },
    { key: "cost", label: "Cost (RM)" },
    { key: "price", label: "Price (RM)" },
    { key: "dueDate", label: "Due Date" },
    { key: "barcode", label: "Barcode" },
  ]);

  return { csv, filename: "inventory" };
}
