/**
 * AppBar Component
 *
 * Props:
 * ┌─────────────────┬────────────┬──────────────────────────────────────────────────┐
 * │ Prop            │ Type       │ Description                                      │
 * ├─────────────────┼────────────┼──────────────────────────────────────────────────┤
 * │ title           │ string     │ The heading text shown in the centre of the bar. │
 * │                 │            │ Defaults to "Inventory".                         │
 * ├─────────────────┼────────────┼──────────────────────────────────────────────────┤
 * │ onBack          │ function   │ Called when the left back-arrow button is        │
 * │                 │            │ pressed. Defaults to router.back().              │
 * ├─────────────────┼────────────┼──────────────────────────────────────────────────┤
 * │ actionIcon      │ ReactNode  │ The icon/element rendered inside the right       │
 * │                 │            │ button. Pass any <Image>, <svg>, or element.     │
 * │                 │            │ Pass null to hide the right button entirely.     │
 * ├─────────────────┼────────────┼──────────────────────────────────────────────────┤
 * │ onAction        │ function   │ Called when the right action button is pressed.  │
 * │                 │            │ Required if actionIcon is provided.              │
 * └─────────────────┴────────────┴──────────────────────────────────────────────────┘
 *
 * Usage examples:
 *
 * // 1. Basic — title only, default back behaviour, no right button
 * <AppBar title="Inventory" />
 *
 * // 2. Custom back handler
 * <AppBar title="Details" onBack={() => router.push("/home")} />
 *
 * // 3. Right action button with an image icon
 * <AppBar
 *   title="Inventory"
 *   actionIcon={<Image src="/assets/icon/scan.svg" alt="Scan" width={24} height={24} />}
 *   onAction={() => router.push("/scan")}
 * />
 *
 * // 4. Right action button with an inline SVG icon
 * <AppBar
 *   title="Settings"
 *   actionIcon={
 *     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
 *       strokeWidth="1.5" stroke="currentColor" width={22} height={22}>
 *       <path strokeLinecap="round" strokeLinejoin="round"
 *         d="M12 4.5v15m7.5-7.5h-15" />
 *     </svg>
 *   }
 *   onAction={() => setModalOpen(true)}
 * />
 *
 * // 5. Hide the right button entirely
 * <AppBar title="Profile" actionIcon={null} />
 */

"use client";

import { useRouter } from "next/navigation";
import styles from "./AppBar.module.css";

export default function AppBar({
  title = "Inventory",
  onBack,
  actionIcon,
  onAction,
  actionMenu,
}) {
  const router = useRouter();

  const handleBack = onBack ?? (() => router.back());

  return (
    <section className={styles.topBar}>
      <div className={styles.topAction}>
        {/* Left: back button */}
        <button onClick={handleBack} aria-label="Back">
          <svg
            className={styles.topActionLogo}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
            />
          </svg>
        </button>

        {/* Centre: title */}
        <h1 className={styles.titleText}>{title}</h1>

        {/* Right: action button — hidden when actionIcon is null/undefined */}
        <div className={styles.rightActions}>
          {actionIcon != null && (
            <button
              className={styles.topActionLogo}
              onClick={onAction}
              aria-label="Action"
            >
              {actionIcon}
            </button>
          )}

          {actionMenu}
        </div>
      </div>
    </section>
  );
}
