"use client";

import { useEffect, useState } from "react";
import useSplashRouter from "@/lib/useSplashRouter";
import Image from "next/image";
import styles from "./sales.module.css";
import { useAuth } from "@/context/AuthContext";
import { useOnboarding } from "@/context/OnboardingContext";
import { createOrganization } from "@/lib/onboarding";

const MIN_SALES = 1000;
const MAX_SALES = 100000;
const STEP = 500;

const formatRM = (n) => `RM ${n.toLocaleString("en-MY")}`;

export default function SalesPage() {
  const router = useSplashRouter();
  const { user } = useAuth();
  const { draft } = useOnboarding();
  const [sales, setSales] = useState(10000);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Page refreshed mid-flow: the draft is gone, so go back a step
  useEffect(() => {
    if (!draft.orgName || !draft.businessType) {
      router.replace("/onboarding/organization");
    }
  }, [draft, router]);

  const handleFinish = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await createOrganization({
        user,
        name: draft.orgName.trim(),
        businessType: draft.businessType,
        monthlySalesRM: sales,
      });
      router.push("/home");
    } catch (err) {
      console.error(err);
      setError("Couldn't create your workspace. Please try again.");
      setSaving(false);
    }
  };
  const ratio = (sales - MIN_SALES) / (MAX_SALES - MIN_SALES);

  return (
    <main className={styles.salesPage}>
      <Image
        className={styles.salesLogo}
        src="/assets/biscoach/logo.png"
        alt="Biscoach"
        width={200}
        height={60}
      />
      <section className={styles.salesWrapper}>
        <h1>
          Set Your
          <br />
          Estimated Monthly Sales
        </h1>

        <p className={styles.hint}>
          Drag the slider to adjust your monthly sales.
        </p>

        <div className={styles.sliderBlock}>
          <div className={styles.sliderValue}>
            {formatRM(sales)}
            {sales === MAX_SALES ? "+" : ""}
          </div>

          <input
            type="range"
            className={styles.slider}
            min={MIN_SALES}
            max={MAX_SALES}
            step={STEP}
            value={sales}
            onChange={(e) => setSales(Number(e.target.value))}
            style={{ "--ratio": ratio }}
            aria-label="Estimated monthly sales"
          />

          <div className={styles.sliderLabels}>
            <span>{formatRM(MIN_SALES)}</span>
            <span>{formatRM(MAX_SALES)}+</span>
          </div>
        </div>
      </section>

      {error && (
        <p role="alert" style={{ color: "#ff3b30", position: "absolute", bottom: 80, right: 30, zIndex: 99 }}>
          {error}
        </p>
      )}
      <button
        type="button"
        className={styles.nextBtn}
        onClick={handleFinish}
        disabled={saving}
      >
        {saving ? "Saving..." : "Next"}
      </button>

      <Image
        className={styles.biscoach}
        src="/assets/biscoach/think.png"
        alt="Biscoach"
        width={200}
        height={200}
      />
      <Image
        className={styles.wave}
        src="/assets/texture/wave.png"
        alt="Biscoach"
        width={165}
        height={45}
      />
    </main>
  );
}
