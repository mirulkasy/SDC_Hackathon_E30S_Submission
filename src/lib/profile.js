import { updateProfile } from "firebase/auth";
import {
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

/** Change the signed-in user's name everywhere it is stored. */
export async function updateUserName({ user, orgId, name }) {
  await updateProfile(user, { displayName: name });

  const batch = writeBatch(db);
  batch.update(doc(db, "users", user.uid), {
    name,
    updatedAt: serverTimestamp(),
  });
  if (orgId) {
    batch.update(doc(db, "organizations", orgId, "members", user.uid), {
      name,
    });
  }
  await batch.commit();
}

/** Owner only: change the organization's name and business type. */
export async function updateOrganization({ orgId, name, businessType }) {
  await updateDoc(doc(db, "organizations", orgId), {
    name,
    businessType,
    updatedAt: serverTimestamp(),
  });
}

/** Tick or untick one checklist item for the organization. */
export async function setChecklistItem({ orgId, itemId, user, done }) {
  await setDoc(doc(db, "organizations", orgId, "checklist", itemId), {
    done,
    updatedBy: user.uid,
    updatedAt: serverTimestamp(),
  });
}
