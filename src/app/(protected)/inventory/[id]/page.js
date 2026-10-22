"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import styles from "./subInventory.module.css";
import CustomInput from "@/components/input/CustomInput";
import CustomSelect from "@/components/input/CustomSelect";
import AppBar from "@/components/layout/AppBar";
import { useAuth } from "@/context/AuthContext";
import { getProduct, updateProduct } from "@/lib/inventory";

// Placeholder — to be replaced by your teammate's AI model output
const PRICE_SUGGESTIONS = [
  { platform: "Shopee", price: 13.9, profit: 5.4 },
  { platform: "Lazada", price: 14.5, profit: 6.0 },
  { platform: "GrabMart", price: 15.9, profit: 7.4 },
];

const CATEGORY_OPTIONS = ["Food", "Drinks", "Household"].map((c) => ({
  value: c,
  label: c,
}));

const formatRM = (value) => `RM ${value.toFixed(2)}`;

const toNum = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

// Inputs work with strings, so the form keeps everything as text
const toForm = (p) => ({
  name: p.name,
  stock: String(p.stock),
  category: p.category,
  cost: p.cost.toFixed(2),
  price: p.price.toFixed(2),
  dueDate: p.dueDate ?? "",
});

const validate = (form) => {
  const errors = {};
  if (!form.name.trim()) errors.name = "Name is required.";
  if (!/^\d+$/.test(form.stock)) errors.stock = "Whole number only.";
  if (!(parseFloat(form.cost) >= 0)) errors.cost = "Enter the cost.";
  if (!(parseFloat(form.price) >= 0)) errors.price = "Enter the price.";
  if (form.category === "Food" && !form.dueDate)
    errors.dueDate = "Pick a due date.";
  return errors;
};

export default function SubInventoryPage() {
  const { id } = useParams();
  const { profile } = useAuth();
  const orgId = profile?.orgId;

  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState(null); // null = still loading
  const [saved, setSaved] = useState(null);
  const [barcode, setBarcode] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Profit can be typed as a fixed RM amount or a % on cost.
  const [profitMode, setProfitMode] = useState("rm"); // "rm" | "percent"
  const [profitDraft, setProfitDraft] = useState(null);

  useEffect(() => {
    if (!orgId || !id) return;
    let cancelled = false;
    getProduct(orgId, id)
      .then((p) => {
        if (cancelled) return;
        if (p) {
          setForm(toForm(p));
          setSaved(toForm(p));
          setBarcode(p.barcode);
        }
        setLoaded(true);
      })
      .catch((err) => {
        console.error("Product read failed:", err);
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, id]);

  const costNum = toNum(form?.cost);
  const priceNum = toNum(form?.price);
  const profitRM = priceNum - costNum;
  const profitPercent = costNum > 0 ? (profitRM / costNum) * 100 : 0;

  const profitValue =
    profitDraft ??
    (profitMode === "rm" ? profitRM.toFixed(2) : profitPercent.toFixed(1));

  const dirty =
    form && saved ? JSON.stringify(form) !== JSON.stringify(saved) : false;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((er) => ({ ...er, [name]: "" }));
    setJustSaved(false);
    if (name === "cost" || name === "price") setProfitDraft(null);
  };

  const handleProfitChange = (e) => {
    const value = e.target.value;
    const n = toNum(value);
    const nextPrice =
      profitMode === "rm" ? costNum + n : costNum * (1 + n / 100);
    setProfitDraft(value);
    setForm((f) => ({ ...f, price: nextPrice.toFixed(2) }));
    setErrors((er) => ({ ...er, price: "" }));
    setJustSaved(false);
  };

  const handleModeChange = (mode) => {
    setProfitMode(mode);
    setProfitDraft(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      await updateProduct({
        orgId,
        productId: id,
        product: {
          name: form.name,
          stock: Number(form.stock),
          category: form.category,
          cost: parseFloat(form.cost),
          price: parseFloat(form.price),
          dueDate: form.dueDate,
          barcode,
        },
      });
      setSaved(form);
      setProfitDraft(null);
      setJustSaved(true);
    } catch (err) {
      console.error("Product update failed:", err);
    } finally {
      setSaving(false);
    }
  };

  // Auth gate hasn't resolved yet
  if (!loaded) {
    return (
      <>
        <AppBar title="Inventory" />
        <main className={styles.subInventoryPage}>
          <p style={{ textAlign: "center", padding: 40 }}>Loading...</p>
        </main>
      </>
    );
  }

  if (!form) {
    return (
      <>
        <AppBar title="Not found" />
        <main className={styles.subInventoryPage}>
          <section className={styles.detailSection}>
            <div className={styles.detailRow}>
              <p>This product doesn't exist or was deleted.</p>
            </div>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <AppBar title={form.name || saved.name} />
      <main className={styles.subInventoryPage}>
        {/* ── Section 1: Top Header ── */}
        <section className={styles.topWrapper}>
          <div className={styles.topCardWrapper}>
            <div className={styles.topCard}>
              <h1>
                Stock<span>{form.stock}</span>
              </h1>
            </div>
            <div className={styles.topCard}>
              <h1>
                Category<span>{form.category}</span>
              </h1>
            </div>
          </div>
        </section>

        {/* ── Section 2: Product Details (editable) ── */}
        <form className={styles.detailSection} onSubmit={handleSave} noValidate>
          <h2>Product Details</h2>
          <div className={styles.detailList}>
            <div className={styles.formCard}>
              <CustomInput
                label="Product Name"
                name="name"
                value={form.name}
                onChange={handleChange}
                error={errors.name}
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
                />
              </div>

              {/* Profit: pick fixed RM or % on cost */}
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
                placeholder={
                  profitMode === "rm" ? "Profit in RM" : "Profit in %"
                }
              />
              <p className={styles.profitHint}>
                {profitMode === "percent" && costNum <= 0
                  ? "Enter the cost first to set profit by percentage."
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

            {/* Barcode stays read-only */}
            <div className={styles.detailRow}>
              <p>Barcode Number</p>
              <p>{barcode || "-"}</p>
            </div>
          </div>

          {dirty && (
            <button type="submit" className={styles.saveBtn} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          )}
          {justSaved && !dirty && <p className={styles.savedText}>Saved</p>}
        </form>

        {/* ── Section 3: AI Price Suggestion ── */}
        <section className={styles.suggestionSection}>
          <h2>
            Price Suggestion <span className={styles.aiBadge}>AI</span>
          </h2>
          <div className={styles.suggestionGrid}>
            {PRICE_SUGGESTIONS.map((s) => (
              <div key={s.platform} className={styles.suggestionCard}>
                <h3>{s.platform}</h3>
                <div className={styles.suggestionRow}>
                  <p>Price</p>
                  <p>{formatRM(s.price)}</p>
                </div>
                <div className={styles.suggestionRow}>
                  <p>Profit</p>
                  <p className={styles.profitValue}>{formatRM(s.profit)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
