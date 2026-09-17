# AGENTS.md — Astryon Codebase Guide

This is the marketing-site project inside the Astryon monorepo. Before changing code, read the repository-level [`../AGENTS.md`](../AGENTS.md), the documentation map in [`../docs/README.md`](../docs/README.md), and this file. The application project has separate instructions at [`../app/AGENTS.md`](../app/AGENTS.md); do not assume its APIs or runtime rules apply unchanged here.

## Stack Overview

- **Next.js 16** (App Router, server components by default)
- **React 19**
- **TypeScript 5** — strict mode enabled
- **Tailwind CSS v4** — loaded via `@import "tailwindcss"` in CSS, configured through `@tailwindcss/postcss`
- **ESLint 9** — flat config (`eslint.config.mjs`) with `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`
- No test framework is installed; add Vitest or Jest if tests are required

---

## Build / Lint / Dev Commands

```bash
npm run dev       # Start Next.js dev server (http://localhost:3000)
npm run build     # Production build — must pass before merge
npm run start     # Serve production build
npm run lint      # Run ESLint across the project
```

### Type-checking (no dedicated script — use tsc directly)
```bash
npx tsc --noEmit   # Full type-check; run after significant changes
```

### No tests yet
There is no test runner configured. If you add tests:
- Prefer **Vitest** (aligns with modern Next.js setups)
- Single test: `npx vitest run path/to/file.test.ts`

---

## Project Structure

```
astryon/
├── app/                  # Next.js App Router — all routes live here
│   ├── layout.tsx        # Root layout (fonts, global metadata)
│   ├── page.tsx          # Home page ( / )
│   └── globals.css       # Global styles + Tailwind import
├── public/               # Static assets served at /
├── next.config.ts        # Next.js configuration
├── tsconfig.json         # TypeScript config (strict, paths alias @/*)
├── eslint.config.mjs     # ESLint flat config
└── postcss.config.mjs    # PostCSS → @tailwindcss/postcss
```

### Path aliases
`@/*` resolves to the project root (defined in `tsconfig.json`). Always prefer it over relative imports that go up more than one level.

```ts
import { Button } from "@/components/Button";  // ✅
import { Button } from "../../components/Button"; // ❌ avoid
```

---

## TypeScript Guidelines

- **Strict mode is on** — never disable it or suppress errors with `as any`, `@ts-ignore`, or `@ts-expect-error`.
- Use `import type { ... }` for type-only imports:
  ```ts
  import type { Metadata } from "next";  // ✅
  import { Metadata } from "next";        // ❌
  ```
- Prefer `interface` for object shapes that may be extended; use `type` for unions, intersections, and aliases.
- Avoid explicit `React.FC` — just type props inline:
  ```ts
  export default function MyComponent({ label }: { label: string }) { ... }
  ```
- Use `Readonly<{ ... }>` for prop types that should not be mutated (see `layout.tsx`).

---

## Code Style

### Formatting
- **2-space indentation**
- **Double quotes** for strings in TypeScript/TSX (enforced by ESLint config)
- Trailing commas in multi-line structures
- Semicolons **omitted** (no semicolons — verify against existing files)
- Keep lines under ~100 characters where practical

### Imports order (ESLint enforced by next config)
1. External packages (`react`, `next`, third-party)
2. Internal modules via `@/` alias
3. Relative imports (`./`, `../`)
4. Type-only imports (grouped with their source or at the end)

### Naming conventions
| Entity | Convention | Example |
|---|---|---|
| Components | PascalCase | `UserCard`, `NavBar` |
| Functions / hooks | camelCase | `fetchUser`, `useAuth` |
| Constants | SCREAMING_SNAKE or camelCase | `MAX_RETRIES`, `defaultTimeout` |
| Files (components) | PascalCase `.tsx` | `UserCard.tsx` |
| Files (utilities) | camelCase `.ts` | `formatDate.ts` |
| CSS variables | kebab-case | `--color-background` |

---

## Next.js App Router Conventions

- **Server Components by default** — do not add `"use client"` unless the component requires browser APIs, event handlers, or React state/effects.
- **`"use client"` placement** — add it at the very top of the file, before all imports.
- **Metadata** — export a `metadata` const (or `generateMetadata` function) from page/layout files:
  ```ts
  export const metadata: Metadata = { title: "...", description: "..." };
  ```
- **Layouts** — wrap shared UI (fonts, nav, providers) in `layout.tsx`; do not repeat in individual pages.
- **Fonts** — use `next/font/google` with CSS variable output (see `layout.tsx`). Apply via className, not inline styles.

---

## Tailwind CSS (v4)

- Import via `@import "tailwindcss"` at the top of `globals.css` (v4 syntax — no `@tailwind base/components/utilities` directives).
- Theme tokens are defined with `@theme inline { ... }` in `globals.css`.
- Use CSS variables for semantic colors (`--background`, `--foreground`) rather than hard-coded values.
- **Dark mode**: rely on `@media (prefers-color-scheme: dark)` + CSS variables (system preference, no class toggle).
- Compose utility classes in JSX — avoid inline `style` props.

---

## Error Handling

- Never swallow errors with empty `catch` blocks.
- In Server Components / Route Handlers, use `error.tsx` boundary files for page-level errors.
- Surface actionable messages to users; log technical details server-side only.
- Validate inputs at the boundary (form submissions, API routes) before processing.

---

## Pre-commit Checklist

Before marking work done, verify:

1. `npx tsc --noEmit` — zero type errors
2. `npm run lint` — zero lint errors (warnings must be justified)
3. `npm run build` — production build succeeds
4. No `as any`, `@ts-ignore`, or `@ts-expect-error` introduced
5. No `console.log` left in committed code (use proper logging or remove)
6. New components follow existing naming and file structure conventions

## Deployment pointers

The Vercel project for this directory must use `web` as its Root Directory. Production deployment, shared environment variables, DNS, and beta-signup behavior are documented in [`../docs/DEPLOYMENT_HANDOFF.md`](../docs/DEPLOYMENT_HANDOFF.md). Review known risks in [`../docs/REVIEW_NOTES.md`](../docs/REVIEW_NOTES.md).
