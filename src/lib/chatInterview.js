import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

// replace the TOOL_FIELDS keys with real tools
const CATS = ["Food", "Drinks", "Household"].map((c) => ({
  value: c,
  label: c,
}));
const PAY = [
  "Cash",
  "Bank Transfer",
  "Online Banking",
  "Debit Card",
  "Credit Card",
  "E-Wallet",
].map((c) => ({ value: c, label: c }));

const TOOL_FIELDS = {
  add_product: async () => [
    { key: "name", label: "Product name", type: "text", required: true },
    {
      key: "category",
      label: "Category",
      type: "select",
      required: true,
      options: CATS,
    },
    {
      key: "stock",
      label: "Starting stock",
      type: "number",
      required: true,
      min: 0,
    },
    { key: "cost", label: "Cost (RM)", type: "number", required: true, min: 0 },
    {
      key: "price",
      label: "Selling price (RM)",
      type: "number",
      required: true,
      min: 0,
    },
    {
      key: "dueDate",
      label: "Due date (Food only, YYYY-MM-DD)",
      type: "text",
      required: false,
    },
  ],
  add_transaction: async () => [
    {
      key: "type",
      label: "Type",
      type: "select",
      required: true,
      options: [
        { value: "in", label: "Earning" },
        { value: "out", label: "Spending" },
      ],
    },
    {
      key: "amount",
      label: "Amount (RM)",
      type: "number",
      required: true,
      min: 0,
    },
    { key: "description", label: "Description", type: "text", required: true },
    {
      key: "paymentMethod",
      label: "Payment method",
      type: "select",
      required: true,
      options: PAY,
    },
    {
      key: "category",
      label: "Category",
      type: "select",
      required: true,
      options: [
        "sales",
        "stock_purchase",
        "rent",
        "utilities",
        "salary",
        "marketing",
        "platform_fee",
        "tax",
        "other",
      ].map((c) => ({ value: c, label: c })),
    },
  ],
};

// Which required fields is the agent's draft still missing?
export async function buildInterview(action, ctx) {
  const getFields = TOOL_FIELDS[action.tool];
  if (!getFields) return null;
  const fields = await getFields(ctx);
  const missing = fields.filter(
    (f) => f.required && action.args?.[f.key] == null,
  );
  if (missing.length === 0) return null;
  // Ship all fields (user can fill optional ones too), but only "missing" block submission
  return { fields, missingKeys: missing.map((f) => f.key) };
}
