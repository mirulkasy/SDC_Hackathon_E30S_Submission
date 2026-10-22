"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CustomInput from "@/components/input/CustomInput";
import Image from "next/image";
import styles from "./organization.module.css";
import { BUSINESS_TYPES } from "@/lib/businessTypes";
import { useOnboarding } from "@/context/OnboardingContext";

export default function OrganizationPage() {
  const router = useRouter();
  const { draft, setDraft } = useOnboarding();
  const [error, setError] = useState("");

  const handleNext = () => {
    if (!draft.orgName.trim()) return setError("Organization name is required.");
    if (!draft.businessType) return setError("Pick the type that fits you best.");
    setError("");
    router.push("/onboarding/organization/sales");
  };

  return (
    <main className={styles.organizationPage}>
      <Image
        className={styles.organizationLogo}
        src="/assets/biscoach/logo.png"
        alt="Biscoach"
        width={200}
        height={60}
      />
      <section className={styles.organizationWrapper}>
        <h1>
          Create Your
          <br />
          Team’s Workspace
        </h1>
        <form
          className={styles.organizationForm}
          onSubmit={(e) => {
            e.preventDefault();
            handleNext();
          }}
        >
          <CustomInput
            label={"Organization Name"}
            name="orgName"
            autoComplete="organization"
            value={draft.orgName}
            onChange={(e) =>
              setDraft((d) => ({ ...d, orgName: e.target.value }))
            }
            error={error}
          />
          <p>
            Tell us a little about what you do so we can personalize your
            workspace
          </p>

          <div className={styles.typeWrapper}>
            {BUSINESS_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                aria-pressed={draft.businessType === type.id}
                className={`${styles.typeBtn} ${
                  draft.businessType === type.id ? styles.typeBtnActive : ""
                }`}
                onClick={() =>
                  setDraft((d) => ({ ...d, businessType: type.id }))
                }
              >
                {type.label}
              </button>
            ))}
          </div>
        </form>
      </section>

      <button type="button" className={styles.nextBtn} onClick={handleNext}>
        Next
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
