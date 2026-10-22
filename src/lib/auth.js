import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

/** /login: sign in with email + password. */
export async function loginUser({ email, password }) {
  const cred = await signInWithEmailAndPassword(auth, email, password);

  // Best effort only: a failed timestamp write must never block a login.
  updateDoc(doc(db, "users", cred.user.uid), {
    lastLoginAt: serverTimestamp(),
  }).catch((err) => console.warn("lastLoginAt not updated:", err.code));

  return cred.user;
}
