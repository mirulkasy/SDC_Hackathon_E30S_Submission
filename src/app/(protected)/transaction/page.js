"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./transaction.module.css";
import NavBar from "@/components/layout/NavBar";
import { useAuth } from "@/context/AuthContext";
import {
  getEarliestTransactionDate,
  monthKeysFromDate,
  subscribeMonthTransactions,
  formatAmount,
  formatDate,
  formatRM,
  getCategoryColor,
} from "@/lib/transactions";
import AppBar from "@/components/layout/AppBar";

const RADIUS = 80;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function getCurrentMonthKey() {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(key, multipleYears) {
  const [year, month] = key.split("-");

  const label = new Date(Number(year), Number(month) - 1, 1)
    .toLocaleString("en-MY", { month: "short" })
    .toUpperCase();

  return multipleYears ? `${label} ${year}` : label;
}

export default function TransactionPage() {
  const router = useRouter();

  const { profile } = useAuth();
  const orgId = profile?.orgId;

  const [monthKeys, setMonthKeys] = useState([getCurrentMonthKey()]);

  const [month, setMonth] = useState(getCurrentMonthKey());
  const [tab, setTab] = useState("earning");
  const [category, setCategory] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Instagram-style collapsing bar: offset = clamp(offset - delta, -barHeight, 0)
  const topRef = useRef(null); // header above the bar (defines its natural position)
  const stickyRef = useRef(null);
  const offsetRef = useRef(0);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    if (!orgId) return;

    let cancelled = false;

    async function loadMonths() {
      try {
        const earliestDate = await getEarliestTransactionDate(orgId);

        if (cancelled) return;

        const keys = monthKeysFromDate(earliestDate);

        setMonthKeys(keys);
        setMonth(keys[0]);
        setCategory(null);
      } catch (error) {
        console.error("Failed to load transaction months:", error);
      }
    }

    loadMonths();

    return () => {
      cancelled = true;
    };
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    setLoaded(false);
    return subscribeMonthTransactions(orgId, month, (items) => {
      setTransactions(items);
      setLoaded(true);
    });
  }, [orgId, month]);

  useEffect(() => {
    const bar = stickyRef.current;
    const top = topRef.current;
    if (!bar || !top) return;

    lastScrollYRef.current = Math.max(0, window.scrollY);

    const handleScroll = () => {
      const barHeight = bar.offsetHeight;
      // Where the bar sits in normal flow (NOT bar.offsetTop: that changes once it's stuck)
      const naturalTop = top.offsetTop + top.offsetHeight;

      const maxY = document.documentElement.scrollHeight - window.innerHeight;
      const currentY = Math.min(Math.max(0, window.scrollY), maxY); // ignore iOS overscroll
      const delta = currentY - lastScrollYRef.current;
      lastScrollYRef.current = currentY;

      let next;
      if (currentY <= naturalTop) {
        // Still in normal flow: scrolls with the page, no offset
        next = 0;
      } else {
        // Stuck: slide in/out 1:1 with scroll, clamped between hidden and visible
        next = Math.min(0, Math.max(-barHeight, offsetRef.current - delta));
      }

      if (next !== offsetRef.current) {
        offsetRef.current = next;
        bar.style.transform = `translateY(${next}px)`; // no re-render
      }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isEarning = tab === "earning";

  const { items, categories, total } = useMemo(() => {
    const items = transactions.filter((item) => item.type === tab);

    const totals = {};
    items.forEach((item) => {
      totals[item.category] = (totals[item.category] || 0) + item.amount;
    });

    const categories = Object.entries(totals)
      .map(([name, value]) => ({ name, value, color: getCategoryColor(name) }))
      .sort((a, b) => b.value - a.value);

    const total = categories.reduce((sum, c) => sum + c.value, 0);
    return { items, categories, total };
  }, [transactions, tab]);

  // Donut segments
  let accumulated = 0;
  const segments = categories.map((c) => {
    const length = (c.value / total) * CIRCUMFERENCE;
    const segment = { ...c, length, offset: -accumulated };
    accumulated += length;
    return segment;
  });

  const activeCategory = categories.find((c) => c.name === category);
  const visibleItems = activeCategory
    ? items.filter((item) => item.category === activeCategory.name)
    : items;

  const centerLabel = activeCategory
    ? activeCategory.name
    : isEarning
      ? "Earned So Far"
      : "Spent So Far";
  const centerValue = activeCategory ? activeCategory.value : total;

  const changeMonth = (key) => {
    setMonth(key);
    setCategory(null);
  };
  const changeTab = (key) => {
    setTab(key);
    setCategory(null);
  };

  return (
    <>
      <AppBar
        title="Transaction"
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
        onAction={() => router.push("/transaction/add")}
      />
      <main className={styles.transactionPage}>
        {/* Collapsing bar: transform is set directly in the scroll handler */}
        <section ref={stickyRef} className={styles.stickyWrapper}>
          {/* ── Section 1: Month Filter ── */}
          <section className={styles.monthWrapper}>
            <div className={styles.monthBar}>
              {monthKeys.map((key) => (
                <button
                  key={key}
                  className={key === month ? styles.monthActive : ""}
                  onClick={() => changeMonth(key)}
                >
                  {getMonthLabel(
                    key,
                    new Set(monthKeys.map((item) => item.slice(0, 4))).size > 1,
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* ── Section 2: Tab Bar ── */}
          <section className={styles.tabWrapper}>
            <div className={styles.tabBar} role="tablist">
              <button
                role="tab"
                aria-selected={isEarning}
                className={isEarning ? styles.tabActive : ""}
                onClick={() => changeTab("earning")}
              >
                Earning
              </button>
              <button
                role="tab"
                aria-selected={!isEarning}
                className={!isEarning ? styles.tabActive : ""}
                onClick={() => changeTab("spending")}
              >
                Spending
              </button>
            </div>
          </section>
        </section>

        {/* ── Section 3: Pie Chart + Category Filter ── */}
        <section className={styles.chartWrapper}>
          <div className={styles.chartCard}>
            <svg className={styles.chartSvg} viewBox="0 0 200 200">
              <circle
                cx="100"
                cy="100"
                r={RADIUS}
                fill="none"
                stroke="#dde3e1"
                strokeWidth="28"
              />
              {segments.map((seg) => (
                <circle
                  key={seg.name}
                  cx="100"
                  cy="100"
                  r={RADIUS}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="28"
                  strokeDasharray={`${seg.length} ${CIRCUMFERENCE - seg.length}`}
                  strokeDashoffset={seg.offset}
                  opacity={category && category !== seg.name ? 0.25 : 1}
                  transform="rotate(-90 100 100)"
                />
              ))}
            </svg>
            <div className={styles.chartCenter}>
              <p>{centerLabel}</p>
              <h2 className={isEarning ? styles.pricePlus : styles.priceMinus}>
                {formatRM(centerValue)}
              </h2>
            </div>
          </div>

          <div className={styles.categoryList}>
            {categories.map((c) => (
              <button
                key={c.name}
                className={`${styles.categoryItem} ${
                  category === c.name ? styles.categoryActive : ""
                }`}
                onClick={() => setCategory(category === c.name ? null : c.name)}
              >
                <svg className={styles.categoryIcon} viewBox="0 0 40 40">
                  <circle cx="20" cy="20" r="20" fill={c.color} />
                  <text
                    x="20"
                    y="26"
                    textAnchor="middle"
                    fontSize="18"
                    fontWeight="700"
                    fill="white"
                  >
                    {c.name[0]}
                  </text>
                </svg>
                <p>{c.name}</p>
                <span
                  className={isEarning ? styles.pricePlus : styles.priceMinus}
                >
                  {isEarning ? "+" : "-"}
                  {formatRM(c.value)}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* ── Section 4: Transaction List ── */}
        <section className={styles.listSection}>
          <div className={styles.listGrid}>
            {!loaded && <p className={styles.emptyText}>Loading...</p>}
            {loaded && visibleItems.length === 0 && (
              <p className={styles.emptyText}>
                No transactions for this month.
              </p>
            )}
            {visibleItems.map((item) => (
              <Link
                key={item.id}
                href={`/transaction/${item.id}`}
                className={styles.listItem}
              >
                <div className={styles.listInfo}>
                  <h2>{item.title}</h2>
                  <p>
                    {item.category} · {formatDate(item.date)}
                  </p>
                </div>
                <div
                  className={isEarning ? styles.pricePlus : styles.priceMinus}
                >
                  {formatAmount(item)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <NavBar />
    </>
  );
}
