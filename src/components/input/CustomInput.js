"use client";

import { useState, useRef } from "react";
import styles from "./CustomInput.module.css";

export default function CustomInput({
  label,
  isPassword = false,
  longInput = false,
  className = "",
  type = "text",
  onInput,
  error,
  ...props
}) {
  const [showPassword, setShowPassword] = useState(false);
  const textareaRef = useRef(null);

  const inputType = isPassword ? (showPassword ? "text" : "password") : type;

  const handleInput = (e) => {
    if (longInput && textareaRef.current) {
      const el = textareaRef.current;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
    onInput?.(e);
  };

  const errorBorderStyle = error ? { borderColor: "#ff3b30" } : {};

  return (
    <div className={styles.wrapper}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.inputContainer}>
        {longInput ? (
          <textarea
            ref={textareaRef}
            rows={1}
            className={`${styles.input} ${styles.longInput} ${className}`.trim()}
            style={errorBorderStyle}
            onInput={handleInput}
            {...props}
          />
        ) : (
          <input
            type={inputType}
            className={`${styles.input} ${isPassword ? styles.passwordInput : ""} ${className}`.trim()}
            style={errorBorderStyle}
            onInput={onInput}
            {...props}
          />
        )}
        {isPassword && !longInput && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className={styles.togglePasswordBtn}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        )}
      </div>
      {/* Always render the error slot — empty string keeps height stable */}
      <p className={styles.errorText} role={error ? "alert" : undefined}>
        {error || ""}
      </p>
    </div>
  );
}
