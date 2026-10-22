import AppBar from "@/components/layout/AppBar";
import NavBar from "@/components/layout/NavBar";
import { SME_AID, AID_TYPES } from "@/lib/aid";
import styles from "./aid.module.css";

export default function AidPage() {
  return (
    <>
      <AppBar title="Financial Aid" />

      <main className={styles.aidPage}>
        <section className={styles.aidList}>
          {SME_AID.map((aid) => {
            const type = AID_TYPES[aid.type];
            return (
              <a
                key={aid.id}
                href={aid.link}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.aidCard}
              >
                <span
                  className={`${styles.typeBadge} ${styles[type.className]}`}
                >
                  {type.label}
                </span>
                <h1>{aid.title}</h1>
                <p className={styles.provider}>{aid.provider}</p>
                <p className={styles.description}>{aid.description}</p>
                <div className={styles.aidBtn}>View More</div>
              </a>
            );
          })}
        </section>
      </main>
    </>
  );
}
