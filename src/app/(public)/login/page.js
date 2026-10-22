"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import CustomInput from "@/components/input/CustomInput";
import { useAuth } from "@/context/AuthContext";
import { loginUser } from "@/lib/auth";
import styles from "./login.module.css";

const BAD_CREDENTIALS = { field: "password", msg: "Incorrect email or password." };

// Firebase now answers "auth/invalid-credential" for both a wrong password
// and an unknown email (email enumeration protection), the other two codes
// are kept for older projects.
const AUTH_ERRORS = {
  "auth/invalid-credential": BAD_CREDENTIALS,
  "auth/wrong-password": BAD_CREDENTIALS,
  "auth/user-not-found": BAD_CREDENTIALS,
  "auth/invalid-email": { field: "email", msg: "Enter a valid email address." },
  "auth/user-disabled": { field: "form", msg: "This account has been disabled." },
  "auth/too-many-requests": {
    field: "form",
    msg: "Too many attempts. Try again in a few minutes.",
  },
  "auth/network-request-failed": {
    field: "form",
    msg: "Network error. Check your connection.",
  },
};

export default function LoginPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Already signed in (or just signed in): send them where they belong.
  useEffect(() => {
    if (loading || !user) return;
    router.replace(profile?.orgId ? "/home" : "/onboarding/welcome");
  }, [loading, user, profile, router]);

  const onChange = (e) =>
    setValues((v) => ({ ...v, [e.target.name]: e.target.value }));

  const validate = () => {
    const next = {};
    if (!/^\S+@\S+\.\S+$/.test(values.email.trim()))
      next.email = "Enter a valid email address.";
    if (!values.password) next.password = "Password is required.";
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      await loginUser({
        email: values.email.trim(),
        password: values.password,
      });
      // No router.push here: the effect above redirects once AuthContext
      // has loaded the profile, so we know whether to go to /home or onboarding.
    } catch (err) {
      console.error(err);
      const known = AUTH_ERRORS[err.code];
      setErrors({
        [known?.field ?? "form"]:
          known?.msg ?? "Something went wrong. Please try again.",
      });
      setSubmitting(false);
    }
  };

  // Avoid flashing the form for someone who is about to be redirected
  if (loading || user) return null;

  return (
    <main className={styles.loginPage}>
      <section className={styles.header}>
        <Image
          src="/assets/biscoach/logo.png"
          alt="Biscoach"
          width={200}
          height={60}
        />
      </section>

      <h1 className={styles.title}>Welcome back</h1>

      <form className={styles.formWrapper} onSubmit={handleSubmit} noValidate>
        <CustomInput
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={onChange}
          error={errors.email}
        />
        <CustomInput
          label="Password"
          name="password"
          isPassword
          autoComplete="current-password"
          value={values.password}
          onChange={onChange}
          error={errors.password || errors.form}
        />
        <button type="submit" className={styles.loginBtn} disabled={submitting}>
          {submitting ? "Logging in..." : "Log in"}
        </button>
      </form>

      <p className={styles.switchText}>
        New here? <Link href="/onboarding">Create an account</Link>
      </p>

      <Image
        className={styles.biscoachImg}
        src="/assets/biscoach/onboarding.png"
        alt=""
        width={200}
        height={200}
      />
    </main>
  );
}