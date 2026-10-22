import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

/* ------------------------------------------------------------------ */
/* Products live at organizations/{orgId}/products                     */
/* Money is integer sen, same as transactions: RM 12.50 = 1250         */
/* ------------------------------------------------------------------ */

export const LOW_STOCK_THRESHOLD = 5;
export const PRODUCT_CATEGORIES = ["Food", "Drinks", "Household"];

export function senToRM(sen) {
  return (sen ?? 0) / 100;
}

export function mapProduct(id, data) {
  return {
    id,
    name: data.name ?? "-",
    stock: data.stock ?? 0,
    category: data.category ?? "Other",
    cost: senToRM(data.cost),
    price: senToRM(data.price),
    dueDate: data.dueDate ?? "", // "YYYY-MM-DD", only used for Food
    barcode: data.barcode ?? "",
    imageUrl: data.imageUrl ?? null,
  };
}

function isVisible(data) {
  return !data.deletedAt;
}

/** Live product list, alphabetical. */
export function subscribeProducts(orgId, callback) {
  const q = query(
    collection(db, "organizations", orgId, "products"),
    orderBy("name"),
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = [];
      snap.forEach((d) => {
        const data = d.data();
        if (!isVisible(data)) return;
        items.push(mapProduct(d.id, data));
      });
      callback(items);
    },
    (err) => console.error("Products listener failed:", err),
  );
}

/** One-time read of a single product (detail page). */
export async function getProduct(orgId, productId) {
  const snap = await getDoc(
    doc(db, "organizations", orgId, "products", productId),
  );
  if (!snap.exists()) return null;
  const data = snap.data();
  if (!isVisible(data)) return null;
  return mapProduct(snap.id, data);
}

/** Add a new product. cost/price arrive in RM and are stored as sen. */
export async function addProduct({ orgId, user, product }) {
  await addDoc(collection(db, "organizations", orgId, "products"), {
    name: product.name.trim(),
    stock: Number(product.stock),
    category: product.category,
    cost: Math.round(product.cost * 100),
    price: Math.round(product.price * 100),
    dueDate: product.category === "Food" ? product.dueDate : null,
    barcode: product.barcode?.trim() ?? "",
    imageUrl: product.imageUrl ?? null,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Save edited fields on an existing product. */
export async function updateProduct({ orgId, productId, product }) {
  await updateDoc(doc(db, "organizations", orgId, "products", productId), {
    name: product.name.trim(),
    stock: Number(product.stock),
    category: product.category,
    cost: Math.round(product.cost * 100),
    price: Math.round(product.price * 100),
    dueDate: product.category === "Food" ? product.dueDate : null,
    barcode: product.barcode?.trim() ?? "",
    updatedAt: serverTimestamp(),
  });
}

/** Soft delete: hidden from all queries, recoverable in Firestore. */
export async function deleteProduct({ orgId, productId }) {
  await updateDoc(doc(db, "organizations", orgId, "products", productId), {
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Find a product by barcode. Returns null if none is linked. */
export async function findProductByBarcode(orgId, barcode) {
  const snap = await getDocs(
    query(
      collection(db, "organizations", orgId, "products"),
      where("barcode", "==", barcode.trim()),
    ),
  );
  // Skip soft-deleted products
  const match = snap.docs.find((d) => isVisible(d.data()));
  return match ? mapProduct(match.id, match.data()) : null;
}
