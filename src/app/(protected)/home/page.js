"use client";

import { useEffect, useState } from "react";
import styles from "./home.module.css";
import { useAuth } from "@/context/AuthContext";
import { subscribeDailyStats, formatRMFromSen } from "@/lib/transactions";
import Image from "next/image";
import NavBar from "@/components/layout/NavBar";
import Link from "next/link";

export default function HomePage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    sales: 0,
    spending: 0,
    profit: 0,
    loaded: false,
  });

  useEffect(() => {
    if (!profile?.orgId) return;
    return subscribeDailyStats(profile.orgId, setStats);
  }, [profile?.orgId]);

  return (
    <>
      <main className={styles.homePage}>
        <section className={styles.topWrapper}>
          <div className={styles.topAction}>
            <Link href="/profile" aria-label="Profile">
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
                  d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                />
              </svg>
            </Link>

            <h1>Hello, {profile?.name ?? ""}</h1>
          </div>
          <div className={styles.topCardWrapper}>
            <div className={styles.topCard}>
              <h1>
                Daily Sales
                <span>{stats.loaded ? formatRMFromSen(stats.sales) : "—"}</span>
              </h1>
            </div>
            <div className={styles.topCard}>
              <h1>
                Daily Profit
                <span>
                  {stats.loaded ? formatRMFromSen(stats.profit) : "—"}
                </span>
              </h1>
            </div>
          </div>
        </section>

        <section className={styles.appList}>
          <Link href="/invoice" className={styles.appButton}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 64 64"
              width="50"
              height="50"
              fill="none"
            >
              <rect
                x="24"
                y="18"
                width="30"
                height="38"
                rx="9"
                fill="#ffd23f"
              />
              <g
                stroke="#0b3d2e"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 17a9 9 0 0 1 9-9h20a9 9 0 0 1 9 9v35l-6.330 4-6.340-4-6.330 4-6.330-4-6.340 4L11 52z" />
                <path d="M21 22h10" />
                <path d="M21 32h18" />
                <path d="M21 42h10" />
              </g>
            </svg>
            <p>E-Invoice</p>
          </Link>

          <Link href="/publicity" className={styles.appButton}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 64 64"
              width="50"
              height="50"
              fill="none"
            >
              <circle cx="38" cy="36" r="16" fill="#ffd23f" />
              <g
                stroke="#0b3d2e"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 31a3 3 0 0 1 3-3h7l22-12v40L18 44h-7a3 3 0 0 1-3-3z" />
                <path d="M20 45l3 10h6l-2-9" />
                <path d="M49 29c2.500 4 2.500 8 0 12" />
              </g>
              <path
                d="M54 6l2 4.500 4.500 2-4.500 2-2 4.500-2-4.500-4.500-2 4.500-2z"
                fill="#0b3d2e"
              />
            </svg>
            <p>Publicity</p>
          </Link>

          <Link href="/checklist" className={styles.appButton}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 64 64"
              width="50"
              height="50"
              fill="none"
            >
              <rect
                x="24"
                y="18"
                width="30"
                height="38"
                rx="9"
                fill="#ffd23f"
              />
              <rect
                x="11"
                y="8"
                width="38"
                height="48"
                rx="9"
                stroke="#0b3d2e"
                strokeWidth="3.5"
              />
              <circle cx="21" cy="20" r="4.500" fill="#0b3d2e" />
              <circle cx="21" cy="32" r="4.500" fill="#0b3d2e" />
              <circle
                cx="21"
                cy="44"
                r="4"
                stroke="#0b3d2e"
                strokeWidth="2.500"
              />
              <g strokeLinecap="round" strokeLinejoin="round">
                <path
                  d="M18.800 20l1.600 1.600 2.900-3.100"
                  stroke="#ffd23f"
                  strokeWidth="2.200"
                />
                <path
                  d="M18.800 32l1.600 1.600 2.900-3.100"
                  stroke="#ffd23f"
                  strokeWidth="2.200"
                />
                <g stroke="#0b3d2e" strokeWidth="3.500">
                  <path d="M30 20h10" />
                  <path d="M30 32h10" />
                  <path d="M30 44h6" />
                </g>
              </g>
            </svg>
            <p>Checklist</p>
          </Link>

          <Link href="/ticket" className={styles.appButton}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 64 64"
              width="50"
              height="50"
              fill="none"
            >
              <rect
                x="24"
                y="18"
                width="30"
                height="38"
                rx="9"
                fill="#ffd23f"
              />
              <rect
                x="11"
                y="8"
                width="38"
                height="48"
                rx="9"
                stroke="#0b3d2e"
                strokeWidth="3.5"
              />
              <g
                stroke="#0b3d2e"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 44v-6" />
                <path d="M30 44V28" />
                <path d="M39 44V20" />
              </g>
            </svg>
            <p>Report</p>
          </Link>
        </section>

        <section className={styles.aidWrapper}>
          <Link href="/aid" className={styles.aidBanner}>
            <h1>Find the Right Financial Aid to Scale Your SME</h1>
            <div>Explore Now</div>
            <Image
              src="/assets/icon/saving.svg"
              alt="Logo"
              width={100}
              height={100}
            />
          </Link>
        </section>
      </main>

      <NavBar></NavBar>
    </>
  );
}
