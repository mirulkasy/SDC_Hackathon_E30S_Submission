"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CustomInput from "@/components/input/CustomInput";
import Image from "next/image";
import styles from "./welcome.module.css";
import { useAuth } from "@/context/AuthContext";
import { joinOrganization } from "@/lib/onboarding";

const JOIN_ERRORS = {
  INVALID_CODE: "That code doesn't exist. Check it and try again.",
  CODE_EXPIRED: "This code is no longer active. Ask your admin for a new one.",
  "permission-denied": "You can't join with this code.",
};

export default function WelcomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (joining) return;
    if (!code.trim()) {
      setError("Enter your organization code.");
      return;
    }
    setError("");
    setJoining(true);
    try {
      await joinOrganization({ user, code });
      router.push("/home"); // joined an existing team: nothing left to set up
    } catch (err) {
      console.error(err);
      setError(
        JOIN_ERRORS[err.message] ??
          JOIN_ERRORS[err.code] ??
          "Something went wrong. Please try again.",
      );
      setJoining(false);
    }
  };

  return (
    <main className={styles.welcomePage}>
      <Image
        className={styles.welcomeLogo}
        src="/assets/biscoach/welcome.png"
        alt="Biscoach"
        width={220}
        height={80}
      />
      <section className={styles.organizationWrapper}>
        <h1>
          Belong to a team already?
          <br />
          Join Your Teammates
        </h1>
        <form className={styles.organizationForm} onSubmit={handleJoin}>
          <CustomInput
            label={"Organization Code"}
            name="orgCode"
            autoComplete="off"
            autoCapitalize="characters"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            error={error}
          />
          <p>
            Ask your company admin for a code to join your team's workspace!
          </p>

          <button type="submit" className={styles.joinBtn} disabled={joining}>
            {joining ? "Joining..." : "Join"}
          </button>
        </form>
      </section>

      <button
        type="button"
        className={styles.skipBtn}
        onClick={() => router.push("/onboarding/organization")}
      >
        Skip
      </button>

      <Image
        className={styles.biscoach}
        src="/assets/biscoach/bench.png"
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
