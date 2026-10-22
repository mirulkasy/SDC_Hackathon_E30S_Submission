"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { BUSINESS_TYPES } from "@/lib/businessTypes";
import { updateOrganization, updateUserName } from "@/lib/profile";
import NavBar from "@/components/layout/NavBar";
import styles from "./profile.module.css";
import AppBar from "@/components/layout/AppBar";

export default function ProfilePage() {
  const { user, profile } = useAuth();
  const [org, setOrg] = useState(null);
  const [copied, setCopied] = useState(false);

  // null = untouched, so the field always shows the latest saved value
  const [nameDraft, setNameDraft] = useState(null);
  const [orgDraft, setOrgDraft] = useState(null);
  const [savingName, setSavingName] = useState(false);
  const [savingOrg, setSavingOrg] = useState(false);
  const [nameError, setNameError] = useState("");
  const [orgError, setOrgError] = useState("");

  const orgId = profile?.orgId;
  const isOwner = profile?.role === "owner";

  useEffect(() => {
    if (!orgId) return;
    return onSnapshot(
      doc(db, "organizations", orgId),
      (snap) => setOrg(snap.exists() ? snap.data() : null),
      (err) => console.error("Organization listener failed:", err),
    );
  }, [orgId]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const nameValue = nameDraft ?? profile?.name ?? "";
  const nameDirty =
    nameDraft !== null && nameDraft.trim() !== (profile?.name ?? "");

  const orgNameValue = orgDraft?.name ?? org?.name ?? "";
  const businessTypeValue = orgDraft?.businessType ?? org?.businessType ?? "";
  const orgDirty =
    orgDraft !== null &&
    (orgNameValue.trim() !== (org?.name ?? "") ||
      businessTypeValue !== (org?.businessType ?? ""));

  const typeLabel =
    BUSINESS_TYPES.find((t) => t.id === org?.businessType)?.label ?? "-";

  const editOrg = (patch) =>
    setOrgDraft((d) => ({
      name: orgNameValue,
      businessType: businessTypeValue,
      ...d,
      ...patch,
    }));

  const handleCopy = async () => {
    if (!org?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(org.inviteCode);
      setCopied(true);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const handleSaveName = async (e) => {
    e.preventDefault();
    if (!nameValue.trim()) return setNameError("Name is required.");
    setNameError("");
    setSavingName(true);
    try {
      await updateUserName({ user, orgId, name: nameValue.trim() });
      setNameDraft(null);
    } catch (err) {
      console.error(err);
      setNameError("Couldn’t save your name. Please try again.");
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveOrg = async (e) => {
    e.preventDefault();
    if (!orgNameValue.trim())
      return setOrgError("Organization name is required.");
    if (!businessTypeValue) return setOrgError("Pick a business type.");
    setOrgError("");
    setSavingOrg(true);
    try {
      await updateOrganization({
        orgId,
        name: orgNameValue.trim(),
        businessType: businessTypeValue,
      });
      setOrgDraft(null);
    } catch (err) {
      console.error(err);
      setOrgError("Couldn’t save the organization. Please try again.");
    } finally {
      setSavingOrg(false);
    }
  };

  const initial = (profile?.name ?? "?").trim().charAt(0).toUpperCase();

  return (
    <>
      <AppBar title="Profile" />
      <main className={styles.profilePage}>
        {/* ── Section 1: Organization code banner ── */}
        <section className={styles.codeWrapper}>
          <div className={styles.codeBanner}>
            <div className={styles.codeInfo}>
              <h1>Organization Code</h1>
              <p>
                {isOwner
                  ? "Share the organization code above so your team can join."
                  : "Only the owner can edit organization details."}
              </p>
              <h2>{org?.inviteCode ?? "--------"}</h2>
            </div>
            <button
              type="button"
              className={styles.copyBtn}
              onClick={handleCopy}
              disabled={!org?.inviteCode}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </section>

        {/* ── Section 3: Account ── */}
        <form className={styles.section} onSubmit={handleSaveName}>
          <h2 className={styles.sectionTitle}>Account</h2>
          <div className={styles.card}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Name</span>
              <input
                className={styles.fieldInput}
                name="name"
                autoComplete="name"
                value={nameValue}
                onChange={(e) => setNameDraft(e.target.value)}
              />
            </label>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Email</span>
              <p className={`${styles.fieldText} ${styles.emailText}`}>
                {profile?.email ?? user?.email}
              </p>
            </div>
          </div>
          <p
            className={styles.errorText}
            role={nameError ? "alert" : undefined}
          >
            {nameError}
          </p>
          {nameDirty && (
            <button
              type="submit"
              className={styles.saveBtn}
              disabled={savingName}
            >
              {savingName ? "Saving..." : "Save"}
            </button>
          )}
        </form>

        {/* ── Section 4: Organization ── */}
        <form className={styles.section} onSubmit={handleSaveOrg}>
          <h2 className={styles.sectionTitle}>Organization</h2>
          <div className={styles.card}>
            {isOwner ? (
              <>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Organization Name</span>
                  <input
                    className={styles.fieldInput}
                    name="orgName"
                    autoComplete="organization"
                    value={orgNameValue}
                    onChange={(e) => editOrg({ name: e.target.value })}
                  />
                </label>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Business Type</span>
                  <div className={styles.typeWrapper}>
                    {BUSINESS_TYPES.map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        aria-pressed={businessTypeValue === type.id}
                        className={`${styles.typeBtn} ${
                          businessTypeValue === type.id
                            ? styles.typeBtnActive
                            : ""
                        }`}
                        onClick={() => editOrg({ businessType: type.id })}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Organization Name</span>
                  <p className={styles.fieldText}>{org?.name ?? "-"}</p>
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Business Type</span>
                  <p className={styles.fieldText}>{typeLabel}</p>
                </div>
              </>
            )}
          </div>
          <p className={styles.errorText} role={orgError ? "alert" : undefined}>
            {orgError}
          </p>
          {isOwner && orgDirty && (
            <button
              type="submit"
              className={styles.saveBtn}
              disabled={savingOrg}
            >
              {savingOrg ? "Saving..." : "Save"}
            </button>
          )}
        </form>

        {/* ── Section 5: Log out ── */}
        <section className={styles.section}>
          <button
            type="button"
            className={styles.logoutBtn}
            onClick={() => signOut(auth)}
          >
            <svg
              className={styles.logoutLogo}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
              />
            </svg>
            Log Out
          </button>
        </section>
      </main>

      <NavBar />
    </>
  );
}
