"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import styles from "./NavBar.module.css";

const OPTIONS = {
  left: {
    label: "Files",
    subtitle: "Your files",
    href: null,
    color: "#8494d6",
    icon: "files",
  },
  top: {
    label: "Camera",
    subtitle: "Take a photo",
    href: null,
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
          <path d="M5 6h14M5 12h14M5 18h14" />
        </svg>
      );

    case "camera":
      return (
        <svg {...common}>
          <path d="M4 7h4l2-3h4l2 3h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      );

    case "barcode":
      return (
        <svg {...common}>
          <path d="M4 5v14M7 5v14M10 5v14M14 5v14M17 5v14M20 5v14" />
        </svg>
      );

    default:
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
  }
}

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();

  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const timerRef = useRef(null);
  const menuOpenRef = useRef(false);
  const selectedRef = useRef(null);
  const suppressClickRef = useRef(false);
  const pointerRef = useRef(null);
  const startRef = useRef({ x: 0, y: 0 });

  const isActive = (href) =>
    pathname === href || pathname.startsWith(`${href}/`);

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

    // Prevent touch scrolling while performing the hold gesture.
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
    if (pointerRef.current !== null && event.pointerId !== pointerRef.current) {
      return;
    }

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

    if (destination) {
      router.push(destination);
    }
    // Placeholder actions close the menu without navigating.
  }, [closeMenu, router]);

  const cancelHold = useCallback(() => {
    clearTimeout(timerRef.current);
    pointerRef.current = null;

    if (menuOpenRef.current) {
      closeMenu();
    }
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
          <a
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={cls(item.href)}
          >
            <NavIcon type={item.icon} />
            <p>{item.label}</p>
          </a>
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
          <a
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={cls(item.href)}
          >
            <NavIcon type={item.icon} />
            <p>{item.label}</p>
          </a>
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
                    if (event.pointerType === "mouse" && menuOpenRef.current) {
                      chooseOption(key);
                    }
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
