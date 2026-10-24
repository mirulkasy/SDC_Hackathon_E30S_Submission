"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import styles from "./NavBar.module.css";
import Link from "next/link";
import useSplashRouter from "@/lib/useSplashRouter";

const OPTIONS = {
  left: {
    label: "Files",
    subtitle: "Upload from your device",
    href: "/image?source=files",
    color: "#8494d6",
    icon: "files",
  },
  top: {
    label: "Camera",
    subtitle: "Take a photo",
    href: "/image?source=camera",
    color: "#329de8",
    icon: "camera",
  },
  right: {
    label: "Barcode Scanner",
    subtitle: "Scan a barcode",
    href: "/barcode",
    color: "#08aaa4",
    icon: "barcode",
  },
};

function NavIcon({ type, size = 26 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  switch (type) {
    case "home":
      return (
        <svg {...common}>
          <path d="m2.25 12 8.95-8.95a1.13 1.13 0 0 1 1.6 0L21.75 12" />
          <path d="M4.5 9.75v10.13c0 .62.5 1.12 1.12 1.12h4.13v-6a1.12 1.12 0 0 1 1.12-1.12h2.26a1.12 1.12 0 0 1 1.12 1.12v6h4.13c.62 0 1.12-.5 1.12-1.12V9.75" />
        </svg>
      );

    case "finance":
      return (
        <svg {...common}>
          <path d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
          <path d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
        </svg>
      );

    case "inventory":
      return (
        <svg {...common}>
          <path d="m20.25 7.5-.63 10.63a2.25 2.25 0 0 1-2.25 2.12H6.62a2.25 2.25 0 0 1-2.25-2.12L3.75 7.5" />
          <path d="M3.38 7.5h17.24c.63 0 1.13-.5 1.13-1.13v-1.5c0-.62-.5-1.12-1.13-1.12H3.38c-.63 0-1.13.5-1.13 1.12v1.5c0 .63.5 1.13 1.13 1.13ZM10 11.25h4" />
        </svg>
      );

    case "history":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 6v6l4 2" />
        </svg>
      );

    case "files":
      return (
        <svg {...common}>
          <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
        </svg>
      );

    case "camera":
      return (
        <svg {...common}>
          <path d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
          <path d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
        </svg>
      );

    case "barcode":
      return (
        <svg {...common}>
          <path d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5ZM6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75Z" />
        </svg>
      );

    default:
      return (
        <svg {...common}>
          <path d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      );
  }
}

export default function NavBar() {
  const pathname = usePathname();
  const router = useSplashRouter();

  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const timerRef = useRef(null);
  const menuOpenRef = useRef(false);
  const selectedRef = useRef(null);
  const suppressClickRef = useRef(false);
  const pointerRef = useRef(null);
  const startRef = useRef({ x: 0, y: 0 });

  const isActive = (href) => {
    const base = href.split("?")[0];
    return pathname === base || pathname.startsWith(`${base}/`);
  };

  const cls = (href, extra = "") =>
    `${styles.navAction} ${extra} ${
      isActive(href) ? styles.navActionActive : ""
    }`;

  const chooseOption = useCallback((key) => {
    selectedRef.current = key;
    setSelected(key);
  }, []);

  const openMenu = useCallback(() => {
    menuOpenRef.current = true;
    suppressClickRef.current = true;
    setMenuOpen(true);
    chooseOption(null);
  }, [chooseOption]);

  const closeMenu = useCallback(() => {
    clearTimeout(timerRef.current);
    menuOpenRef.current = false;
    setMenuOpen(false);
    chooseOption(null);
  }, [chooseOption]);

  const startHold = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    clearTimeout(timerRef.current);
    pointerRef.current = event.pointerId;
    startRef.current = { x: event.clientX, y: event.clientY };
    selectedRef.current = null;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    timerRef.current = setTimeout(openMenu, 350);
  };

  const updateSelection = useCallback(
    (x, y) => {
      if (!menuOpenRef.current) return;
      const dx = x - startRef.current.x;
      const dy = y - startRef.current.y;
      if (Math.hypot(dx, dy) < 28) {
        chooseOption(null);
        return;
      }
      if (Math.abs(dx) > Math.abs(dy)) {
        chooseOption(dx < 0 ? "left" : "right");
      } else {
        chooseOption(dy < 0 ? "top" : null);
      }
    },
    [chooseOption],
  );

  const moveHold = (event) => {
    if (pointerRef.current !== null && event.pointerId !== pointerRef.current)
      return;
    if (menuOpenRef.current) {
      updateSelection(event.clientX, event.clientY);
      return;
    }
    if (
      Math.hypot(
        event.clientX - startRef.current.x,
        event.clientY - startRef.current.y,
      ) > 12
    ) {
      clearTimeout(timerRef.current);
    }
  };

  const finishHold = useCallback(() => {
    clearTimeout(timerRef.current);
    pointerRef.current = null;
    if (!menuOpenRef.current) return;
    const option = selectedRef.current;
    const destination = option ? OPTIONS[option]?.href : null;
    closeMenu();
    if (destination) router.push(destination);
  }, [closeMenu, router]);

  const cancelHold = useCallback(() => {
    clearTimeout(timerRef.current);
    pointerRef.current = null;
    if (menuOpenRef.current) closeMenu();
  }, [closeMenu]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearTimeout(timerRef.current);
    };
  }, [closeMenu]);

  const navItems = [
    { href: "/home", label: "Home", icon: "home" },
    { href: "/summary", label: "Finance", icon: "finance" },
    { href: "/inventory", label: "Inventory", icon: "inventory" },
    { href: "/transaction", label: "History", icon: "history" },
  ];

  return (
    <>
      <nav className={styles.NavBarWrapper} aria-label="Main navigation">
        {navItems.slice(0, 2).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={cls(item.href)}
          >
            <NavIcon type={item.icon} />
            <p>{item.label}</p>
          </Link>
        ))}

        <button
          type="button"
          aria-label="Chat and quick actions"
          className={`${styles.navAction} ${styles.navActionMid} ${
            isActive("/chat") ? styles.navActionActive : ""
          }`}
          onPointerDown={startHold}
          onPointerMove={moveHold}
          onPointerUp={finishHold}
          onPointerCancel={cancelHold}
          onLostPointerCapture={() => {
            if (menuOpenRef.current) closeMenu();
          }}
          onContextMenu={(event) => event.preventDefault()}
          onClick={(event) => {
            event.preventDefault();
            if (suppressClickRef.current) {
              suppressClickRef.current = false;
              return;
            }
            router.push("/chat");
          }}
        >
          <NavIcon type="plus" size={24} />
        </button>

        {navItems.slice(2).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={cls(item.href)}
          >
            <NavIcon type={item.icon} />
            <p>{item.label}</p>
          </Link>
        ))}
      </nav>

      {menuOpen && (
        <div
          className={styles.radialOverlay}
          onPointerMove={(event) =>
            updateSelection(event.clientX, event.clientY)
          }
          onPointerUp={finishHold}
          onPointerCancel={cancelHold}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div className={styles.radialContent}>
            <div className={styles.radialLabel} aria-live="polite">
              <h2>{selected ? OPTIONS[selected].label : "Quick actions"}</h2>
              <p>
                {selected ? OPTIONS[selected].subtitle : "Slide to an option"}
              </p>
            </div>

            <div className={styles.radialMenu}>
              {Object.entries(OPTIONS).map(([key, option]) => (
                <button
                  key={key}
                  type="button"
                  className={`${styles.radialOption} ${
                    styles[`radial${key[0].toUpperCase()}${key.slice(1)}`]
                  } ${selected === key ? styles.radialSelected : ""}`}
                  style={{ "--option-color": option.color }}
                  aria-label={option.label}
                  aria-pressed={selected === key}
                  onPointerEnter={(event) => {
                    if (event.pointerType === "mouse" && menuOpenRef.current)
                      chooseOption(key);
                  }}
                  onClick={(event) => event.preventDefault()}
                >
                  <NavIcon type={option.icon} size={25} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
