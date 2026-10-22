"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import styles from "./subTicket.module.css";
import NavBar from "@/components/layout/NavBar";
import AppBar from "@/components/layout/AppBar";
import { useAuth } from "@/context/AuthContext";
import {
  getTicket,
  updateTicketStatus,
  TICKET_STATUSES,
  getStatusMeta,
  getPriorityMeta,
  getCategoryLabel,
} from "@/lib/tickets";

export default function SubTicketPage() {
  const { id } = useParams();
  const { profile } = useAuth();
  const orgId = profile?.orgId;
  // Per the schema, only the owner manages ticket status
  const isOwner = profile?.role === "owner";

  const [ticket, setTicket] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!orgId || !id) return;
    let cancelled = false;
    getTicket(orgId, id)
      .then((t) => {
        if (cancelled) return;
        setTicket(t);
        setLoaded(true);
      })
      .catch((err) => {
        console.error("Ticket read failed:", err);
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, id]);

  const handleStatusChange = async (status) => {
    if (!ticket || ticket.status === status || updating) return;
    setUpdating(true);
    try {
      await updateTicketStatus({ orgId, ticketId: id, status });
      setTicket((t) => ({
        ...t,
        status,
        // resolvedAt is stamped server-side; keep the UI responsive
        resolvedLabel:
          status === "resolved" || status === "closed"
            ? t.resolvedLabel || "just now"
            : "",
      }));
    } catch (err) {
      console.error("Status update failed:", err);
    } finally {
      setUpdating(false);
    }
  };

  // Auth gate hasn't resolved yet
  if (!loaded) {
    return (
      <>
        <AppBar title="Ticket" />
        <main className={styles.subTicketPage}>
          <p style={{ textAlign: "center", padding: 40 }}>Loading...</p>
        </main>
      </>
    );
  }

  if (!ticket) {
    return (
      <>
        <AppBar title="Not found" />
        <main className={styles.subTicketPage}>
          <section className={styles.detailSection}>
            <div className={styles.detailCard}>
              <p>This ticket doesn&apos;t exist.</p>
            </div>
          </section>
        </main>
        <NavBar />
      </>
    );
  }

  const status = getStatusMeta(ticket.status);
  const priority = getPriorityMeta(ticket.priority);

  return (
    <>
      <AppBar title={ticket.ticketNo} />

      <main className={styles.subTicketPage}>
        {/* ── Section 1: Status ── */}
        <section className={styles.statusSection}>
          <div className={styles.statusHeader}>
            <span
              className={`${styles.statusPill} ${styles[status.className]}`}
            >
              {status.label}
            </span>
          </div>

          {isOwner ? (
            <div
              className={styles.statusChips}
              role="group"
              aria-label="Change status"
            >
              {TICKET_STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={ticket.status === s.value}
                  className={`${styles.statusChip} ${
                    ticket.status === s.value ? styles.statusChipActive : ""
                  }`}
                  onClick={() => handleStatusChange(s.value)}
                  disabled={updating}
                >
                  {s.label}
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.ownerNote}>
              Only the owner can update the status of this ticket.
            </p>
          )}
        </section>

        {/* ── Section 2: Description ── */}
        <section className={styles.detailSection}>
          <div className={styles.detailCard}>
            <h2>{ticket.title}</h2>
            <p className={styles.metaLine}>
              {ticket.createdLabel} · by {ticket.reportedBy.name}
            </p>
            <p className={styles.description}>{ticket.description}</p>
          </div>

          {/* ── Section 3: Details ── */}
          <div className={styles.detailCard}>
            <div className={styles.detailRow}>
              <p>Ticket No</p>
              <span>{ticket.ticketNo}</span>
            </div>
            <div className={styles.detailRow}>
              <p>Category</p>
              <span>{getCategoryLabel(ticket.category)}</span>
            </div>
            <div className={styles.detailRow}>
              <p>Priority</p>
              <span
                className={`${styles.priorityBadge} ${styles[priority.className]}`}
              >
                {priority.label}
              </span>
            </div>
            <div className={styles.detailRow}>
              <p>Status</p>
              <span>{status.label}</span>
            </div>
            {ticket.resolvedLabel && (
              <div className={styles.detailRow}>
                <p>{ticket.status === "closed" ? "Closed" : "Resolved"}</p>
                <span>{ticket.resolvedLabel}</span>
              </div>
            )}
          </div>

          {/* ── Section 4: Linked transaction (trace back to cash flow) ── */}
          {ticket.transactionId && (
            <Link
              href={`/transaction/${ticket.transactionId}`}
              className={styles.txLink}
            >
              View linked transaction
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                width={16}
                height={16}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                />
              </svg>
            </Link>
          )}
        </section>
      </main>

      <NavBar />
    </>
  );
}
