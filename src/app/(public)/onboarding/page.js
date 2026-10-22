"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CustomInput from "@/components/input/CustomInput";
import Image from "next/image";
import Link from "next/link";
import styles from "./onboarding.module.css";
import { registerUser } from "@/lib/onboarding";

const AUTH_ERRORS = {
  "auth/email-already-in-use": {
    field: "email",
    msg: "This email is already registered.",
  },
  "auth/invalid-email": { field: "email", msg: "Enter a valid email address." },
  "auth/weak-password": {
    field: "password",
    msg: "Password must be at least 6 characters.",
  },
  "auth/network-request-failed": {
    field: "form",
    msg: "Network error. Check your connection.",
  },
};

export default function OnboardingPage() {
  const router = useRouter();
  const [values, setValues] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const onChange = (e) =>
    setValues((v) => ({ ...v, [e.target.name]: e.target.value }));

  const validate = () => {
    const next = {};
    if (!values.name.trim()) next.name = "Name is required.";
    if (!/^\S+@\S+\.\S+$/.test(values.email))
      next.email = "Enter a valid email address.";
    if (values.password.length < 6)
      next.password = "Use at least 6 characters.";
    if (values.confirmPassword !== values.password)
      next.confirmPassword = "Passwords do not match.";
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
      await registerUser({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
      });
      router.push("/onboarding/welcome");
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

  return (
    <main className={styles.onboardingPage}>
      <section className={styles.header}>
        <Image
          src="/assets/biscoach/logo.png"
          alt="Biscoach"
          width={200}
          height={60}
        />
      </section>
      <form className={styles.formWrapper} onSubmit={handleSubmit} noValidate>
        <CustomInput
          label={"Name"}
          name="name"
          autoComplete="name"
          value={values.name}
          onChange={onChange}
          error={errors.name}
        />
        <CustomInput
          label={"Email"}
          name="email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={onChange}
          error={errors.email}
        />
        <CustomInput
          label={"Password"}
          name="password"
          isPassword
          autoComplete="new-password"
          value={values.password}
          onChange={onChange}
          error={errors.password}
        />
        <CustomInput
          label={"Confirm Password"}
          name="confirmPassword"
          isPassword
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={onChange}
          error={errors.confirmPassword || errors.form}
        />
        <button
          type="submit"
          className={styles.continueBtn}
          disabled={submitting}
        >
          {submitting ? "Creating account..." : "Register"}
        </button>
      </form>
      <p className={styles.switchText}>
        Already have an account? <Link href="/login">Log in</Link>
      </p>
      <Image
        className={styles.biscoachImg}
        src="/assets/biscoach/onboarding.png"
        alt="Biscoach"
        width={200}
        height={200}
      />
    </main>
  );
}
