"use client";

import { useCallback, useRef, useState } from "react";
import styles from "./ExportMenu.module.css";
import useDismiss from "@/components/input/useDismiss";
import { downloadCsv } from "@/lib/csv";

function Icon({ d, size = 18, strokeWidth = 1.6 }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={strokeWidth}
      stroke="currentColor"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

const ICONS = {
  export:
    "M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-6L12 15m0 0 4.5-4.5M12 15V3",
  close: "M6 18 18 6M6 6l12 12",
  csv: "M9 12h6m-6 3.75h6M9 8.25h6M5.25 3.75h13.5a1.5 1.5 0 0 1 1.5 1.5v13.5a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V5.25a1.5 1.5 0 0 1 1.5-1.5Z",
  sheets:
    "M9 3v18M3 9h18M3 15h18M5.25 3h13.5A2.25 2.25 0 0 1 21 5.25v13.5A2.25 2.25 0 0 1 18.75 21H5.25A2.25 2.25 0 0 1 3 18.75V5.25A2.25 2.25 0 0 1 5.25 3Z",
  copy: "M15.75 17.25v3a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9a2.25 2.25 0 0 1 2.25-2.25h3m4.5-4.5h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9a2.25 2.25 0 0 1 2.25-2.25Z",
};

/**
 * Export menu for a data page (summary / transaction / report / inventory).
 *
 *   page     "summary" | "transaction" | "report" | "inventory"
 *   getData  () => { csv: string, filename: string } — build this lazily
 *            from whatever the page already has in state/memory.
 */
export default function ExportMenu({ page, getData }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState(null); // { url, filename }

  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, rootRef, close);

  function openMenu() {
    setError("");
    setSheet(null);
    setOpen(true);
  }

  function handleDownload() {
    const data = getData();
    if (!data?.csv) return;
    downloadCsv(data.filename || page, data.csv);
    setOpen(false);
  }

  async function handleGoogleSheets() {
    const data = getData();
    if (!data?.csv) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/sheet/${page}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csv: data.csv,
          filename: data.filename || page,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not prepare the export.");
        return;
      }
      setSheet({ url: json.url, filename: data.filename || page });
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyFormula() {
    if (!sheet) return;
    try {
      await navigator.clipboard.writeText(`=IMPORTDATA("${sheet.url}")`);
    } catch {
      /* clipboard unavailable, the box text is still selectable */
    }
  }

  return (
    <div className={styles.wrapper} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => (open ? close() : openMenu())}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Export"
      >
        <Icon d={ICONS.export} />
      </button>

      {open && (
        <div className={styles.popover} role="dialog" aria-label="Export">
          {!sheet ? (
            <>
              <div className={styles.header}>
                <div className={styles.headerText}>
                  <h3>Export</h3>
                  <p>Download a copy or open it in Google Sheets.</p>
                </div>
                <button
                  type="button"
                  className={styles.closeBtn}
                  onClick={close}
                  aria-label="Close"
                >
                  <Icon d={ICONS.close} size={14} strokeWidth={2} />
                </button>
              </div>

              <div className={styles.optionList}>
                <button
                  type="button"
                  className={styles.option}
                  onClick={handleDownload}
                >
                  <span className={styles.optionIcon}>
                    <Icon d={ICONS.csv} size={17} />
                  </span>
                  <span className={styles.optionText}>
                    <p>Download CSV</p>
                    <p>Save a file to your device</p>
                  </span>
                </button>

                <button
                  type="button"
                  className={styles.option}
                  onClick={handleGoogleSheets}
                  disabled={busy}
                >
                  <span className={styles.optionIcon}>
                    <Icon d={ICONS.sheets} size={17} />
                  </span>
                  <span className={styles.optionText}>
                    <p>{busy ? "Preparing..." : "Open in Google Sheets"}</p>
                    <p>Get a link to import the data</p>
                  </span>
                </button>
              </div>

              {error && <p className={styles.errorText}>{error}</p>}
            </>
          ) : (
            <div className={styles.resultPanel}>
              <div className={styles.header}>
                <div className={styles.headerText}>
                  <h3>Paste into Sheets</h3>
                  <p>In any cell of a new Google Sheet, paste:</p>
                </div>
                <button
                  type="button"
                  className={styles.closeBtn}
                  onClick={close}
                  aria-label="Close"
                >
                  <Icon d={ICONS.close} size={14} strokeWidth={2} />
                </button>
              </div>

              <div className={styles.formulaBox}>
                {`=IMPORTDATA("${sheet.url}")`}
              </div>

              <div className={styles.resultActions}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={copyFormula}
                >
                  Copy formula
                </button>
                <a
                  className={styles.primaryBtn}
                  href="https://sheets.new"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  New Sheet
                </a>
              </div>

              <p className={styles.resultHint}>
                The link stays active for 30 minutes. If the data changes,
                export again.
              </p>

              <button
                type="button"
                className={styles.backBtn}
                onClick={() => setSheet(null)}
              >
                ← Back
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
