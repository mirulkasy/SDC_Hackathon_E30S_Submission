"use client";

import { useEffect, useMemo, useState } from "react";
import useSplashRouter from "@/lib/useSplashRouter";
import Image from "next/image";
import styles from "./inventory.module.css";
import NavBar from "@/components/layout/NavBar";
import Link from "next/link";
import AppBar from "@/components/layout/AppBar";
import { useAuth } from "@/context/AuthContext";
import { subscribeProducts } from "@/lib/inventory";
import ExportMenu from "@/components/layout/ExportMenu";
import { buildInventoryCsv } from "@/lib/csv-builders";

// Matches the default settings.lowStockThreshold used on org creation
const LOW_STOCK_THRESHOLD = 5;

export default function InventoryPage() {
  const router = useSplashRouter();
  const { profile } = useAuth();
  const orgId = profile?.orgId;

  const [products, setProducts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [showFilter, setShowFilter] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    setLoaded(false);
    return subscribeProducts(orgId, (items) => {
      setProducts(items);
      setLoaded(true);
    });
  }, [orgId]);

  // Categories come from the real data now, not a placeholder array
  const categories = useMemo(
    () => ["All", ...new Set(products.map((p) => p.category))],
    [products],
  );

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) &&
      (category === "All" || p.category === category),
  );

  return (
    <>
      <AppBar
        title="Inventory"
        actionIcon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            width={22}
            height={22}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
        }
        onAction={() => router.push("/inventory/add")}
      />
      <main className={styles.inventoryPage}>
        {/* ── Section 2: Search & Filter ── */}
        <section className={styles.searchBar}>
          <div className={styles.searchRow}>
            <div className={styles.searchBox}>
              <svg
                className={styles.searchLogo}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search product"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <ExportMenu page="inventory" getData={() => buildInventoryCsv(products)} />
            </div>
            <Link
              href="/barcode"
              className={styles.filterButton}
              aria-label="Scan barcode"
            >
              <svg
                className={styles.filterActionLogo}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5ZM6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75Z"
                />
              </svg>
            </Link>
            <button
              className={`${styles.filterButton} ${showFilter ? styles.filterActive : ""}`}
              onClick={() => setShowFilter(!showFilter)}
              aria-label="Filter by category"
            >
              <svg
                className={styles.filterActionLogo}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z"
                />
              </svg>
            </button>
          </div>

          {showFilter && (
            <div className={styles.categoryList}>
              {categories.map((c) => (
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
              <Link
                key={p.id}
                href={`/inventory/${p.id}`}
                className={styles.productCard}
              >
                {p.imageUrl && (
                  <Image
                    src={p.imageUrl}
                    alt={p.name}
                    width={150}
                    height={150}
                  />
                )}
                <div className={styles.productInfo}>
                  <span className={styles.productCategory}>{p.category}</span>
                  <h2>{p.name}</h2>
                  <p className={styles.productPrice}>RM {p.price.toFixed(2)}</p>
                  <p
                    className={`${styles.productStock} ${p.stock <= LOW_STOCK_THRESHOLD ? styles.lowStock : ""}`}
                  >
                    {p.stock === 0 ? "Out of stock" : `${p.stock} left`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
          {!loaded && <p className={styles.emptyText}>Loading...</p>}
          {loaded && filtered.length === 0 && (
            <p className={styles.emptyText}>No products found</p>
          )}
        </section>
      </main>

      <NavBar />
    </>
  );
}
