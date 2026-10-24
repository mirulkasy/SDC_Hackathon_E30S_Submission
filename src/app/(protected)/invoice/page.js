"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { addTransaction } from "@/lib/transactions";
import AppBar from "@/components/layout/AppBar";
import NavBar from "@/components/layout/NavBar";
import CustomInput from "@/components/input/CustomInput";
import styles from "./invoice.module.css";

const money = (n) =>
  `RM ${Number(n || 0).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
const todayISO = () => new Date().toLocaleDateString("en-CA");

function makeInvoiceNo() {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INV-${stamp}-${rand}`;
}

function newItem() {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    description: "",
    qty: 1,
    price: "",
  };
}

export default function InvoicePage() {
  const { user, profile } = useAuth();
  const orgId = profile?.orgId;

  const [mode, setMode] = useState("edit"); // "edit" | "preview"
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState("");

  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState("");

  const [from, setFrom] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });
  const [to, setTo] = useState({ name: "", phone: "", email: "", address: "" });

  const [items, setItems] = useState([newItem()]);
  const [taxRate, setTaxRate] = useState("0");
  const [notes, setNotes] = useState("");

  // One invoice number per visit; the owner can still override it.
  useEffect(() => {
    setInvoiceNo(makeInvoiceNo());
  }, []);

  // Prefill "From" with the organization's name, once.
  useEffect(() => {
    if (!orgId) return;
    getDoc(doc(db, "organizations", orgId))
      .then((snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        setFrom((f) => ({ ...f, name: f.name || data.name || "" }));
      })
      .catch((err) => console.error("Organization read failed:", err));
  }, [orgId]);

  useEffect(() => {
    if (profile?.email) {
      setFrom((f) => ({ ...f, email: f.email || profile.email }));
    }
  }, [profile?.email]);

  function updateItem(id, patch) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
  }
  function addItem() {
    setItems((prev) => [...prev, newItem()]);
  }
  function removeItem(id) {
    setItems((prev) =>
      prev.length > 1 ? prev.filter((it) => it.id !== id) : prev,
    );
  }

  const lineTotals = useMemo(
    () => items.map((it) => (Number(it.qty) || 0) * (Number(it.price) || 0)),
    [items],
  );
  const subtotal = useMemo(
    () => lineTotals.reduce((s, v) => s + v, 0),
    [lineTotals],
  );
  const taxAmount = useMemo(
    () => (subtotal * (Number(taxRate) || 0)) / 100,
    [subtotal, taxRate],
  );
  const total = subtotal + taxAmount;

  const canPreview = items.some(
    (it) => it.description.trim() && Number(it.price) > 0,
  );

  function handlePrint() {
    window.print();
  }

  async function handleRecordSale() {
    if (!orgId || !user || total <= 0 || saving) return;
    setSaving(true);
    setSavedNote("");
    try {
      await addTransaction({
        orgId,
        user,
        transaction: {
          type: "in",
          amount: Number(total.toFixed(2)),
          category: "sales",
          description: `Invoice ${invoiceNo}${to.name ? ` — ${to.name}` : ""}`,
          date: invoiceDate,
          paymentMethod: "Bank Transfer",
          note: "Recorded from the E-Invoice page.",
        },
      });
      setSavedNote("Recorded as a sale in your transactions.");
    } catch (err) {
      console.error("Record sale failed:", err);
      setSavedNote("Could not record the sale. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AppBar title="E-Invoice" />
      <main className={styles.invoicePage}>
        {mode === "edit" ? (
          <section className={styles.formSection}>
            <h2>From</h2>
            <div className={styles.formCard}>
              <CustomInput
                label="Business Name"
                value={from.name}
                onChange={(e) =>
                  setFrom((f) => ({ ...f, name: e.target.value }))
                }
              />
              <div className={styles.fieldGrid}>
                <CustomInput
                  label="Phone"
                  value={from.phone}
                  onChange={(e) =>
                    setFrom((f) => ({ ...f, phone: e.target.value }))
                  }
                />
                <CustomInput
                  label="Email"
                  type="email"
                  value={from.email}
                  onChange={(e) =>
                    setFrom((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </div>
              <CustomInput
                label="Address"
                longInput
                value={from.address}
                onChange={(e) =>
                  setFrom((f) => ({ ...f, address: e.target.value }))
                }
              />
            </div>

            <h2>Bill To</h2>
            <div className={styles.formCard}>
              <CustomInput
                label="Customer Name"
                value={to.name}
                onChange={(e) => setTo((t) => ({ ...t, name: e.target.value }))}
              />
              <div className={styles.fieldGrid}>
                <CustomInput
                  label="Phone"
                  value={to.phone}
                  onChange={(e) =>
                    setTo((t) => ({ ...t, phone: e.target.value }))
                  }
                />
                <CustomInput
                  label="Email"
                  type="email"
                  value={to.email}
                  onChange={(e) =>
                    setTo((t) => ({ ...t, email: e.target.value }))
                  }
                />
              </div>
              <CustomInput
                label="Address"
                longInput
                value={to.address}
                onChange={(e) =>
                  setTo((t) => ({ ...t, address: e.target.value }))
                }
              />
            </div>

            <h2>Invoice Details</h2>
            <div className={styles.formCard}>
              <div className={styles.fieldGrid}>
                <CustomInput
                  label="Invoice No"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                />
                <CustomInput
                  label="Date"
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </div>
              <CustomInput
                label="Due Date (optional)"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <h2>Items</h2>
            <div className={styles.itemsCard}>
              {items.map((it, i) => (
                <div key={it.id} className={styles.itemRow}>
                  <input
                    className={styles.itemDesc}
                    placeholder="Item description"
                    value={it.description}
                    onChange={(e) =>
                      updateItem(it.id, { description: e.target.value })
                    }
                  />
                  <input
                    className={styles.itemQty}
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Qty"
                    value={it.qty}
                    onChange={(e) => updateItem(it.id, { qty: e.target.value })}
                  />
                  <input
                    className={styles.itemPrice}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Price"
                    value={it.price}
                    onChange={(e) =>
                      updateItem(it.id, { price: e.target.value })
                    }
                  />
                  <span className={styles.itemTotal}>
                    {money(lineTotals[i])}
                  </span>
                  <button
                    type="button"
                    className={styles.removeItemBtn}
                    onClick={() => removeItem(it.id)}
                    aria-label="Remove item"
                    disabled={items.length <= 1}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={styles.addItemBtn}
                onClick={addItem}
              >
                + Add item
              </button>
            </div>

            <div className={styles.totalsCard}>
              <div className={styles.totalRow}>
                <span>Subtotal</span>
                <span>{money(subtotal)}</span>
              </div>
              <div className={styles.totalRow}>
                <span>
                  Tax / SST (%)
                  <input
                    className={styles.taxInput}
                    type="number"
                    min="0"
                    step="0.1"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                  />
                </span>
                <span>{money(taxAmount)}</span>
              </div>
              <div className={`${styles.totalRow} ${styles.grandTotal}`}>
                <span>Total</span>
                <span>{money(total)}</span>
              </div>
            </div>

            <CustomInput
              label="Notes (optional)"
              longInput
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment instructions, thank-you note, etc."
            />

            <button
              type="button"
              className={styles.previewBtn}
              disabled={!canPreview}
              onClick={() => setMode("preview")}
            >
              Preview Invoice
            </button>
            {!canPreview && (
              <p className={styles.hint}>
                Add at least one item with a description and price to preview.
              </p>
            )}
          </section>
        ) : (
          <section className={styles.previewSection}>
            <div className={styles.previewActions}>
              <button
                type="button"
                className={styles.backBtn}
                onClick={() => setMode("edit")}
              >
                ← Edit
              </button>
              <div className={styles.previewActionsRight}>
                <button
                  type="button"
                  className={styles.recordBtn}
                  onClick={handleRecordSale}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Record as Sale"}
                </button>
                <button
                  type="button"
                  className={styles.printBtn}
                  onClick={handlePrint}
                >
                  Print / Save PDF
                </button>
              </div>
            </div>
            {savedNote && <p className={styles.savedNote}>{savedNote}</p>}

            <div id="invoice-print" className={styles.invoiceSheet}>
              <div className={styles.sheetHeader}>
                <div>
                  <h1>{from.name || "Your Business"}</h1>
                  {from.address && <p>{from.address}</p>}
                  {(from.phone || from.email) && (
                    <p>
                      {[from.phone, from.email].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <div className={styles.sheetMeta}>
                  <h2>INVOICE</h2>
                  <p>{invoiceNo}</p>
                  <p>Date: {invoiceDate}</p>
                  {dueDate && <p>Due: {dueDate}</p>}
                </div>
              </div>

              <div className={styles.sheetBillTo}>
                <p className={styles.sheetLabel}>Bill To</p>
                <p className={styles.sheetBillName}>{to.name || "-"}</p>
                {to.address && <p>{to.address}</p>}
                {(to.phone || to.email) && (
                  <p>{[to.phone, to.email].filter(Boolean).join(" · ")}</p>
                )}
              </div>

              <table className={styles.sheetTable}>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={it.id}>
                      <td>{it.description || "-"}</td>
                      <td>{it.qty || 0}</td>
                      <td>{money(it.price)}</td>
                      <td>{money(lineTotals[i])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className={styles.sheetTotals}>
                <div className={styles.sheetTotalRow}>
                  <span>Subtotal</span>
                  <span>{money(subtotal)}</span>
                </div>
                {Number(taxRate) > 0 && (
                  <div className={styles.sheetTotalRow}>
                    <span>Tax / SST ({taxRate}%)</span>
                    <span>{money(taxAmount)}</span>
                  </div>
                )}
                <div
                  className={`${styles.sheetTotalRow} ${styles.sheetGrandTotal}`}
                >
                  <span>Total</span>
                  <span>{money(total)}</span>
                </div>
              </div>

              {notes && (
                <div className={styles.sheetNotes}>
                  <p className={styles.sheetLabel}>Notes</p>
                  <p>{notes}</p>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <NavBar />
    </>
  );
}
