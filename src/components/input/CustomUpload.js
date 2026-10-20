"use client";
// src/components/input/CustomUpload.js

import { useEffect, useId, useRef, useState } from "react";
import styles from "./CustomInput.module.css";

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function CustomUpload({
  label,
  preview = false,
  maxSize, // in MB, e.g. maxSize={1}
  buttonText = "Choose file",
  placeholder = "No file chosen",
  className = "",
  id,
  value, // optional File (or null) controlled by the parent
  onFileChange, // called with the File, or null when cleared
  onChange,
  ...props
}) {
  const autoId = useId();
  const inputId = id || autoId;
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState("");

  const isImage = !!file && file.type.startsWith("image/");
  const isPdf = !!file && file.type === "application/pdf";

  // Put a file back into the hidden native input, so `required` stays valid.
  const syncInput = (f) => {
    const input = inputRef.current;
    if (!input) return;
    try {
      const dt = new DataTransfer();
      if (f) dt.items.add(f);
      input.files = dt.files;
    } catch {
      if (!f) input.value = "";
    }
  };

  // Controlled mode: when the parent hands us a different file (for example one
  // restored from IndexedDB), show it AND put it in the native input, so that
  // `required` validation passes without the user picking the file again.
  useEffect(() => {
    if (value === undefined || value === file) return;
    setFile(value);
    setError("");
    syncInput(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Build / clean up the preview URL for images and PDFs.
  useEffect(() => {
    if (!preview || !file || (!isImage && !isPdf)) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, preview, isImage, isPdf]);

  const handleChange = (e) => {
    const selected = e.target.files?.[0] ?? null;

    // Too large: show the error but KEEP the previous file (state, input, draft).
    if (selected && maxSize && selected.size > maxSize * 1024 * 1024) {
      setError(
        `File is too large (${formatSize(selected.size)}). Max size is ${maxSize} MB.`,
      );
      syncInput(file);
      return;
    }

    setError("");
    setFile(selected);
    onFileChange?.(selected);
    onChange?.(e);
  };

  const handleRemove = () => {
    syncInput(null);
    setFile(null);
    setError("");
    onFileChange?.(null); // keep the parent in sync
  };

  return (
    <div className={styles.wrapper}>
      {label && (
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
      )}

      <div
        className={`${styles.fileBox} ${error ? styles.fileBoxError : ""} ${className}`.trim()}
      >
        <div className={styles.fileInfo}>
          <span
            className={`${styles.fileName} ${!file ? styles.filePlaceholder : ""}`}
          >
            {file ? file.name : placeholder}
          </span>
          {file && (
            <span className={styles.fileSize}>{formatSize(file.size)}</span>
          )}
        </div>

        <button
          type="button"
          className={styles.fileBtn}
          onClick={() => inputRef.current?.click()}
        >
          {buttonText}
        </button>

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className={styles.fileNative}
          onChange={handleChange}
          tabIndex={-1}
          {...props}
        />
      </div>

      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}

      {preview && file && (
        <div
          className={`${styles.previewBox} ${isPdf ? styles.previewBoxPdf : ""}`.trim()}
        >
          {/* Image preview */}
          {previewUrl && isImage && (
            <img src={previewUrl} alt="Preview" className={styles.previewImg} />
          )}

          {/* PDF preview */}
          {previewUrl && isPdf && (
            <div className={styles.pdfWrap}>
              <iframe
                src={`${previewUrl}#toolbar=0&navpanes=0`}
                title={`Preview of ${file.name}`}
                className={styles.previewPdf}
              />
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.pdfLink}
              >
                Open PDF in new tab
              </a>
            </div>
          )}

          {/* Fallback card for other file types */}
          {!isImage && !isPdf && (
            <div className={styles.previewFile}>
              <span className={styles.previewFileName}>{file.name}</span>
              <span className={styles.previewFileSize}>
                {formatSize(file.size)}
              </span>
            </div>
          )}

          <button
            type="button"
            className={styles.removeBtn}
            onClick={handleRemove}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
