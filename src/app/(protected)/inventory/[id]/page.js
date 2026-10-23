"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import styles from "./subInventory.module.css";
import CustomInput from "@/components/input/CustomInput";
import CustomSelect from "@/components/input/CustomSelect";
import AppBar from "@/components/layout/AppBar";
import { useAuth } from "@/context/AuthContext";
import { getProduct, updateProduct, deleteProduct } from "@/lib/inventory";

const CATEGORY_OPTIONS = ["Food", "Drinks", "Household"].map((c) => ({
  value: c,
  label: c,
}));

// Platform fees up to 30% leave room for at most ~60% margin
const MAX_TARGET_MARGIN = 60;

const formatRM = (value) =>
  `${value < 0 ? "-" : ""}RM ${Math.abs(value).toFixed(2)}`;

const formatSigned = (v) =>
  v > 0.005
    ? `+RM ${v.toFixed(2)}`
    : v < -0.005
      ? `-RM ${Math.abs(v).toFixed(2)}`
      : "RM 0.00";

const toNum = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

// Profit as a % of the SELLING price (what the pricing API expects).
// At or below cost -> 0 (break-even).
const marginOf = (cost, price) =>
  price > cost && price > 0
    ? Math.round(((price - cost) / price) * 1000) / 10
    : 0;

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

  // Price suggestions from /api/ecommerce-pricing.
  // targetMargin follows what the owner sets above. It is NOT touched by
  // "Use this price", so applying one card never shifts the others.
  const [targetMargin, setTargetMargin] = useState(0); // % of selling price
  const [suggestions, setSuggestions] = useState(null);
  const [sugLoading, setSugLoading] = useState(false);
  const [sugError, setSugError] = useState("");

  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef(null);

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
          setTargetMargin(marginOf(p.cost, p.price));
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

  // Ask the pricing API when the cost or the owner's target changes (debounced)
  useEffect(() => {
    if (!form) return;
    if (!(costNum > 0)) {
      setSuggestions(null);
      setSugError("");
      setSugLoading(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSugLoading(true);
      setSugError("");
      try {
        const res = await fetch("/api/ecommerce-pricing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productName: saved?.name ?? "",
            costPrice: costNum,
            targetMargin: Math.min(targetMargin, MAX_TARGET_MARGIN),
          }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !Array.isArray(data.platformPrices)) {
          setSugError(data.error || "Couldn't get price suggestions.");
          return;
        }
        setSuggestions(data.platformPrices);
      } catch {
        if (!cancelled) setSugError("Could not reach the server.");
      } finally {
        if (!cancelled) setSugLoading(false);
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costNum, targetMargin]);

  const handleDelete = async () => {
    if (deleting || !orgId || !id) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${saved?.name ?? form?.name}"?`,
    );

    if (!confirmed) return;

    setDeleting(true);

    try {
      await deleteProduct({
        orgId,
        productId: id,
      });

      router.push("/inventory");
    } catch (error) {
      console.error("Product deletion failed:", error);
      window.alert("Failed to delete product. Please try again.");
      setDeleting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((er) => ({ ...er, [name]: "" }));
    setJustSaved(false);
    if (name === "cost" || name === "price") {
      setProfitDraft(null);
      const c = name === "cost" ? toNum(value) : costNum;
      const p = name === "price" ? toNum(value) : priceNum;
      setTargetMargin(marginOf(c, p));
    }
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
    setTargetMargin(marginOf(costNum, nextPrice));
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

  // What the owner would earn on a platform at the CURRENT price
  const profitAtMyPrice = (s) =>
    priceNum * (1 - (s.feePct || 0) / 100) - costNum;
  const losing =
    suggestions && priceNum > 0
      ? suggestions.filter((s) => profitAtMyPrice(s) < -0.005)
      : [];

  const basisText =
    priceNum <= costNum
      ? "Your price is at or below your cost, so these are break-even prices. Raise your profit above to aim higher."
      : `Based on your profit of ${targetMargin.toFixed(1)}% of the selling price${
          targetMargin > MAX_TARGET_MARGIN
            ? ` (capped at ${MAX_TARGET_MARGIN}%)`
            : ""
        }.`;

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
      <AppBar
        title={form.name || saved.name}
        actionMenu={
          <div ref={menuRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="More options"
              aria-expanded={menuOpen}
              style={{
                color: "white",
                background: "transparent",
                border: "none",
                padding: "4px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <circle cx="12" cy="5" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="12" cy="19" r="1.8" />
              </svg>
            </button>

            {menuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: "8px",
                  minWidth: "160px",
                  background: "white",
                  color: "#222",
                  borderRadius: "10px",
                  padding: "6px",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
                  zIndex: 100,
                }}
              >
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    boxSizing: "border-box",
                    width: "100%",
                    padding: "12px",
                    border: "none",
                    background: "transparent",
                    color: "#dc2626",
                    textAlign: "left",
                    cursor: deleting ? "wait" : "pointer",
                    fontSize: "var(--fontsize-13)",
                    fontWeight: "600",
                  }}
                >
                  {deleting ? "Deleting..." : "Delete product"}
                </button>
              </div>
            )}
          </div>
        }
      />
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

        {/* ── Section 3: Price Suggestion (from /api/ecommerce-pricing) ── */}
        <section className={styles.suggestionSection}>
          <h2>
            Price Suggestion <span className={styles.aiBadge}>AI</span>
          </h2>

          {costNum <= 0 ? (
            <p className={styles.suggestionNote}>
              Enter the cost above to see suggested prices.
            </p>
          ) : (
            <p className={styles.suggestionNote}>{basisText}</p>
          )}

          {sugError && <p className={styles.suggestionError}>{sugError}</p>}
          {sugLoading && !suggestions && (
            <p className={styles.suggestionNote}>Calculating...</p>
          )}

          {losing.length > 0 && (
            <p className={styles.lossBanner}>
              If you sell at your current price (RM {priceNum.toFixed(2)}), you
              lose money on {losing.map((s) => s.short || s.name).join(", ")}{" "}
              after platform fees.
            </p>
          )}

          {suggestions && (
            <div
              className={styles.suggestionGrid}
              style={{
                opacity: sugLoading ? 0.5 : 1,
                transition: "opacity .2s",
              }}
            >
              {suggestions.map((s) => {
                const mine = profitAtMyPrice(s);
                const loss = mine < -0.005;
                return (
                  <div key={s.name} className={styles.suggestionCard}>
                    <h3>{s.short || s.name}</h3>
                    <div className={styles.suggestionRow}>
                      <p>Price</p>
                      <p>{formatRM(s.suggestedPrice)}</p>
                    </div>
                    <div className={styles.suggestionRow}>
                      <p>Profit</p>
                      <p className={styles.gainValue}>
                        {formatSigned(s.expectedProfit)}
                      </p>
                    </div>
                    {priceNum > 0 && (
                      <div className={styles.myPriceBox}>
                        <p>If you sell at RM {priceNum.toFixed(2)}:</p>
                        <p
                          className={loss ? styles.lossValue : styles.gainValue}
                        >
                          {loss
                            ? `You lose RM ${Math.abs(mine).toFixed(2)}`
                            : `You earn ${formatSigned(mine)}`}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {suggestions && (
            <p className={styles.suggestionNote}>
              Prices already include each platform's fee. Fees change, so
              confirm the current rate in your seller dashboard.
            </p>
          )}
        </section>
      </main>
    </>
  );
}
