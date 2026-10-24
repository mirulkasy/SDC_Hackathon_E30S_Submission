# coding.md — Next.js Page & CSS Style Guide

Oct 21, 2026 · @hairil

## Overview & Core Conventions

This guide documents the coding and CSS style used across all pages in this Next.js project. Follow these conventions strictly when creating new pages or components.

**Stack:** Next.js (App Router), CSS Modules, `next/image`

**Key rules at a glance:**

- Every page exports a default function component named after the page (e.g. `HomePage`, `ProfilePage`)
- Styles are imported from a co-located `.module.css` file: `import styles from "./home.module.css"`
- All layout uses CSS Modules — no inline styles, no Tailwind
- Spacing, font sizes, and brand colors come from CSS custom properties (`var(--primary)`, `var(--secondary)`, `var(--fontsize-14)`, etc.)
- Icons are inline SVGs; images use Next.js `<Image />`
- `<NavBar />` is always the last child, rendered outside `<main>`, inside the fragment `<></>`

## HTML Structure Rule: `main → section → div/children`

Every page follows a strict nesting hierarchy. The top-level `<main>` contains `<section>` blocks, and each section contains `<div>` wrappers or direct children — never place content directly inside `<main>`.

```jsx
export default function SomePage() {
  return (
    <>
      <main className={styles.somePage}>

        <section className={styles.topWrapper}>
          <div className={styles.topAction}> {/* row of buttons/actions */}
            <button>...</button>
            <button>...</button>
          </div>
          <h1>Page Title</h1>
          <div className={styles.cardWrapper}>
            <div className={styles.card}>...</div>
            <div className={styles.card}>...</div>
          </div>
        </section>

        <section className={styles.listSection}>
          <div className={styles.listGrid}>
            <button className={styles.listItem}>...</button>
          </div>
        </section>

        <section className={styles.bannerWrapper}>
          <a className={styles.banner}>
            <h1>Banner Heading</h1>
            <div>CTA Label</div>
            <Image src="/assets/icon/example.svg" alt="" width={100} height={100} />
          </a>
        </section>

      </main>
      <NavBar />
    </>
  );
}
```

**Rules:**

- `<main>` → page root, gets the page-level class (e.g. `styles.homePage`)
- `<section>` → each visual band/block on the page; named `*Wrapper` or `*Section`
- `<div>` inside section → layout containers, grids, rows; named descriptively (`*CardWrapper`, `*Grid`, `*Action`)
- Direct children of `<div>` → actual content elements (`<h1>`, `<button>`, `<a>`, `<Image />`, etc.)
- `<NavBar />` always lives outside `<main>`, as a sibling inside the fragment

## CSS Module Conventions & Custom Properties

### File naming

Each page has its own `[pageName].module.css` co-located in the same folder as `page.js`.

### Class naming

All class names are **camelCase** and descriptive of their role:

- Page root: `homePage`, `profilePage`
- Section wrapper: `topWrapper`, `aidWrapper`, `appList`
- Cards/rows: `topCard`, `topCardWrapper`
- Action bars: `topAction`
- Banners: `aidBanner`
- Buttons: `appButton`

### Custom properties (use these, never hardcode values)

| Token | Usage |
| --- | --- |
| `var(--primary)` | Main brand/header background color |
| `var(--secondary)` | Accent color (highlights, CTA backgrounds, value text) |
| `var(--fontsize-12)` | Extra small text |
| `var(--fontsize-13)` | Small label text |
| `var(--fontsize-14)` | Body / button label |
| `var(--fontsize-16)` | Banner heading |
| `var(--fontsize-18)` | Section title / card value |

### Layout patterns

- Use `box-sizing: border-box` on any element with explicit `width` + `padding`
- Use `width: 100%` for full-bleed sections (with `box-sizing: border-box`)
- Grids use `grid-template-columns: repeat(auto-fit, minmax(..., 1fr))` for responsive card rows
- Fixed icon grids use `grid-template-columns: repeat(4, 70px)` with `justify-content: center`
- Gaps between cards: `10px`; between section padding: `15px`–`30px`
- Rounded corners: `12px` for cards/banners, `999px` for pill buttons/badges

### Color usage

- Dark card background (inside primary header): `#134f3d`
- Muted label text inside cards: `#ccc`
- Page background: `#f5f7f6`
- Black CTA pill: `background-color: black; color: white`

## Component Patterns

### Top header section (`topWrapper`)

Full-bleed colored header. Always contains: an action row, a greeting `<h1>`, and a card grid.

```jsx
<section className={styles.topWrapper}>
  <div className={styles.topAction}>
    <button><svg .../></button>
    <button><svg .../></button>
  </div>
  <h1>Hello, Name</h1>
  <div className={styles.topCardWrapper}>
    <div className={styles.topCard}>
      <h1>Label<span>Value</span></h1>
    </div>
  </div>
</section>
```

**CSS pattern:** `background-color: var(--primary)`, `color: white`, flex column with `gap: 10px`. Card label text uses `color: #ccc`, value uses `color: var(--secondary)` and larger `font-size`.

---

### App icon grid (`appList`)

A 4-column icon launcher grid. Each button stacks an SVG icon above a text label.

```jsx
<section className={styles.appList}>
  <button className={styles.appButton}>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="50" height="50" fill="none">
      {/* icon shapes here */}
    </svg>
    <p>Label</p>
  </button>
</section>
```

**Icon style:** Custom 64×64 SVG. Use `fill="#ffd23f"` (yellow) for background shapes, `stroke="#0b3d2e"` (dark green) for outlines, `strokeWidth="3.5"`, `strokeLinecap="round"`, `strokeLinejoin="round"`.

---

### Banner section (`aidWrapper` / `aidBanner`)

A full-width promotional card with a heading, a pill CTA, and an absolutely-positioned illustration.

```jsx
<section className={styles.aidWrapper}>
  <a className={styles.aidBanner}>
    <h1>Banner heading text here</h1>
    <div>CTA Label</div>
    <Image
      src="/assets/icon/example.svg"
      alt="illustration"
      width={100}
      height={100}
    />
  </a>
</section>
```

**CSS pattern:** `position: relative`, `overflow: hidden` on `.aidBanner`. Image is `position: absolute; right: 0; top: 50%; transform: translateY(-20%) scale(1.5)`. CTA pill uses `border-radius: 999px`.

---

### Inline SVG icons (action buttons)

Action bar icons (profile, logout, etc.) use inline SVG from Heroicons, sized via a CSS class:

```jsx
<button>
  <svg
    className={styles.topActionLogo}  {/* controls width */}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="1.5"
    stroke="currentColor"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="..." />
  </svg>
</button>
```

Note: use the React prop `strokeWidth` (camelCase) — not `stroke-width`. Same for `strokeLinecap`, `strokeLinejoin`.

## Full Page Template

Copy this as the starting point for every new page.

### `page.js`

```jsx
import styles from "./[pageName].module.css";
import Image from "next/image";
import NavBar from "@/components/layout/NavBar";

export default function [PageName]Page() {
  return (
    <>
      <main className={styles.[pageName]Page}>

        {/* ── Section 1: Top Header ── */}
        <section className={styles.topWrapper}>
          <div className={styles.topAction}>
            <button>
              <svg className={styles.topActionLogo} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="..." />
              </svg>
            </button>
            <button>
              <svg className={styles.topActionLogo} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="..." />
              </svg>
            </button>
          </div>
          <h1>Hello, Name</h1>
          <div className={styles.topCardWrapper}>
            <div className={styles.topCard}>
              <h1>Metric Label<span>Value</span></h1>
            </div>
            <div className={styles.topCard}>
              <h1>Metric Label<span>Value</span></h1>
            </div>
          </div>
        </section>

        {/* ── Section 2: App Icon Grid ── */}
        <section className={styles.appList}>
          <button className={styles.appButton}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="50" height="50" fill="none">
              {/* icon paths */}
            </svg>
            <p>Label</p>
          </button>
          {/* repeat buttons... */}
        </section>

        {/* ── Section 3: Banner ── */}
        <section className={styles.aidWrapper}>
          <a className={styles.aidBanner}>
            <h1>Banner heading text</h1>
            <div>CTA Label</div>
            <Image src="/assets/icon/example.svg" alt="illustration" width={100} height={100} />
          </a>
        </section>

      </main>

      <NavBar />
    </>
  );
}
```

### `[pageName].module.css`

```css
/* ── Page root ── */
.pageNamePage {
  padding: 0 !important;
  background-color: #f5f7f6;
}

/* ── Section 1: Top wrapper ── */
.topWrapper {
  width: 100%;
  padding: 20px;
  box-sizing: border-box;
  background-color: var(--primary);
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: white;
}
.topAction {
  display: flex;
  justify-content: space-between;
}
.topActionLogo {
  width: 22px;
}
.topWrapper h1 {
  margin: 0 0 10px;
  font-size: var(--fontsize-18);
  font-weight: 600;
}
.topCardWrapper {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 10px;
}
.topCard {
  display: flex;
  align-items: center;
  gap: 5px;
  background-color: #134f3d;
  padding: 15px;
  box-sizing: border-box;
  border-radius: 12px;
}
.topCard h1 {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: var(--fontsize-13);
  font-weight: 500;
  color: #ccc;
  margin: 0;
}
.topCard h1 span {
  color: var(--secondary);
  font-size: var(--fontsize-18);
  font-weight: 700;
}

/* ── Section 2: App list ── */
.appList {
  box-sizing: border-box;
  width: 100%;
  padding: 30px 15px;
  display: grid;
  grid-template-columns: repeat(4, 70px);
  justify-content: center;
  gap: 15px;
}
.appButton {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1/1;
  gap: 5px;
}
.appButton p {
  font-size: var(--fontsize-14);
  font-weight: 600;
}

/* ── Section 3: Banner ── */
.aidWrapper {
  box-sizing: border-box;
  padding: 0 15px;
  width: 100%;
}
.aidBanner {
  position: relative;
  box-sizing: border-box;
  padding: 15px;
  border-radius: 12px;
  background-color: var(--secondary);
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
}
.aidBanner h1 {
  width: 60%;
  font-size: var(--fontsize-16);
}
.aidBanner div {
  width: fit-content;
  background-color: black;
  color: white;
  border-radius: 999px;
  padding: 8px 13px;
  font-weight: 500;
  font-size: var(--fontsize-12);
}
.aidBanner img {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-20%) scale(1.5);
}
```
