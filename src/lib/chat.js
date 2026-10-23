import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

/* ------------------------------------------------------------------ */
/* organizations/{orgId}/chats/{chatId}                                */
/*   uid, title, summary, summarizedUpTo (ts), lastPreview,            */
/*   createdAt, updatedAt   (all times are plain ms numbers)           */
/* organizations/{orgId}/chats/{chatId}/messages/{msgId}               */
/*   role "user"|"assistant", text, ts, attachments, actions, choices  */
/*                                                                     */
/* "summary" + "summarizedUpTo" are the saved context: the AI gets the */
/* summary plus only the messages newer than summarizedUpTo.           */
/* ------------------------------------------------------------------ */

const chatsCol = (orgId) => {
  if (!orgId || typeof orgId !== "string")
    throw new Error(`chatsCol: invalid orgId "${orgId}"`);
  return collection(db, "organizations", orgId, "chats");
};
const chatRef = (orgId, chatId) => {
  if (!orgId || typeof orgId !== "string")
    throw new Error(`chatRef: invalid orgId "${orgId}"`);
  if (!chatId || typeof chatId !== "string")
    throw new Error(`chatRef: invalid chatId "${chatId}"`);
  return doc(db, "organizations", orgId, "chats", chatId);
};
const msgsCol = (orgId, chatId) => {
  if (!orgId || typeof orgId !== "string")
    throw new Error(`msgsCol: invalid orgId "${orgId}"`);
  if (!chatId || typeof chatId !== "string")
    throw new Error(`msgsCol: invalid chatId "${chatId}"`);
  return collection(db, "organizations", orgId, "chats", chatId, "messages");
};

// Firestore rejects `undefined`
const clean = (v) => JSON.parse(JSON.stringify(v));
const log = (what) => (err) => console.error(`${what} failed:`, err);

/** Live list of this user's chats, newest first. */
export function subscribeChats(orgId, uid, callback) {
  return onSnapshot(
    query(chatsCol(orgId), where("uid", "==", uid)),
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .slice(0, 60);
      callback(items);
    },
    log("Chats listener"),
  );
}

/** Live messages of one chat, oldest first. */
export function subscribeMessages(orgId, chatId, callback) {
  return onSnapshot(
    query(msgsCol(orgId, chatId), orderBy("ts")),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    log("Messages listener"),
  );
}

/** Creates a chat and returns its id right away (the write finishes in the background). */
export async function createChat({ orgId, uid, title }) {
  const ref = doc(chatsCol(orgId));
  const now = Date.now();
  await setDoc(ref, {
    uid,
    title,
    summary: "",
    summarizedUpTo: 0,
    lastPreview: "",
    createdAt: now,
    updatedAt: now,
  });
  return ref.id; // ← make sure this line exists
}

/** Adds a message and returns its id right away. */
export function addMessage(orgId, chatId, message, uid) {
  const ref = doc(msgsCol(orgId, chatId));
  setDoc(ref, clean({ ...message, uid })).catch(log("Add message"));
  return ref.id;
}

export function updateMessage(orgId, chatId, messageId, patch) {
  return updateDoc(
    doc(db, "organizations", orgId, "chats", chatId, "messages", messageId),
    clean(patch),
  ).catch(log("Update message"));
}

export function patchChat(orgId, chatId, patch) {
  return updateDoc(chatRef(orgId, chatId), clean(patch)).catch(
    log("Update chat"),
  );
}

/** Deletes the messages first, then the chat itself. */
export async function removeChat(orgId, chatId) {
  const snap = await getDocs(msgsCol(orgId, chatId));
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(chatRef(orgId, chatId));
}
