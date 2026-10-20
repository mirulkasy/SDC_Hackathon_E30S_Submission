"use client";
// src/components/input/CustomSelect.js
// Styled dropdown (the browser's own option list can't be styled).
//
// Drop-in for the old CustomSelect:
//   - controlled:   value + onChange   (onChange gets { target: { name, value } })
//   - uncontrolled: defaultValue       (works with plain <form> / FormData)
//   - `required` still blocks form submit when nothing is chosen
// A visually hidden native <select> carries the value and the validation.
import { useCallback, useEffect, useId, useRef, useState } from "react";
import baseStyles from "./CustomInput.module.css";
import styles from "./CustomSelect.module.css";
import useDismiss from "./useDismiss";

export default function CustomSelect({
  label,
  options = [],
  className = "",
  name,
  value,
  defaultValue = "",
  onChange,
  required,
  disabled,
  error,
  placeholder = "Select an option",
  ...rest
}) {
  const id = useId();
  const listId = `${id}-list`;
  const rootRef = useRef(null);
  const listRef = useRef(null);

  const isControlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = isControlled ? value : inner;
  const selectedIndex = options.findIndex(
    (o) => String(o.value) === String(current),
  );
  const selected = options[selectedIndex];

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, rootRef, close);

  // Keep the highlighted option visible while arrowing through a long list.
  useEffect(() => {
    if (open)
      listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function openList() {
    setActive(Math.max(selectedIndex, 0));
    setOpen(true);
  }

  function choose(option) {
    if (!option) return;
    if (!isControlled) setInner(option.value);
    onChange?.({ target: { name, value: option.value } });
    setOpen(false);
  }

  function move(delta) {
    setActive((i) => Math.min(options.length - 1, Math.max(0, i + delta)));
  }

  function onKeyDown(e) {
    if (disabled) return;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp":
        e.preventDefault();
        if (!open) openList();
        else move(e.key === "ArrowDown" ? 1 : -1);
        break;
      case "Home":
      case "End":
        if (!open) return;
        e.preventDefault();
        setActive(e.key === "Home" ? 0 : options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (!open) openList();
        else choose(options[active]);
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        // Type a letter to jump to the next option starting with it.
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const letter = e.key.toLowerCase();
          for (let step = 1; step <= options.length; step++) {
            const i = (active + step) % options.length;
            if (String(options[i].label).toLowerCase().startsWith(letter)) {
              if (!open) setOpen(true);
              setActive(i);
              break;
            }
          }
        }
    }
  }

  return (
    <div className={baseStyles.wrapper}>
      {label && (
        <label className={baseStyles.label} htmlFor={id}>
          {label}
        </label>
      )}

      <div className={`${baseStyles.inputContainer} ${styles.inputSelectContainer}`} ref={rootRef}>
        {/* Real form control: value for FormData + `required` validation. */}
        <select
          className={styles.native}
          name={name}
          value={current}
          onChange={() => {}}
          required={required}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          {...rest}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          id={id}
          className={`${baseStyles.input} ${styles.trigger} ${className}`.trim()}
          style={error ? { borderColor: "#ff3b30" } : undefined}
          disabled={disabled}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
          aria-required={required || undefined}
          onClick={() => (open ? setOpen(false) : openList())}
          onKeyDown={onKeyDown}
        >
          <span className={selected ? styles.value : styles.placeholder}>
            {selected ? selected.label : placeholder}
          </span>
          <svg
            className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {open && (
          <ul
            className={styles.list}
            role="listbox"
            id={listId}
            ref={listRef}
            aria-label={label}
          >
            {options.map((o, i) => (
              <li
                key={o.value}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === selectedIndex}
                className={`${styles.option} ${i === active ? styles.active : ""} ${i === selectedIndex ? styles.chosen : ""}`.trim()}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()} // keep focus on the button
                onClick={() => choose(o)}
              >
                <span>{o.label}</span>
                {i === selectedIndex && (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p className={baseStyles.errorText} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
