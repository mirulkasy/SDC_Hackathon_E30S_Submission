"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import SplashScreen from "./SplashScreen";
import styles from "./PageTransition.module.css";

const EVENT = "page-transition-start";
const FADE_MS = 500; // keep in sync with the CSS
const MAX_WAIT_MS = 4000; // safety: never leave the splash stuck

/** Call this right before a programmatic navigation (router.push etc). */
export function startPageTransition(href) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { href } }));
}

export default function PageTransition() {
  const pathname = usePathname();
  const [phase, setPhase] = useState("idle"); // idle | cover | fade
  const phaseRef = useRef("idle");
  const timers = useRef([]);

  const go = (next) => {
    phaseRef.current = next;
    setPhase(next);
  };
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const fadeOut = () => {
    clearTimers();
    go("fade");
    later(() => go("idle"), FADE_MS);
  };

  const cover = () => {
    clearTimers();
    go("cover");
    later(fadeOut, MAX_WAIT_MS);
  };

  // Navigation started
  useEffect(() => {
    const samePath = (href) => {
      try {
        const url = new URL(href, window.location.href);
        return (
          url.origin === window.location.origin &&
          url.pathname === window.location.pathname
        );
      } catch {
        return true;
      }
    };

    const onClick = (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      const a = e.target.closest?.("a[href]");
      if (!a || a.hasAttribute("download")) return;
      if (a.target && a.target !== "_self") return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (samePath(a.href)) return;
      cover();
    };

    const onProgrammatic = (e) => {
      const href = e.detail?.href;
      if (href && samePath(href)) return;
      cover();
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener(EVENT, onProgrammatic);
    window.addEventListener("popstate", cover); // router.back() / browser back
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(EVENT, onProgrammatic);
      window.removeEventListener("popstate", cover);
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New route committed -> reveal it
  useEffect(() => {
    if (phaseRef.current !== "cover") return;
    const id = requestAnimationFrame(() => requestAnimationFrame(fadeOut));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <div
      className={`${styles.overlay} ${
        phase === "cover" ? styles.cover : phase === "fade" ? styles.fade : ""
      }`}
      aria-hidden="true"
    >
      <SplashScreen />
    </div>
  );
}
