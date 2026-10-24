import Image from "next/image";
import styles from "./SplashScreen.module.css";

export default function SplashScreen() {
  return (
    <main className={styles.splash}>
      <div className={styles.center}>
        <Image
          className={styles.mascot}
          src="/assets/biscoach/think.png"
          alt="Biscoach"
          width={220}
          height={220}
          priority
        />
      </div>

      <div className={styles.bottom}>
        <Image
          src="/assets/biscoach/logo.png"
          alt="Biscoach"
          width={150}
          height={45}
          priority
        />
        <p>Your smart business assistant</p>
      </div>
    </main>
  );
}