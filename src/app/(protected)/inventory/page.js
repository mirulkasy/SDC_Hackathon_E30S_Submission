"use client";
 
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "./inventory.module.css";
import NavBar from "@/components/layout/NavBar";
import Link from "next/link";
 
// Replace with real data (API / database) later
const PRODUCTS = [
  { id: 1, name: "Product A", price: 12.9, stock: 24, category: "Food", image: "/assets/products/product-a.png" },
  { id: 2, name: "Product B", price: 8.5, stock: 3, category: "Drinks", image: "/assets/products/product-b.png" },
  { id: 3, name: "Product C", price: 45, stock: 0, category: "Household", image: "/assets/products/product-c.png" },
  { id: 4, name: "Product D", price: 19.9, stock: 12, category: "Food", image: "/assets/products/product-d.png" },
];
 
const CATEGORIES = ["All", ...new Set(PRODUCTS.map((p) => p.category))];
 
export default function InventoryPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [showFilter, setShowFilter] = useState(false);
 
  const filtered = PRODUCTS.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) &&
      (category === "All" || p.category === category)
  );
 
  return (
    <>
      <main className={styles.inventoryPage}>
 
        {/* ── Section 1: Top Bar ── */}
        <section className={styles.topBar}>
          <div className={styles.topAction}>
            <button onClick={() => router.back()} aria-label="Back">
              <svg className={styles.topActionLogo} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                
              </svg>
            </button>
            <h1 className={styles.titleText}>Inventory</h1>
          </div>
          
        </section>
 
        {/* ── Section 2: Search & Filter ── */}
        <section className={styles.searchBar}>
          <div className={styles.searchRow}>
            <div className={styles.searchBox}>
              <svg className={styles.searchLogo} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text"
                placeholder="Search product"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              className={`${styles.filterButton} ${showFilter ? styles.filterActive : ""}`}
              onClick={() => setShowFilter(!showFilter)}
              aria-label="Filter by category"
            >
              <svg className={styles.topActionLogo} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
              </svg>
            </button>
          </div>
 
          {showFilter && (
            <div className={styles.categoryList}>
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  className={`${styles.categoryChip} ${category === c ? styles.categoryActive : ""}`}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </section>
 
        {/* ── Section 3: Product Grid ── */}
        <section className={styles.inventory}>
          <div className={styles.productGrid}>
            {filtered.map((p) => (
              <Link key={p.id}
              href={`/inventory/${p.id}`} 
              className={styles.productCard}>
                {/* <Image src={p.image} alt={p.name} width={150} height={150} /> */}
                <div className={styles.productInfo}>
                  <span className={styles.productCategory}>{p.category}</span>
                  <h2>{p.name}</h2>
                  <p className={styles.productPrice}>RM {p.price.toFixed(2)}</p>
                  <p className={`${styles.productStock} ${p.stock <= 5 ? styles.lowStock : ""}`}>
                    {p.stock === 0 ? "Out of stock" : `${p.stock} left`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
          {filtered.length === 0 && <p className={styles.emptyText}>No products found</p>}
        </section>
 
      </main>
 
      <NavBar />
    </>
  );
}