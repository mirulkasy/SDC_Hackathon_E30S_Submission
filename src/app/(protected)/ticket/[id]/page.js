import styles from "./subTicket.module.css";
import Link from "next/link";
import NavBar from "@/components/layout/NavBar";
 
const ticket = {
  title: "Ticket Title",
  issuedAt: "2026-10-22T09:30:00",
  issuedLabel: "22 Oct 2026, 9:30 AM",
  description:
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce imperdiet gravida mauris vel commodo. Mauris cursus ipsum neque, sed fringilla lacus placerat sit amet. Donec eu tellus viverra, luctus ligula consequat, convallis leo.",
};
 
export default function SubTicketPage() {
  return (
    <>
      <main className={styles.subTicketPage}>
 
        {/* ── Section 1: Top Header ── */}
        <section className={styles.topWrapper}>
          <div className={styles.topAction}>
            <Link href="/ticket" aria-label="Back to tickets">
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
          <h1>{ticket.title}</h1>
          <time className={styles.topDate} dateTime={ticket.issuedAt}>
            {ticket.issuedLabel}
          </time>
        </section>
 
        {/* ── Section 2: Full Description ── */}
        <section className={styles.detailSection}>
          <div className={styles.detailCard}>
            <h2>Description</h2>
            <p>{ticket.description}</p>
          </div>
        </section>
 
      </main>
 
      <NavBar />
    </>
  );
}