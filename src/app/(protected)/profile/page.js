"use client";

import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { collection, doc, onSnapshot } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { BUSINESS_TYPES } from "@/lib/businessTypes";
import { updateOrganization, updateUserName } from "@/lib/profile";
import NavBar from "@/components/layout/NavBar";
import AppBar from "@/components/layout/AppBar";
import styles from "./profile.module.css";

export default function ProfilePage() {
  const { user, profile } = useAuth();

  const [activeTab, setActiveTab] = useState("profile");
  const [org, setOrg] = useState(null);
  const [members, setMembers] = useState([]);
  const [copied, setCopied] = useState(false);

  const [nameDraft, setNameDraft] = useState(null);
  const [orgDraft, setOrgDraft] = useState(null);

  const [savingName, setSavingName] = useState(false);
  const [savingOrg, setSavingOrg] = useState(false);

  const [nameError, setNameError] = useState("");
  const [orgError, setOrgError] = useState("");

  const orgId = profile?.orgId;
  const isOwner = profile?.role === "owner";

  // Listen to organization details.
  useEffect(() => {
    if (!orgId) {
      setOrg(null);
      return;
    }

    return onSnapshot(
      doc(db, "organizations", orgId),
      (snap) => setOrg(snap.exists() ? snap.data() : null),
      (err) => console.error("Organization listener failed:", err),
    );
  }, [orgId]);

  // Listen to every member in the organization.
  useEffect(() => {
    if (!orgId) {
      setMembers([]);
      return;
    }

    return onSnapshot(
      collection(db, "organizations", orgId, "members"),
      (snap) => {
        const list = snap.docs.map((memberDoc) => ({
          id: memberDoc.id,
          ...memberDoc.data(),
        }));

        // Show the owner first, then sort other members by name.
        list.sort((a, b) => {
          if (a.role === "owner") return -1;
          if (b.role === "owner") return 1;

          return (a.name || a.email || "").localeCompare(
            b.name || b.email || "",
          );
        });

        setMembers(list);
      },
      (err) => console.error("Members listener failed:", err),
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
    BUSINESS_TYPES.find((type) => type.id === org?.businessType)?.label ?? "-";

  const editOrg = (patch) => {
    if (!isOwner) return;

    setOrgDraft((draft) => ({
      name: orgNameValue,
      businessType: businessTypeValue,
      ...draft,
      ...patch,
    }));
  };

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

    if (!nameValue.trim()) {
      setNameError("Name is required.");
      return;
    }

    setNameError("");
    setSavingName(true);

    try {
      await updateUserName({
        user,
        orgId,
        name: nameValue.trim(),
      });

      setNameDraft(null);
    } catch (err) {
      console.error(err);
      setNameError("Could not save your name. Please try again.");
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveOrg = async (e) => {
    e.preventDefault();

    // Do not allow non-owners to save organization details.
    if (!isOwner) return;

    if (!orgNameValue.trim()) {
      setOrgError("Organization name is required.");
      return;
    }

    if (!businessTypeValue) {
      setOrgError("Pick a business type.");
      return;
    }

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
      setOrgError("Could not save the organization. Please try again.");
    } finally {
      setSavingOrg(false);
    }
  };

  return (
    <>
      <AppBar title="Profile" />

      <main className={styles.profilePage}>
        {/* Tabs */}
        <div className={styles.tabs} role="tablist" aria-label="Settings">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "profile"}
            className={`${styles.tab} ${
              activeTab === "profile" ? styles.activeTab : ""
            }`}
            onClick={() => setActiveTab("profile")}
          >
            Profile
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "organization"}
            className={`${styles.tab} ${
              activeTab === "organization" ? styles.activeTab : ""
            }`}
            onClick={() => setActiveTab("organization")}
          >
            Organization
          </button>
        </div>

        {/* PROFILE TAB */}
        {activeTab === "profile" && (
          <>
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
                    {profile?.email ?? user?.email ?? "-"}
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
          </>
        )}

        {/* ORGANIZATION TAB */}
        {activeTab === "organization" && (
          <>
            {!orgId ? (
              <section className={styles.section}>
                <div className={styles.card}>
                  <p className={styles.emptyText}>
                    You are not part of an organization yet.
                  </p>
                </div>
              </section>
            ) : (
              <>
                {/* Organization code banner moved here */}
                <section className={styles.codeWrapper}>
                  <div className={styles.codeBanner}>
                    <div className={styles.codeInfo}>
                      <h1>Organization Code</h1>
                      <p>
                        Share this code with people you want to invite to your
                        organization.
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

                {/* Organization details */}
                <form className={styles.section} onSubmit={handleSaveOrg}>
                  <h2 className={styles.sectionTitle}>Organization Details</h2>

                  <div className={styles.card}>
                    {isOwner ? (
                      <>
                        <label className={styles.field}>
                          <span className={styles.fieldLabel}>
                            Organization Name
                          </span>

                          <input
                            className={styles.fieldInput}
                            name="orgName"
                            autoComplete="organization"
                            value={orgNameValue}
                            onChange={(e) => editOrg({ name: e.target.value })}
                          />
                        </label>

                        <div className={styles.field}>
                          <span className={styles.fieldLabel}>
                            Business Type
                          </span>

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
                                onClick={() =>
                                  editOrg({ businessType: type.id })
                                }
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
                          <span className={styles.fieldLabel}>
                            Organization Name
                          </span>
                          <p className={styles.fieldText}>{org?.name ?? "-"}</p>
                        </div>

                        <div className={styles.field}>
                          <span className={styles.fieldLabel}>
                            Business Type
                          </span>
                          <p className={styles.fieldText}>{typeLabel}</p>
                        </div>
                      </>
                    )}
                  </div>

                  <p
                    className={styles.errorText}
                    role={orgError ? "alert" : undefined}
                  >
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

                {/* All organization members */}
                <section className={styles.section}>
                  <div className={styles.memberHeading}>
                    <h2 className={styles.sectionTitle}>Members</h2>
                    <span className={styles.memberCount}>{members.length}</span>
                  </div>

                  <div className={styles.card}>
                    {members.length === 0 ? (
                      <p className={styles.emptyText}>
                        Loading members or no members found.
                      </p>
                    ) : (
                      members.map((member) => (
                        <div key={member.id} className={styles.memberRow}>
                          <div className={styles.memberAvatar}>
                            {(member.name || member.email || "?")
                              .trim()
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div className={styles.memberInfo}>
                            <p className={styles.memberName}>
                              {member.name || "Unnamed member"}
                              {member.id === user?.uid && (
                                <span className={styles.youLabel}>You</span>
                              )}
                            </p>

                            <p className={styles.memberEmail}>
                              {member.email || "No email"}
                            </p>
                          </div>

                          <span
                            className={`${styles.roleBadge} ${
                              member.role === "owner" ? styles.ownerBadge : ""
                            }`}
                          >
                            {member.role === "owner" ? "Owner" : "Staff"}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  <p className={styles.hint}>
                    Only the organization owner can edit organization details.
                  </p>
                </section>
              </>
            )}
          </>
        )}
      </main>

      <NavBar />
    </>
  );
}
