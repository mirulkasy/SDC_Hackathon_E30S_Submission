// Tool declarations the AI can call. Plain data only (no imports), so the
// server route can import it without pulling Firebase in.
//
// READ tools   -> run immediately in the browser (summary, checklist, ...)
// WRITE tools  -> never run directly. They become an approval card in the chat
//                 and only run after the user taps "Allow".
// All money is in RM (ringgit), never sen.

export const PRODUCT_CATS = ["Food", "Drinks", "Household"];
export const TX_CATEGORIES = [
  "sales",
  "stock_purchase",
  "rent",
  "utilities",
  "salary",
  "marketing",
  "platform_fee",
  "tax",
  "other",
];
export const PAYMENT_METHODS = [
  "Cash",
  "Bank Transfer",
  "Online Banking",
  "Debit Card",
  "Credit Card",
  "E-Wallet",
];
export const TICKET_CATS = [
  "cash_flow",
  "inventory",
  "invoice",
  "account",
  "bug",
  "other",
];
export const TICKET_PRIOS = ["low", "medium", "high"];
export const TICKET_STATS = [
  "open",
  "in_progress",
  "on_hold",
  "resolved",
  "closed",
];

const str = (description, values) =>
  values
    ? { type: "STRING", description, enum: values }
    : { type: "STRING", description };
const num = (description) => ({ type: "NUMBER", description });
const int = (description) => ({ type: "INTEGER", description });
const bool = (description) => ({ type: "BOOLEAN", description });
const obj = (properties, required = []) => ({
  type: "OBJECT",
  properties,
  ...(required.length ? { required } : {}),
});

export const TOOL_DECLARATIONS = [
  /* ---------------- ask the user (Claude-style clarifying question) ---------------- */
  {
    name: "ask_user",
    description:
      "Ask the user for missing information before doing something. Put ALL missing items in one question. Offer short tappable options when the answer is a small set of choices.",
    parameters: obj(
      {
        question: str("The question, short and friendly."),
        options: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "Optional quick-reply choices (max 6).",
        },
      },
      ["question"],
    ),
  },

  /* ---------------- READ ---------------- */
  {
    name: "search_products",
    description:
      "Find products in inventory. Use it to look up ids, stock, cost and price. Call it before updating or deleting a product.",
    parameters: obj({
      query: str("Product name or part of it, or an exact barcode."),
      category: str("Filter by category.", PRODUCT_CATS),
      lowStockOnly: bool("Only products that are low or out of stock."),
      limit: int("Max results, default 15."),
    }),
  },
  {
    name: "list_transactions",
    description:
      "List transactions of one month (default: this month). Use it to find a transaction id or answer questions about earnings and spending.",
    parameters: obj({
      month: str("Month as yyyy-MM. Default is the current month."),
      type: str("in = money earned, out = money spent.", ["in", "out"]),
      category: str("Filter by category.", TX_CATEGORIES),
      query: str("Words in the description."),
      limit: int("Max results, default 20."),
    }),
  },
  {
    name: "get_summary",
    description:
      "Business summary for a period: sales, spending, profit, comparison with the previous period, spending breakdown and stock health.",
    parameters: obj(
      {
        period: str("Period to summarise.", [
          "daily",
          "weekly",
          "monthly",
          "annual",
        ]),
      },
      ["period"],
    ),
  },
  {
    name: "get_checklist",
    description:
      "Compliance checklist progress (SSM, tax, employment, licences, protection).",
    parameters: obj({
      onlyPending: bool("Only list items that are not done yet."),
    }),
  },
  {
    name: "get_publicity",
    description:
      "Publicity / social media plan: this week's planned posting days, views logged and recent weeks.",
  },
  {
    name: "list_tickets",
    description:
      "List reports (tickets) the team raised. Use it to find a ticket id.",
    parameters: obj({
      status: str("Filter by status.", TICKET_STATS),
      query: str("Words in the title."),
      limit: int("Max results, default 15."),
    }),
  },
  {
    name: "scan_receipts",
    description:
      "Read the receipt/invoice images or PDFs the user attached to this message. Returns merchant, date, total, tax and a suggested category for each receipt.",
  },

  /* ---------------- WRITE (always needs the user's approval) ---------------- */
  {
    name: "add_product",
    description:
      "Propose adding a new product. ALWAYS call this when the user wants to add a product, even if they gave no details at all (call it with empty arguments). Pass only the fields the user actually stated. NEVER ask the user for missing fields in chat and never invent values: the app shows a form for whatever is missing.",
    parameters: obj({
      name: str("Product name, only if the user said it."),
      category: str(
        "Product category, only if stated or obvious.",
        PRODUCT_CATS,
      ),
      stock: int("Units in stock, only if stated."),
      cost: num("Cost per unit in RM, only if stated."),
      price: num("Selling price per unit in RM, only if stated."),
      dueDate: str("Food only: expiry date YYYY-MM-DD, only if stated."),
      barcode: str("Optional barcode number."),
    }), // no required list
  },
  {
    name: "update_product",
    description:
      "Propose changes to an existing product. Get the id from search_products first. Use stockChange (+/-) for 'sold 5' or 'received 10' instead of computing stock yourself.",
    parameters: obj(
      {
        id: str("Product id from search_products."),
        name: str("New name."),
        category: str("New category.", PRODUCT_CATS),
        stock: int("New absolute stock."),
        stockChange: int("Relative change, e.g. -5 or 10."),
        cost: num("New cost in RM."),
        price: num("New price in RM."),
        dueDate: str("New due date, YYYY-MM-DD."),
        barcode: str("New barcode."),
      },
      ["id"],
    ),
  },
  {
    name: "delete_product",
    description:
      "Propose deleting a product. Get the id from search_products first.",
    parameters: obj({ id: str("Product id.") }, ["id"]),
  },
  {
    name: "add_transaction",
    description:
      "Propose recording a transaction (money in or out). ALWAYS call this when the user wants to record a sale, expense or transaction, even with no details (empty arguments). Pass only what the user stated. NEVER ask for missing fields in chat and never invent the amount: the app shows a form for the rest. Date defaults to today.",
    parameters: obj({
      type: str("in = earning, out = spending.", ["in", "out"]),
      amount: num("Amount in RM, only if stated."),
      category: str("Category.", TX_CATEGORIES),
      description: str("Short description, e.g. 'Nasi lemak sales'."),
      date: str("YYYY-MM-DD. Default today."),
      paymentMethod: str("Payment method, only if stated.", PAYMENT_METHODS),
      note: str("Optional note."),
    }), // no required list
  },
  {
    name: "update_transaction",
    description:
      "Propose changes to a transaction. Get the id from list_transactions first.",
    parameters: obj(
      {
        id: str("Transaction id."),
        type: str("in or out.", ["in", "out"]),
        amount: num("New amount in RM."),
        category: str("New category.", TX_CATEGORIES),
        description: str("New description."),
        date: str("New date, YYYY-MM-DD."),
        paymentMethod: str("New payment method.", PAYMENT_METHODS),
        note: str("New note."),
      },
      ["id"],
    ),
  },
  {
    name: "delete_transaction",
    description:
      "Propose deleting a transaction. Get the id from list_transactions first.",
    parameters: obj({ id: str("Transaction id.") }, ["id"]),
  },
  {
    name: "add_ticket",
    description:
      "Propose creating a report (ticket) about a problem. Needs a title and a description.",
    parameters: obj(
      {
        title: str("Short title."),
        description: str("What happened, with dates and amounts."),
        category: str("Category.", TICKET_CATS),
        priority: str("Priority, default medium.", TICKET_PRIOS),
        transactionId: str("Optional linked transaction id."),
      },
      ["title", "description"],
    ),
  },
  {
    name: "update_ticket",
    description:
      "Propose changes to a report. Get the id from list_tickets first. Only the owner can change the status.",
    parameters: obj(
      {
        id: str("Ticket id."),
        title: str("New title."),
        description: str("New description."),
        category: str("New category.", TICKET_CATS),
        priority: str("New priority.", TICKET_PRIOS),
        status: str("New status.", TICKET_STATS),
      },
      ["id"],
    ),
  },
  {
    name: "delete_ticket",
    description:
      "Propose deleting a report (owner only). Get the id from list_tickets first.",
    parameters: obj({ id: str("Ticket id.") }, ["id"]),
  },
];
