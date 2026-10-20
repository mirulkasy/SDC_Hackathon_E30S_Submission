"use client";
// src/components/input/useDismiss.js
// Calls `close` when the user presses/taps outside `ref` while `open` is true.
import { useEffect } from "react";

export default function useDismiss(open, ref, close) {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, ref, close]);
}
