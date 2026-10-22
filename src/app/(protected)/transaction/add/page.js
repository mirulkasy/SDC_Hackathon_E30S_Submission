"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./addTransaction.module.css";
import AppBar from "@/components/layout/AppBar";
import CustomInput from "@/components/input/CustomInput";
import CustomSelect from "@/components/input/CustomSelect";
import { useAuth } from "@/context/AuthContext";
import { addTransaction } from "@/lib/transactions";

const CATEGORY_OPTIONS = [
  { value: "sales", label: "Sales" },
  { value: "stock_purchase", label: "Stock Purchase" },
  { value: "rent", label: "Rent" },
  { value: "utilities", label: "Utilities" },
  { value: "salary", label: "Salary" },
  { value: "marketing", label: "Marketing" },
  { value: "platform_fee", label: "Platform Fee" },
  { value: "tax", label: "Tax" },
  { value: "other", label: "Other" },
];

const METHOD_OPTIONS = [
  "Cash",
  "Bank Transfer",
  "Online Banking",
  "Debit Card",
  "Credit Card",
  "E-Wallet",
].map((m) => ({ value: m, label: m }));

// en-CA locale gives "YYYY-MM-DD", which is what <input type="date"> expects
const todayISO = () => new Date().toLocaleDateString("en-CA");

const EMPTY_FORM = {
  type: "earning", // UI value; converted to "in"/"out" on save
  description: "",
  amount: "",
  category: "",
  date: todayISO(),
  method: "",
  note: "",
};

const validate = (form) => {
  const errors = {};
  if (!form.description.trim()) errors.description = "Description is required.";
  if (!(parseFloat(form.amount) > 0))
    errors.amount = "Enter an amount above 0.";
  if (!form.category) errors.category = "Pick a category.";
  if (!form.date) errors.date = "Pick a date.";
  if (!form.method) errors.method = "Pick a payment method.";
  return errors;
};

export default function AddTransactionPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const orgId = profile?.orgId;

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const isEarning = form.type === "earning";
  const amountNum = parseFloat(form.amount) || 0;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((er) => ({ ...er, [name]: "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      await addTransaction({
        orgId,
        user,
        transaction: {
          type: isEarning ? "in" : "out",
          amount: amountNum, // lib converts to integer sen
          category: form.category,
          description: form.description,
          date: form.date,
          paymentMethod: form.method,
          note: form.note,
        },
      });
      router.push("/transaction");
    } catch (err) {
      console.error("Add transaction failed:", err);
      setSaving(false);
    }
  };

  return (
    <main className={styles.addTransactionPage}>
      <AppBar title="Add Transaction" />

      {/* ── Section 1: Live preview header ── */}
      <section className={styles.topWrapper}>
        <h1 className={styles.previewLabel}>
          {isEarning ? "Earning" : "Spending"}
        </h1>
        <h2 className={isEarning ? styles.previewPlus : styles.previewMinus}>
          {isEarning ? "+" : "-"} RM {amountNum.toFixed(2)}
        </h2>
        <p className={styles.previewDesc}>
          {form.description.trim() || "New transaction"}
        </p>
      </section>

      {/* ── Section 2: Form ── */}
      <form className={styles.formSection} onSubmit={handleSubmit} noValidate>
        <h2>Transaction Details</h2>

        {/* Earning / Spending toggle */}
        <div className={styles.typeToggle}>
          {[
            { id: "earning", label: "Earning" },
            { id: "spending", label: "Spending" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={form.type === t.id}
              className={`${styles.typeBtn} ${
                form.type === t.id ? styles.typeBtnActive : ""
              }`}
              onClick={() =>
                handleChange({ target: { name: "type", value: t.id } })
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className={styles.formCard}>
          <CustomInput
            label="Description"
            name="description"
            value={form.description}
            onChange={handleChange}
            error={errors.description}
            placeholder="e.g. Nasi lemak sales, restock sugar"
          />

          <div className={styles.fieldGrid}>
            <CustomInput
              label="Amount (RM)"
              name="amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={handleChange}
              error={errors.amount}
              placeholder="0.00"
            />
            <CustomInput
              label="Date"
              name="date"
              type="date"
              value={form.date}
              onChange={handleChange}
              error={errors.date}
            />
          </div>

          <div className={styles.fieldGrid}>
            <CustomSelect
              label="Category"
              name="category"
              options={CATEGORY_OPTIONS}
              value={form.category}
              onChange={handleChange}
              error={errors.category}
              placeholder="Select category"
            />
            <CustomSelect
              label="Payment Method"
              name="method"
              options={METHOD_OPTIONS}
              value={form.method}
              onChange={handleChange}
              error={errors.method}
              placeholder="Select method"
            />
          </div>

          <CustomInput
            label="Note (optional)"
            name="note"
            longInput
            value={form.note}
            onChange={handleChange}
            placeholder="Any extra details"
          />
        </div>

        <button type="submit" className={styles.addBtn} disabled={saving}>
          {saving ? "Saving..." : "Add Transaction"}
        </button>
      </form>
    </main>
  );
}
