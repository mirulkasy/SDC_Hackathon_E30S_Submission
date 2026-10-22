export const transactions = [
  // ── October 2026 ──
  {
    id: "1",
    title: "Monthly Salary",
    category: "Salary",
    type: "earning",
    amount: 4500,
    date: "2026-10-01T09:00:00",
    method: "Bank Transfer",
    reference: "TRX-20261001-001",
    note: "October salary payment.",
  },
  {
    id: "2",
    title: "Freelance Project",
    category: "Freelance",
    type: "earning",
    amount: 1200,
    date: "2026-10-08T14:30:00",
    method: "Online Banking",
    reference: "TRX-20261008-002",
    note: "Landing page design for a client.",
  },
  {
    id: "3",
    title: "Stock Dividend",
    category: "Investment",
    type: "earning",
    amount: 180.5,
    date: "2026-10-15T10:15:00",
    method: "Bank Transfer",
    reference: "TRX-20261015-003",
    note: "Quarterly dividend payout.",
  },
  {
    id: "4",
    title: "Grocery Shopping",
    category: "Food",
    type: "spending",
    amount: 128.9,
    date: "2026-10-03T18:20:00",
    method: "Debit Card",
    reference: "TRX-20261003-004",
    note: "Weekly groceries.",
  },
  {
    id: "5",
    title: "Electricity Bill",
    category: "Utilities",
    type: "spending",
    amount: 96.4,
    date: "2026-10-05T11:00:00",
    method: "Online Banking",
    reference: "TRX-20261005-005",
    note: "September usage.",
  },
  {
    id: "6",
    title: "Petrol",
    category: "Transport",
    type: "spending",
    amount: 60,
    date: "2026-10-12T08:45:00",
    method: "E-Wallet",
    reference: "TRX-20261012-006",
    note: "",
  },
  {
    id: "7",
    title: "Movie Night",
    category: "Entertainment",
    type: "spending",
    amount: 45,
    date: "2026-10-18T20:00:00",
    method: "Credit Card",
    reference: "TRX-20261018-007",
    note: "Tickets and snacks.",
  },
  {
    id: "8",
    title: "New Sneakers",
    category: "Shopping",
    type: "spending",
    amount: 220,
    date: "2026-10-20T16:10:00",
    method: "Credit Card",
    reference: "TRX-20261020-008",
    note: "",
  },

  // ── September 2026 ──
  {
    id: "9",
    title: "Monthly Salary",
    category: "Salary",
    type: "earning",
    amount: 4500,
    date: "2026-09-01T09:00:00",
    method: "Bank Transfer",
    reference: "TRX-20260901-009",
    note: "September salary payment.",
  },
  {
    id: "10",
    title: "Performance Bonus",
    category: "Bonus",
    type: "earning",
    amount: 800,
    date: "2026-09-20T10:00:00",
    method: "Bank Transfer",
    reference: "TRX-20260920-010",
    note: "Q3 bonus.",
  },
  {
    id: "11",
    title: "Dinner with Family",
    category: "Food",
    type: "spending",
    amount: 150,
    date: "2026-09-07T20:30:00",
    method: "Credit Card",
    reference: "TRX-20260907-011",
    note: "",
  },
  {
    id: "12",
    title: "Internet Bill",
    category: "Utilities",
    type: "spending",
    amount: 129,
    date: "2026-09-10T09:15:00",
    method: "Online Banking",
    reference: "TRX-20260910-012",
    note: "Monthly fibre plan.",
  },
  {
    id: "13",
    title: "Toll & Parking",
    category: "Transport",
    type: "spending",
    amount: 38.5,
    date: "2026-09-14T08:00:00",
    method: "E-Wallet",
    reference: "TRX-20260914-013",
    note: "",
  },

  // ── August 2026 ──
  {
    id: "14",
    title: "Monthly Salary",
    category: "Salary",
    type: "earning",
    amount: 4500,
    date: "2026-08-01T09:00:00",
    method: "Bank Transfer",
    reference: "TRX-20260801-014",
    note: "August salary payment.",
  },
  {
    id: "15",
    title: "Logo Design",
    category: "Freelance",
    type: "earning",
    amount: 650,
    date: "2026-08-12T15:00:00",
    method: "Online Banking",
    reference: "TRX-20260812-015",
    note: "",
  },
  {
    id: "16",
    title: "Concert Ticket",
    category: "Entertainment",
    type: "spending",
    amount: 280,
    date: "2026-08-09T19:00:00",
    method: "Credit Card",
    reference: "TRX-20260809-016",
    note: "",
  },
  {
    id: "17",
    title: "Grocery Shopping",
    category: "Food",
    type: "spending",
    amount: 112.4,
    date: "2026-08-16T17:40:00",
    method: "Debit Card",
    reference: "TRX-20260816-017",
    note: "",
  },
  {
    id: "18",
    title: "Car Service",
    category: "Transport",
    type: "spending",
    amount: 340,
    date: "2026-08-22T11:30:00",
    method: "Debit Card",
    reference: "TRX-20260822-018",
    note: "Oil change and tyre rotation.",
  },
];

// Category colors used by the donut chart & category chips
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
};

export function getCategoryColor(category) {
  return categoryColors[category] || "#7d909b";
}

export function getTransactionById(id) {
  return transactions.find((item) => item.id === id);
}

export function formatRM(value) {
  return `RM ${value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
