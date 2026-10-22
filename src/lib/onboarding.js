import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "./firebase";

// No 0/O/1/I so codes are easy to read out loud
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateInviteCode(length = 8) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

/** Step 1 (/onboarding): Auth account + users/{uid} profile doc. */
export async function registerUser({ name, email, password }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });

  await setDoc(doc(db, "users", cred.user.uid), {
    name,
    email: email.toLowerCase(),
    photoUrl: null,
    orgId: null,
    role: null,
    onboardingCompleted: false,
    language: "en",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  });
  return cred.user;
}

/** Step 2a (/onboarding/welcome): join an existing org with an invite code. */
export async function joinOrganization({ user, code }) {
  const cleanCode = code.trim().toUpperCase();
  const codeSnap = await getDoc(doc(db, "orgCodes", cleanCode));
  if (!codeSnap.exists()) throw new Error("INVALID_CODE");

  const { orgId, active, expiresAt } = codeSnap.data();
  if (!active || (expiresAt && expiresAt.toMillis() < Date.now())) {
    throw new Error("CODE_EXPIRED");
  }

  const batch = writeBatch(db);
  batch.set(doc(db, "organizations", orgId, "members", user.uid), {
    role: "staff",
    name: user.displayName ?? "",
    email: user.email,
    joinedAt: serverTimestamp(),
    invitedVia: cleanCode,
    status: "active",
  });
  batch.update(doc(db, "users", user.uid), {
    orgId,
    role: "staff",
    onboardingCompleted: true,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return orgId;
}

/** Step 2b/3 (/organization + /sales): create the org. One atomic batch. */
export async function createOrganization({
  user,
  name,
  businessType,
  monthlySalesRM,
}) {
  const orgRef = doc(collection(db, "organizations"));
  const inviteCode = generateInviteCode();

  const batch = writeBatch(db);
  batch.set(orgRef, {
    name,
    ownerUid: user.uid,
    businessType,
    avgMonthlySales: Math.round(monthlySalesRM * 100), // integer sen
    settings: {
      currency: "MYR",
      timezone: "Asia/Kuala_Lumpur",
      lowStockThreshold: 5,
      expiryAlertDays: 7,
    },
    memberCount: 1,
    inviteCode,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, "organizations", orgRef.id, "members", user.uid), {
    role: "owner",
    name: user.displayName ?? "",
    email: user.email,
    joinedAt: serverTimestamp(),
    invitedVia: null,
    status: "active",
  });
  batch.set(doc(db, "orgCodes", inviteCode), {
    orgId: orgRef.id,
    createdBy: user.uid,
    active: true,
    expiresAt: null,
    defaultRole: "staff",
    uses: 0,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, "users", user.uid), {
    orgId: orgRef.id,
    role: "owner",
    onboardingCompleted: true,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return orgRef.id;
}
