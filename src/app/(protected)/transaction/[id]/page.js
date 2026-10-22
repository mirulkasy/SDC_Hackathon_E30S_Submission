import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "./transactionDetail.module.css";
import NavBar from "@/components/layout/NavBar";
import {
  getTransactionById,
  formatAmount,
  formatDate,
} from "../data/transactions";

export default async function TransactionDetailPage({ params }) {
  const { id } = await params;
  const item = getTransactionById(id);

  if (!item) notFound();

  const isEarning = item.type === "earning";

  return (
    <>
      <main className={styles.transactionDetailPage}>
        {/* ── Section 1: Top Header ── */}
        <section className={styles.topWrapper}>
          <div className={styles.topAction}>
            <Link href="/transaction" aria-label="Back">
              <svg
                className={styles.topActionLogo}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 19.5 8.25 12l7.5-7.5"
                />
              </svg>
            </Link>
          </div>
          <h1>{item.title}</h1>
          <div className={styles.topCardWrapper}>
            <div className={styles.topCard}>
              <h1>
                {isEarning ? "Amount Earned" : "Amount Spent"}
                <span
                  className={isEarning ? styles.pricePlus : styles.priceMinus}
                >
                  {formatAmount(item)}
                </span>
              </h1>
            </div>
          </div>
        </section>

        {/* ── Section 2: Details ── */}
        <section className={styles.detailSection}>
          <div className={styles.detailList}>
            <div className={styles.detailRow}>
              <p>Category</p>
              <span>{item.category}</span>
            </div>
            <div className={styles.detailRow}>
              <p>Type</p>
              <span>{isEarning ? "Earning" : "Spending"}</span>
            </div>
            <div className={styles.detailRow}>
              <p>Date</p>
              <span>{formatDate(item.date)}</span>
            </div>
            <div className={styles.detailRow}>
              <p>Payment Method</p>
              <span>{item.method}</span>
            </div>
            <div className={styles.detailRow}>
              <p>Reference</p>
              <span>{item.reference}</span>
            </div>
            <div className={styles.detailRow}>
              <p>Note</p>
              <span>{item.note || "-"}</span>
            </div>
          </div>
        </section>
      </main>

      <NavBar />
    </>
  );
}
