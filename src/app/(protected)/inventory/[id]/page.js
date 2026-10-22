"use client";
 
import { useRouter } from "next/navigation";
import styles from "./subInventory.module.css";
import NavBar from "@/components/layout/NavBar";
import Link from "next/link";
 
// Placeholder data — replace with a fetch by product id (e.g. from route params)
const PRODUCT = {
  id: 1,
  name: "Product A",
  stock: 24,
  category: "Food",
  cost: 8.5,
  price: 12.9,
  dueDate: "2026-12-31", // only used when category === "Food"
  barcode: "9555012345678",
};
 
// Placeholder — to be replaced by your teammate's AI model output
const PRICE_SUGGESTIONS = [
  { platform: "Shopee", price: 13.9, profit: 5.4 },
  { platform: "Lazada", price: 14.5, profit: 6.0 },
  { platform: "GrabMart", price: 15.9, profit: 7.4 },
];
 
const formatRM = (value) => `RM ${value.toFixed(2)}`;
 
const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
 
export default function SubInventoryPage() {
  const router = useRouter();
 
  return (
    <>
      <main className={styles.subInventoryPage}>
 
        {/* ── Section 1: Top Header ── */}
        <section className={styles.topWrapper}>
          <div className={styles.topAction}>
            <button onClick={() => router.back()} aria-label="Back">
              <svg className={styles.topActionLogo} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
            </button>
          </div>
          <h1 className={styles.productName}>{PRODUCT.name}</h1>
          <div className={styles.topCardWrapper}>
            <div className={styles.topCard}>
              <h1>Stock<span>{PRODUCT.stock}</span></h1>
            </div>
            <div className={styles.topCard}>
              <h1>Category<span>{PRODUCT.category}</span></h1>
            </div>
          </div>
        </section>
 
        {/* ── Section 2: Product Details ── */}
        <section className={styles.detailSection}>
          <h2>Product Details</h2>
          <div className={styles.detailList}>
            <div className={styles.detailRow}>
              <p>Cost</p>
              <p>{formatRM(PRODUCT.cost)}</p>
            </div>
            <div className={styles.detailRow}>
              <p>Price</p>
              <p>{formatRM(PRODUCT.price)}</p>
            </div>
            {PRODUCT.category === "Food" && (
              <div className={styles.detailRow}>
                <p>Food Due Date</p>
                <p>{formatDate(PRODUCT.dueDate)}</p>
              </div>
            )}
            <div className={styles.detailRow}>
              <p>Barcode Number</p>
              <p>{PRODUCT.barcode}</p>
            </div>
          </div>
        </section>
 
        {/* ── Section 3: AI Price Suggestion ── */}
        <section className={styles.suggestionSection}>
          <h2>Price Suggestion <span className={styles.aiBadge}>AI</span></h2>
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
 
      <NavBar />
    </>
  );
}