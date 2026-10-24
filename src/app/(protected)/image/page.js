"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  addProduct,
  getProduct,
  subscribeProducts,
  updateProduct,
} from "@/lib/inventory";
import { addTransaction } from "@/lib/transactions";
import styles from "./image.module.css";

const MAX_FILES = 4;
const MAX_PDF_BYTES = 4 * 1024 * 1024;

const CATEGORY_OPTIONS = ["Food", "Drinks", "Household"];
const TX_CATEGORY_OPTIONS = [
  { value: "sales", label: "Sales" },
  { value: "stock_purchase", label: "Stock Purchase" },
  { value: "rent", label: "Rent" },
  { value: "utilities", label: "Utilities" },
  { value: "salary", label: "Salary" },
  { value: "marketing", label: "Marketing" },
  { value: "platform_fee", label: "Platform Fee" },
  { value: "tax", label: "Tax" },
  { value: "other", label: "Other" },
];
const PAYMENT_OPTIONS = [
  "Cash",
  "Bank Transfer",
  "Online Banking",
  "Debit Card",
  "Credit Card",
  "E-Wallet",
];

const todayISO = () => new Date().toLocaleDateString("en-CA");
const fmt = (n) =>
  Number(n || 0).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

async function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

async function fileToPayload(file) {
  if (file.type === "application/pdf") {
    if (file.size > MAX_PDF_BYTES)
      throw new Error(`${file.name} is too large (PDF limit 4MB).`);
    const dataUrl = await readAsDataURL(file);
    return {
      name: file.name,
      mimeType: "application/pdf",
      data: dataUrl.split(",")[1],
      preview: null,
    };
  }
  if (!file.type.startsWith("image/"))
    throw new Error(`${file.name}: only images and PDFs are supported.`);

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`${file.name}: could not open this image. Try JPG or PNG.`);
  }
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return {
    name: file.name,
    mimeType: "image/jpeg",
    data: dataUrl.split(",")[1],
    preview: dataUrl,
  };
}

// ── Action card editor ──────────────────────────────────────────────

function ActionCard({ action, products, onUpdate, onAllow, onDeny }) {
  const [edit, setEdit] = useState({ ...action });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const isProduct =
    edit.action_type === "add_product" || edit.action_type === "update_product";
  const isTx =
    edit.action_type === "add_transaction" ||
    edit.action_type === "update_transaction";

  const kindLabel = {
    add_product: "Add Product",
    update_product: "Update Product",
    add_transaction: "Add Transaction",
    update_transaction: "Update Transaction",
  }[edit.action_type];

  const kindColor = {
    add_product: styles.kindAdd,
    update_product: styles.kindUpdate,
    add_transaction: edit.tx_type === "in" ? styles.kindEarn : styles.kindSpend,
    update_transaction: styles.kindUpdate,
  }[edit.action_type];

  const set = (k, v) => setEdit((prev) => ({ ...prev, [k]: v }));

  async function handleAllow() {
    setBusy(true);
    setError("");
    try {
      await onAllow(edit);
      setDone(true);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <span className={`${styles.kindBadge} ${kindColor}`}>
            {kindLabel}
          </span>
          <h4 className={styles.cardTitle}>{edit.title}</h4>
        </div>
        <p className={styles.successMsg}>✓ Done.</p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <span className={`${styles.kindBadge} ${kindColor}`}>{kindLabel}</span>
        <h4 className={styles.cardTitle}>{edit.title}</h4>
      </div>
      <p className={styles.cardDesc}>{edit.description}</p>

      {/* ── Product fields ── */}
      {isProduct && (
        <div className={styles.fieldGrid}>
          <div className={styles.fieldFull}>
            <label className={styles.fieldLabel}>Product Name</label>
            <input
              className={styles.fieldInput}
              value={edit.product_name || ""}
              onChange={(e) => set("product_name", e.target.value)}
              placeholder="e.g. Milo Tin 400g"
            />
          </div>
          <div>
            <label className={styles.fieldLabel}>Category</label>
            <select
              className={styles.fieldInput}
              value={edit.product_category || ""}
              onChange={(e) => set("product_category", e.target.value)}
            >
              <option value="">Select…</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          {edit.action_type === "update_product" ? (
            <div>
              <label className={styles.fieldLabel}>Stock Change</label>
              <input
                className={styles.fieldInput}
                type="number"
                step="1"
                value={
                  edit.product_stock_change !== null &&
                  edit.product_stock_change !== undefined
                    ? edit.product_stock_change
                    : ""
                }
                onChange={(e) =>
                  set(
                    "product_stock_change",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                placeholder="e.g. +10 or -5"
              />
            </div>
          ) : (
            <div>
              <label className={styles.fieldLabel}>Starting Stock</label>
              <input
                className={styles.fieldInput}
                type="number"
                min="0"
                step="1"
                value={
                  edit.product_stock !== null &&
                  edit.product_stock !== undefined
                    ? edit.product_stock
                    : ""
                }
                onChange={(e) =>
                  set(
                    "product_stock",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                placeholder="0"
              />
            </div>
          )}
          <div>
            <label className={styles.fieldLabel}>Cost (RM)</label>
            <input
              className={styles.fieldInput}
              type="number"
              min="0"
              step="0.01"
              value={
                edit.product_cost !== null && edit.product_cost !== undefined
                  ? edit.product_cost
                  : ""
              }
              onChange={(e) =>
                set(
                  "product_cost",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              placeholder="0.00"
            />
          </div>
          <div>
            <label className={styles.fieldLabel}>Price (RM)</label>
            <input
              className={styles.fieldInput}
              type="number"
              min="0"
              step="0.01"
              value={
                edit.product_price !== null && edit.product_price !== undefined
                  ? edit.product_price
                  : ""
              }
              onChange={(e) =>
                set(
                  "product_price",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              placeholder="0.00"
            />
          </div>
          {(edit.product_category === "Food" ||
            edit.action_type === "add_product") && (
            <div>
              <label className={styles.fieldLabel}>Due Date</label>
              <input
                className={styles.fieldInput}
                type="date"
                value={edit.product_due_date || ""}
                onChange={(e) => set("product_due_date", e.target.value)}
              />
            </div>
          )}
          {edit.action_type === "update_product" && products.length > 0 && (
            <div className={styles.fieldFull}>
              <label className={styles.fieldLabel}>
                Match to existing product
              </label>
              <select
                className={styles.fieldInput}
                value={edit._matchedProductId || ""}
                onChange={(e) => {
                  const id = e.target.value;
                  const p = products.find((x) => x.id === id);
                  set("_matchedProductId", id);
                  if (p) set("product_name", p.name);
                }}
              >
                <option value="">— new product —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.stock} in stock)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* ── Transaction fields ── */}
      {isTx && (
        <div className={styles.fieldGrid}>
          <div>
            <label className={styles.fieldLabel}>Type</label>
            <select
              className={styles.fieldInput}
              value={edit.tx_type || "out"}
              onChange={(e) => set("tx_type", e.target.value)}
            >
              <option value="in">Earning (money in)</option>
              <option value="out">Spending (money out)</option>
            </select>
          </div>
          <div>
            <label className={styles.fieldLabel}>Amount (RM)</label>
            <input
              className={styles.fieldInput}
              type="number"
              min="0"
              step="0.01"
              value={
                edit.tx_amount !== null && edit.tx_amount !== undefined
                  ? edit.tx_amount
                  : ""
              }
              onChange={(e) =>
                set(
                  "tx_amount",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              placeholder="0.00"
            />
          </div>
          <div className={styles.fieldFull}>
            <label className={styles.fieldLabel}>Description</label>
            <input
              className={styles.fieldInput}
              value={edit.tx_description || ""}
              onChange={(e) => set("tx_description", e.target.value)}
              placeholder="e.g. Nasi lemak sales"
            />
          </div>
          <div>
            <label className={styles.fieldLabel}>Category</label>
            <select
              className={styles.fieldInput}
              value={edit.tx_category || "other"}
              onChange={(e) => set("tx_category", e.target.value)}
            >
              {TX_CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={styles.fieldLabel}>Date</label>
            <input
              className={styles.fieldInput}
              type="date"
              value={edit.tx_date || todayISO()}
              onChange={(e) => set("tx_date", e.target.value)}
            />
          </div>
          <div>
            <label className={styles.fieldLabel}>Payment Method</label>
            <select
              className={styles.fieldInput}
              value={edit.tx_payment_method || ""}
              onChange={(e) => set("tx_payment_method", e.target.value)}
            >
              <option value="">Select…</option>
              {PAYMENT_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.fieldFull}>
            <label className={styles.fieldLabel}>Note (optional)</label>
            <input
              className={styles.fieldInput}
              value={edit.tx_note || ""}
              onChange={(e) => set("tx_note", e.target.value)}
              placeholder="Any extra details"
            />
          </div>
        </div>
      )}

      {error && <p className={styles.errorMsg}>{error}</p>}

      <div className={styles.cardActions}>
        <button
          className={styles.allowBtn}
          onClick={handleAllow}
          disabled={busy}
        >
          {busy ? "Saving…" : "Allow"}
        </button>
        <button
          className={styles.denyBtn}
          onClick={() => onDeny(action.id)}
          disabled={busy}
        >
          Deny
        </button>
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────

export default function ImagePage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const orgId = profile?.orgId;
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [files, setFiles] = useState([]);
  const [result, setResult] = useState(null);
  const [actions, setActions] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState(null); // "files" | "camera"

  // Check if opened via NavBar option
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const src = params.get("source");
    if (src === "camera" || src === "files") {
      setSource(src);
    }
  }, []);

  // Auto-open the appropriate picker when source is set
  useEffect(() => {
    if (!source) return;
    const timer = setTimeout(() => {
      if (source === "camera") cameraInputRef.current?.click();
      else fileInputRef.current?.click();
    }, 100);
    return () => clearTimeout(timer);
  }, [source]);

  // Subscribe to products for matching
  useEffect(() => {
    if (!orgId) return;
    return subscribeProducts(orgId, setProducts);
  }, [orgId]);

  async function handleFiles(e, fromCamera = false) {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    setError("");

    const room = MAX_FILES - files.length;
    if (picked.length > room)
      setError(`You can add up to ${MAX_FILES} images.`);

    const next = [];
    for (const f of picked.slice(0, Math.max(room, 0))) {
      try {
        next.push(await fileToPayload(f));
      } catch (err) {
        setError(err.message);
      }
    }
    setFiles((prev) => [...prev, ...next]);
  }

  async function handleAnalyze() {
    if (!files.length || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    setActions([]);

    try {
      const res = await fetch("/api/image-processing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: files.map(({ mimeType, data }) => ({ mimeType, data })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Request failed.");
        return;
      }
      setResult(data);
      setActions(data.actions || []);
      setFiles([]); // clear after analysis
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAllow(edited) {
    if (!orgId || !user) throw new Error("Not signed in.");

    const type = edited.action_type;

    if (type === "add_product") {
      if (!edited.product_name?.trim())
        throw new Error("Product name is required.");
      await addProduct({
        orgId,
        user,
        product: {
          name: edited.product_name.trim(),
          category: edited.product_category || "Household",
          stock: Number(edited.product_stock) || 0,
          cost: Number(edited.product_cost) || 0,
          price: Number(edited.product_price) || 0,
          dueDate: edited.product_due_date || "",
          barcode: edited.product_barcode || "",
        },
      });
      return;
    }

    if (type === "update_product") {
      const productId = edited._matchedProductId;
      if (!productId)
        throw new Error("No product matched. Please select one from the list.");
      const current = await getProduct(orgId, productId);
      if (!current) throw new Error("Product not found.");

      const stockChange =
        edited.product_stock_change !== null &&
        edited.product_stock_change !== undefined
          ? Number(edited.product_stock_change)
          : 0;

      await updateProduct({
        orgId,
        productId,
        product: {
          name: edited.product_name || current.name,
          category: edited.product_category || current.category,
          stock: current.stock + stockChange,
          cost:
            edited.product_cost !== null && edited.product_cost !== undefined
              ? Number(edited.product_cost)
              : current.cost,
          price:
            edited.product_price !== null && edited.product_price !== undefined
              ? Number(edited.product_price)
              : current.price,
          dueDate: edited.product_due_date || current.dueDate,
          barcode: edited.product_barcode || current.barcode,
        },
      });
      return;
    }

    if (type === "add_transaction" || type === "update_transaction") {
      if (!edited.tx_amount || Number(edited.tx_amount) <= 0)
        throw new Error("A valid amount is required.");
      if (!edited.tx_description?.trim())
        throw new Error("A description is required.");
      if (!edited.tx_payment_method)
        throw new Error("Please select a payment method.");

      await addTransaction({
        orgId,
        user,
        transaction: {
          type: edited.tx_type || "out",
          amount: Number(edited.tx_amount),
          category: edited.tx_category || "other",
          description: edited.tx_description.trim(),
          date: edited.tx_date || todayISO(),
          paymentMethod: edited.tx_payment_method,
          note: edited.tx_note || "",
        },
      });
      return;
    }

    throw new Error("Unknown action type.");
  }

  function handleDeny(id) {
    setActions((prev) => prev.filter((a) => a.id !== id));
  }

  const pendingCount = actions.length;

  return (
    <main className={styles.page}>
      {/* ── Top bar ── */}
      <header className={styles.topBar}>
        <button
          className={styles.backBtn}
          onClick={() => router.back()}
          aria-label="Back"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            width={22}
            height={22}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
            />
          </svg>
        </button>
        <h1 className={styles.topTitle}>Image Processing</h1>
        <span />
      </header>

      {/* ── Upload zone ── */}
      <section className={styles.uploadSection}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          hidden
          onChange={(e) => handleFiles(e, false)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => handleFiles(e, true)}
        />

        {files.length === 0 ? (
          <div className={styles.emptyUpload}>
            <div className={styles.uploadIcon}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.2"
                stroke="currentColor"
                width={48}
                height={48}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                />
              </svg>
            </div>
            <p className={styles.uploadHint}>
              Upload receipts, invoices, delivery notes, sales records or
              inventory photos
            </p>
            <div className={styles.uploadBtns}>
              <button
                className={styles.uploadBtn}
                onClick={() => fileInputRef.current?.click()}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  width={18}
                  height={18}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                  />
                </svg>
                Choose Files
              </button>
              <button
                className={styles.uploadBtn}
                onClick={() => cameraInputRef.current?.click()}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  width={18}
                  height={18}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"
                  />
                </svg>
                Take Photo
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.previewList}>
            {files.map((f, i) => (
              <div key={i} className={styles.previewItem}>
                {f.preview ? (
                  <img
                    src={f.preview}
                    alt={f.name}
                    className={styles.previewImg}
                  />
                ) : (
                  <div className={styles.previewPdf}>PDF</div>
                )}
                <p className={styles.previewName}>{f.name}</p>
                <button
                  className={styles.removeBtn}
                  onClick={() =>
                    setFiles((prev) => prev.filter((_, j) => j !== i))
                  }
                  aria-label={`Remove ${f.name}`}
                >
                  ×
                </button>
              </div>
            ))}
            {files.length < MAX_FILES && (
              <button
                className={styles.addMoreBtn}
                onClick={() => fileInputRef.current?.click()}
              >
                + Add more
              </button>
            )}
          </div>
        )}

        {error && <p className={styles.errorMsg}>{error}</p>}

        {files.length > 0 && (
          <button
            className={styles.analyzeBtn}
            onClick={handleAnalyze}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className={styles.spinner} />
                Analysing…
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  width={20}
                  height={20}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
                  />
                </svg>
                Analyse with AI
              </>
            )}
          </button>
        )}
      </section>

      {/* ── Result summary ── */}
      {result && (
        <section className={styles.resultSection}>
          <div
            className={`${styles.summaryCard} ${
              result.status === "not_business_document"
                ? styles.summaryWarn
                : result.status === "unreadable"
                  ? styles.summaryError
                  : styles.summaryOk
            }`}
          >
            <p className={styles.summaryText}>{result.summary}</p>
            {result.notes && (
              <p className={styles.summaryNotes}>{result.notes}</p>
            )}
          </div>

          {pendingCount > 0 && (
            <p className={styles.pendingHint}>
              {pendingCount} action{pendingCount > 1 ? "s" : ""} found — review
              each one below and tap Allow or Deny.
            </p>
          )}

          {pendingCount === 0 && result.actions.length > 0 && (
            <p className={styles.allDoneHint}>All actions have been handled.</p>
          )}

          <div className={styles.actionList}>
            {actions.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                products={products}
                onUpdate={(updated) =>
                  setActions((prev) =>
                    prev.map((a) => (a.id === updated.id ? updated : a)),
                  )
                }
                onAllow={handleAllow}
                onDeny={handleDeny}
              />
            ))}
          </div>

          <button
            className={styles.newScanBtn}
            onClick={() => {
              setResult(null);
              setActions([]);
              setFiles([]);
              setError("");
            }}
          >
            Scan another image
          </button>
        </section>
      )}
    </main>
  );
}
