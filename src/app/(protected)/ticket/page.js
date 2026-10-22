import styles from "./ticket.module.css";
import NavBar from "@/components/layout/NavBar";
import Link from "next/link";

const tickets = [
  {
    id: 1,
    title: "Title 1",
    date: "Date 1",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce imperdiet gravida mauris vel commodo. Mauris cursus ipsum neque, sed fringilla lacus placerat sit amet. Donec eu tellus viverra, luctus ligula consequat, convallis leo.",
  },
  {
    id: 2,
    title: "Title 2",
    date: "Date 2",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce imperdiet gravida mauris vel commodo. Mauris cursus ipsum neque, sed fringilla lacus placerat sit amet. Donec eu tellus viverra, luctus ligula consequat, convallis leo.",
  },
];

export default function TicketPage() {
  return (
    <>
      <main className={styles.ticketPage}>

        {/* ── Section 1: Top Header ── */}
        <section className={styles.topWrapper}>
          <div className={styles.topAction}>
            <button aria-label="Back">
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
            </button>
            <h1>Tickets</h1>
          </div>
        </section>

        {/* ── Section 2: Ticket List ── */}
        <section className={styles.ticketSection}>
          <div className={styles.ticketList}>
            {tickets.map((ticket) => (
              <div className={styles.ticketCard} key={ticket.id}>
                <div className={styles.ticketRow}>
                  <h2>{ticket.title}</h2>
                  <span>{ticket.date}</span>
                  <button aria-label="More options">
                    <svg
                      className={styles.ticketMoreLogo}
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
                      />
                    </svg>
                  </button>
                </div>
                <p>{ticket.description}</p>
                <Link className={styles.viewButton} href={`/ticket/${ticket.id}`}>
                  View details
                </Link>
              </div>
            ))}
          </div>
        </section>

      </main>

      <NavBar />
    </>
  );
}