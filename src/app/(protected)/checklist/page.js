"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { CHECKLIST, CHECKLIST_TOTAL } from "@/lib/checklist";
import { setChecklistItem } from "@/lib/profile";
import NavBar from "@/components/layout/NavBar";
import styles from "./checklist.module.css";

const FREQUENCY_LABEL = {
  "one-time": "One-time",
  monthly: "Monthly",
  yearly: "Yearly",
  periodic: "Periodic",
};

export default function ChecklistPage() {
  const { user, profile } = useAuth();
  const orgId = profile?.orgId;
  const [done, setDone] = useState({}); // { [itemId]: true }

  useEffect(() => {
    if (!orgId) return;
    return onSnapshot(
      collection(db, "organizations", orgId, "checklist"),
      (snap) => {
        const next = {};
        snap.forEach((d) => {
          if (d.data().done) next[d.id] = true;
        });
        setDone(next);
      },
      (err) => console.error("Checklist listener failed:", err),
    );
  }, [orgId]);

  const doneCount = CHECKLIST.reduce(
    (sum, group) => sum + group.items.filter((i) => done[i.id]).length,
    0,
  );
  const percent = Math.round((doneCount / CHECKLIST_TOTAL) * 100);

  const toggle = (itemId) =>
    setChecklistItem({ orgId, itemId, user, done: !done[itemId] }).catch(
      (err) => console.error("Checklist update failed:", err),
    );

  return (
    <>
      <main className={styles.checklistPage}>
        {/* ── Section 1: Top header ── */}
        <section className={styles.topWrapper}>
          <div className={styles.topAction}>
            <Link href="/home" aria-label="Back to home">
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
                  d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
                />
              </svg>
            </Link>
          </div>
          <h1>Compliance Checklist</h1>
          <div className={styles.progressCard}>
            <h1>
              Completed
              <span>
                {doneCount} / {CHECKLIST_TOTAL}
              </span>
            </h1>
            <div
              className={styles.progressTrack}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <div
                className={styles.progressBar}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </section>

        {/* ── Section 2: Groups ── */}
        {CHECKLIST.map((group) => {
          const groupDone = group.items.filter((i) => done[i.id]).length;
          return (
            <section key={group.id} className={styles.groupSection}>
              <h2 className={styles.groupTitle}>
                {group.title}
                <span>
                  {groupDone}/{group.items.length}
                </span>
              </h2>
              <div className={styles.card}>
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="checkbox"
                    aria-checked={!!done[item.id]}
                    className={`${styles.item} ${
                      done[item.id] ? styles.itemDone : ""
                    }`}
                    onClick={() => toggle(item.id)}
                  >
                    <span className={styles.check}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="3"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m4.5 12.75 6 6 9-13.5"
                        />
                      </svg>
                    </span>
                    <span className={styles.itemBody}>
                      <span className={styles.itemTitle}>{item.title}</span>
                      <span className={styles.itemDesc}>
                        {item.description}
                      </span>
                      <span className={styles.itemTag}>
                        {FREQUENCY_LABEL[item.frequency]}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </main>

      <NavBar />
    </>
  );
}
