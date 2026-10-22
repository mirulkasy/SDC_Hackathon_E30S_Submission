"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./addInventory.module.css";
import CustomInput from "@/components/input/CustomInput";
import CustomSelect from "@/components/input/CustomSelect";
import { useAuth } from "@/context/AuthContext";
import { addProduct } from "@/lib/inventory";
import AppBar from "@/components/layout/AppBar";

const CATEGORY_OPTIONS = ["Food", "Drinks", "Household"].map((c) => ({
  value: c,
  label: c,
}));

const EMPTY_FORM = {
  name: "",
  stock: "",
  category: "Food",
  cost: "",
  price: "",
  dueDate: "",
  barcode: "",
};

const formatRM = (value) => `RM ${Number(value).toFixed(2)}`;

const toNum = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

const validate = (form) => {
  const errors = {};
  if (!form.name.trim()) errors.name = "Name is required.";
  if (!/^\d+$/.test(form.stock)) errors.stock = "Whole number only.";
  if (!(parseFloat(form.cost) >= 0)) errors.cost = "Enter the cost.";
  if (!(parseFloat(form.price) >= 0)) errors.price = "Enter the selling price.";
  if (form.category === "Food" && !form.dueDate)
    errors.dueDate = "Pick a due date.";
  return errors;
};

export default function AddInventoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();
  const orgId = profile?.orgId;

  const [form, setForm] = useState({
    ...EMPTY_FORM,
    barcode: searchParams.get("barcode") ?? "",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [profitMode, setProfitMode] = useState("rm"); // "rm" | "percent"
  const [profitDraft, setProfitDraft] = useState(null);

  const costNum = toNum(form.cost);
  const priceNum = toNum(form.price);
  const profitRM = priceNum - costNum;
  const profitPercent = costNum > 0 ? (profitRM / costNum) * 100 : 0;

  const profitValue =
    profitDraft ??
    (profitMode === "rm"
      ? profitRM > 0
        ? profitRM.toFixed(2)
        : ""
      : profitPercent > 0
        ? profitPercent.toFixed(1)
        : "");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((er) => ({ ...er, [name]: "" }));
    if (name === "cost" || name === "price") setProfitDraft(null);
  };

  const handleProfitChange = (e) => {
    const value = e.target.value;
    const n = toNum(value);
    const nextPrice =
      profitMode === "rm" ? costNum + n : costNum * (1 + n / 100);
    setProfitDraft(value);
    setForm((f) => ({
      ...f,
      price: nextPrice > 0 ? nextPrice.toFixed(2) : "",
    }));
    setErrors((er) => ({ ...er, price: "" }));
  };

  const handleModeChange = (mode) => {
    setProfitMode(mode);
    setProfitDraft(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      await addProduct({
        orgId,
        user,
        product: {
          name: form.name,
          stock: Number(form.stock),
          category: form.category,
          cost: parseFloat(form.cost),
          price: parseFloat(form.price),
          dueDate: form.dueDate,
          barcode: form.barcode,
        },
      });
      router.push("/inventory");
      // The page stays mounted in the background, so reset it
      setForm({ ...EMPTY_FORM, barcode: "" });
      setErrors({});
      setProfitMode("rm");
      setProfitDraft(null);
      setSaving(false);
    } catch (err) {
      console.error("Add product failed:", err);
      setSaving(false);
    }
  };

  useEffect(() => {
    const code = searchParams.get("barcode");
    if (code) setForm((f) => ({ ...f, barcode: code }));
  }, [searchParams]);

  // Derived preview values for the top header
  const previewName = form.name.trim() || "New Product";
  const previewStock = form.stock || "—";
  const previewCategory = form.category || "—";

  return (
    <Suspense fallback={null}>
      <AppBar title={previewName} />
      <main className={styles.addInventoryPage}>
        {/* ── Section 1: Top Header ── */}
        <section className={styles.topWrapper}>
          <div className={styles.topCardWrapper}>
            <div className={styles.topCard}>
              <h1>
                Stock<span>{previewStock}</span>
              </h1>
            </div>
            <div className={styles.topCard}>
              <h1>
                Category<span>{previewCategory}</span>
              </h1>
            </div>
          </div>
        </section>

        {/* ── Section 2: Add Product Form ── */}
        <form className={styles.formSection} onSubmit={handleSubmit} noValidate>
          <h2>Product Details</h2>

          <div className={styles.formCard}>
            <CustomInput
              label="Product Name"
              name="name"
              value={form.name}
              onChange={handleChange}
              error={errors.name}
              placeholder="e.g. Milo Tin 400g"
            />

            <div className={styles.fieldGrid}>
              <CustomInput
                label="Stock"
                name="stock"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={form.stock}
                onChange={handleChange}
                error={errors.stock}
                placeholder="0"
              />
              <CustomSelect
                label="Category"
                name="category"
                options={CATEGORY_OPTIONS}
                value={form.category}
                onChange={handleChange}
              />
            </div>

            <div className={styles.fieldGrid}>
              <CustomInput
                label="Cost (RM)"
                name="cost"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={form.cost}
                onChange={handleChange}
                error={errors.cost}
                placeholder="0.00"
              />
              <CustomInput
                label="Price (RM)"
                name="price"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={form.price}
                onChange={handleChange}
                error={errors.price}
                placeholder="0.00"
              />
            </div>

            {/* Profit — RM or % toggle */}
            <div className={styles.profitHeader}>
              <p>Profit</p>
              <div className={styles.modeToggle}>
                {[
                  { id: "rm", label: "RM" },
                  { id: "percent", label: "%" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={profitMode === m.id}
                    className={`${styles.modeBtn} ${profitMode === m.id ? styles.modeBtnActive : ""}`}
                    onClick={() => handleModeChange(m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <CustomInput
              name="profit"
              type="number"
              inputMode="decimal"
              step={profitMode === "rm" ? "0.01" : "0.1"}
              value={profitValue}
              onChange={handleProfitChange}
              placeholder={profitMode === "rm" ? "e.g. 4.00" : "e.g. 30"}
            />
            <p className={styles.profitHint}>
              {costNum <= 0
                ? "Enter the cost first to calculate profit."
                : `${formatRM(profitRM)} profit · ${profitPercent.toFixed(1)}% on cost`}
            </p>

            {form.category === "Food" && (
              <CustomInput
                label="Food Due Date"
                name="dueDate"
                type="date"
                value={form.dueDate}
                onChange={handleChange}
                error={errors.dueDate}
              />
            )}
          </div>

          {/* ── Barcode ── */}
          <h2>Barcode</h2>
          <div className={styles.barcodeCard}>
            <button
              type="button"
              className={styles.scanBtn}
              aria-label="Scan barcode"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                width={20}
                height={20}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5ZM6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z"
                />
              </svg>
            </button>
            <CustomInput
              label="Barcode Number"
              name="barcode"
              inputMode="numeric"
              value={form.barcode}
              onChange={handleChange}
              placeholder="e.g. 9555012345678"
            />
          </div>

          {/* ── Submit ── */}
          <button type="submit" className={styles.addBtn} disabled={saving}>
            {saving ? "Adding..." : "Add Product"}
          </button>
        </form>
      </main>
    </Suspense>
  );
}
