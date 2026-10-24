"use client";

import { useEffect, useState } from "react";
import useSplashRouter from "@/lib/useSplashRouter";
import Link from "next/link";
import styles from "./ticket.module.css";
import NavBar from "@/components/layout/NavBar";
import AppBar from "@/components/layout/AppBar";
import { useAuth } from "@/context/AuthContext";
import ExportMenu from "@/components/layout/ExportMenu";
import { buildReportCsv } from "@/lib/csv-builders";
import {
  subscribeTickets,
  getStatusMeta,
  getPriorityMeta,
  getCategoryLabel,
} from "@/lib/tickets";

export default function TicketPage() {
  const router = useSplashRouter();
  const { profile } = useAuth();
  const orgId = profile?.orgId;

  const [tickets, setTickets] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    setLoaded(false);
    return subscribeTickets(orgId, (items) => {
      setTickets(items);
      setLoaded(true);
    });
  }, [orgId]);

  return (
    <>
      <AppBar
        title="Tickets"
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
        onAction={() => router.push("/ticket/add")}
      />

      <div className={styles.exportMenu}>
        <p>Export</p>
        <ExportMenu page="report" getData={() => buildReportCsv(tickets)} />
      </div>

      <main className={styles.ticketPage}>
        {/* ── Section 2: Ticket List ── */}
        <section className={styles.ticketSection}>
          <div className={styles.ticketList}>
            {!loaded && <p className={styles.emptyText}>Loading...</p>}
            {loaded && tickets.length === 0 && (
              <div className={styles.emptyState}>
                <h2>No tickets yet</h2>
                <p>
                  Report a problem with cash flow, inventory or your account and
                  the owner will pick it up here.
                </p>
              </div>
            )}

            {tickets.map((ticket) => {
              const status = getStatusMeta(ticket.status);
              const priority = getPriorityMeta(ticket.priority);
              return (
                <Link
                  key={ticket.id}
                  href={`/ticket/${ticket.id}`}
                  className={styles.ticketCard}
                >
                  <div className={styles.ticketTop}>
                    <h2>{ticket.title}</h2>
                    <span
                      className={`${styles.statusPill} ${styles[status.className]}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div className={styles.ticketMeta}>
                    <span className={styles.ticketNo}>{ticket.ticketNo}</span>
                    <span className={styles.metaSep}>·</span>
                    <span>{getCategoryLabel(ticket.category)}</span>
                    <span className={styles.metaSep}>·</span>
                    <span
                      className={`${styles.priorityBadge} ${styles[priority.className]}`}
                    >
                      {priority.label}
                    </span>
                  </div>

                  <p className={styles.ticketDesc}>{ticket.description}</p>

                  <div className={styles.ticketFooter}>
                    <span>by {ticket.reportedBy.name}</span>
                    <span>{ticket.createdLabel}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </main>

      <NavBar />
    </>
  );
}
