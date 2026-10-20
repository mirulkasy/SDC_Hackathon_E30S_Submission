"use client";
// src/components/input/DatePicker.js
// Custom calendar popover (the browser's own date popup can't be styled).
//
//   value               "YYYY-MM-DD" or ""
//   onChange            called with { target: { name, value } }, so it works
//                       with the same setField(...) handlers as CustomInput
//   min / max           days before min or after max are disabled
//   rangeStart/rangeEnd the highlighted range (circles on both ends, a band
//                       between them). Pass the SAME two values to both pickers.
import { useCallback, useEffect, useId, useRef, useState } from "react";
import baseStyles from "./CustomInput.module.css";
import styles from "./DatePicker.module.css";
import useDismiss from "./useDismiss";
import { formatDate } from "@/lib/format";
import {
  WEEKDAYS,
  addDays,
  addMonths,
  clampISO,
  isDisabled,
  longLabel,
  monthCells,
  monthLabel,
  monthOf,
  parseISO,
  toISO,
  todayISO,
} from "@/lib/calendar";

function Chevron({ dir }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      className={styles.icon}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

export default function DatePicker({
  label,
  name,
  value = "",
  onChange,
  min,
  max,
  rangeStart,
  rangeEnd,
  placeholder = "Select a date",
  error,
  required,
}) {
  const id = useId();
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const gridRef = useRef(null);
  const shouldFocus = useRef(false); // only move focus for open + arrow keys

  const [open, setOpen] = useState(false);
  const [view, setView] = useState(null); // { y, m } of the month being shown
  const [focusIso, setFocusIso] = useState(null); // the one tabbable day

  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, rootRef, close);

  function openCalendar() {
    // Open on the selected date, else on the other date of the range, else today.
    const anchor = [value, rangeStart, rangeEnd, todayISO()].find((v) =>
      parseISO(v),
    );
    const start = clampISO(anchor, min, max);
    shouldFocus.current = true;
    setView(monthOf(start));
    setFocusIso(start);
    setOpen(true);
  }

  // Move keyboard focus onto the focused day (after open, or an arrow key).
  useEffect(() => {
    if (!open || !focusIso || !shouldFocus.current) return;
    const el = gridRef.current?.querySelector(`[data-iso="${focusIso}"]`);
    if (el) {
      el.focus();
      shouldFocus.current = false;
    }
  }, [open, focusIso, view]);

  function pick(iso) {
    if (isDisabled(iso, min, max)) return;
    onChange?.({ target: { name, value: iso } });
    setOpen(false);
    triggerRef.current?.focus();
  }

  function clear() {
    onChange?.({ target: { name, value: "" } });
    setOpen(false);
    triggerRef.current?.focus();
  }

  function goToMonth(delta) {
    const next = addMonths(view, delta);
    setView(next);
    setFocusIso(toISO(next.y, next.m, 1)); // keeps one tabbable day, no focus jump
  }

  function onGridKeyDown(e) {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[
      e.key
    ];
    if (step === undefined || !focusIso) return;
    e.preventDefault();
    shouldFocus.current = true;
    const next = addDays(focusIso, step);
    setFocusIso(next);
    const m = monthOf(next);
    if (m.y !== view.y || m.m !== view.m) setView(m);
  }

  function onRootKeyDown(e) {
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  const today = open ? todayISO() : "";
  const cells = open && view ? monthCells(view) : [];
  const hasRange = Boolean(
    parseISO(rangeStart) && parseISO(rangeEnd) && rangeStart < rangeEnd,
  );

  return (
    <div className={baseStyles.wrapper}>
      {label && (
        <label className={baseStyles.label} htmlFor={id}>
          {label}
        </label>
      )}

      <div
        className={baseStyles.inputContainer}
        ref={rootRef}
        onKeyDown={onRootKeyDown}
      >
        <button
          type="button"
          id={id}
          ref={triggerRef}
          className={`${baseStyles.input} ${styles.trigger}`}
          style={error ? { borderColor: "#ff3b30" } : undefined}
          onClick={() => (open ? setOpen(false) : openCalendar())}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-required={required || undefined}
        >
          <span className={value ? styles.value : styles.placeholder}>
            {value ? formatDate(value) : placeholder}
          </span>
          <CalendarIcon />
        </button>

        {/* Lets the value travel with a normal <form> too. */}
        <input type="hidden" name={name} value={value ?? ""} />

        {open && view && (
          <div
            className={styles.popover}
            role="dialog"
            aria-label={label ? `Choose ${label}` : "Choose a date"}
          >
            <div className={styles.header}>
              <button
                type="button"
                className={styles.navBtn}
                onClick={() => goToMonth(-1)}
                aria-label="Previous month"
              >
                <Chevron dir="left" />
              </button>
              <span className={styles.title} aria-live="polite">
                {monthLabel(view)}
              </span>
              <button
                type="button"
                className={styles.navBtn}
                onClick={() => goToMonth(1)}
                aria-label="Next month"
              >
                <Chevron dir="right" />
              </button>
            </div>

            <div className={styles.weekdays} aria-hidden="true">
              {WEEKDAYS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>

            <div
              className={styles.grid}
              ref={gridRef}
              onKeyDown={onGridKeyDown}
            >
              {cells.map((iso, i) => {
                if (!iso)
                  return <span key={`blank-${i}`} className={styles.cell} />;

                const day = parseISO(iso).d;
                const col = i % 7;
                const isStart = iso === rangeStart;
                const isEnd = iso === rangeEnd;
                const selected = isStart || isEnd || iso === value;
                const inRange = hasRange && iso > rangeStart && iso < rangeEnd;
                const disabled = isDisabled(iso, min, max);

                const cellCls = [
                  styles.cell,
                  inRange && styles.inRange,
                  // round the band where a row (or the month) begins/ends
                  inRange && (col === 0 || day === 1) && styles.roundL,
                  inRange &&
                    (col === 6 || i === cells.length - 1) &&
                    styles.roundR,
                  // half-band joining the start / end circle to the range
                  hasRange && isStart && styles.capStart,
                  hasRange && isEnd && styles.capEnd,
                ]
                  .filter(Boolean)
                  .join(" ");

                const dayCls = [
                  styles.day,
                  selected && styles.selected,
                  iso === today && !selected && styles.today,
                  disabled && styles.disabled,
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <span key={iso} className={cellCls}>
                    <button
                      type="button"
                      className={dayCls}
                      data-iso={iso}
                      tabIndex={iso === focusIso ? 0 : -1}
                      aria-label={longLabel(iso)}
                      aria-pressed={selected}
                      aria-disabled={disabled || undefined}
                      aria-current={iso === today ? "date" : undefined}
                      onClick={() => pick(iso)}
                      onFocus={() => setFocusIso(iso)}
                    >
                      {day}
                    </button>
                  </span>
                );
              })}
            </div>

            <div className={styles.footer}>
              <button type="button" className={styles.linkBtn} onClick={clear}>
                Clear
              </button>
              <button
                type="button"
                className={styles.linkBtn}
                aria-disabled={isDisabled(today, min, max) || undefined}
                onClick={() => pick(today)}
              >
                Today
              </button>
            </div>
          </div>
        )}
      </div>

      <p className={baseStyles.errorText} role={error ? "alert" : undefined}>
        {error || ""}
      </p>
    </div>
  );
}
