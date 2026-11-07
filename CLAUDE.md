@AGENTS.md

# ZipyZee web (zipyzee-web)

The web version of the ZipyZee Android app (`../ZipyZee`): the same tools, copy, Urdu and lime look, as a Next.js site.
Files are processed in the browser and never uploaded (same promise as the app's on-phone tools). Plan and status:
`docs/WEB_PLAN.md`.

## Stack

- Next.js 16 (App Router, Turbopack, `cacheComponents` on), React 19, TypeScript, Tailwind CSS 4. Read
  `node_modules/next/dist/docs/` before using a Next API (AGENTS.md): this version differs from older ones
  (`proxy.ts` not middleware, `params` is a Promise, no `dynamicParams` with cacheComponents: call `notFound()`).
- Icons: `lucide-react` (same names as the app's lucide-react-native). PDF: `pdf-lib`. Images: canvas
  (`src/lib/image.ts`). Tests: `vitest`.

## Shared with the app (keep in step)

| Web | App | How |
| --- | --- | --- |
| `src/tools/registry.ts` | `src/tools/registry.ts` | generated: getters → plain English keys. Same ids, order, copy |
| `src/i18n/ur.ts` | `src/i18n/ur.ts` | exact copy. Web-only text goes in `src/i18n/urWeb.ts` |
| `src/tools/pdfOps.ts`, `ranges.ts`, `organize.ts`, `pdfWatermark.ts`, `image/sizes.ts` | same paths | exact copies (pure) |
| `src/app/globals.css` tokens | `src/theme/tokens.ts` | light + dark values as CSS variables |
| `src/tools/options.ts` | `src/tools/options/index.ts` | labels copied exactly, as English keys |

When a copied file changes in the app, copy it again; don't fork it here.

## Rules

- Every page is under `src/app/[lang]/` (`en`, `ur`). `src/proxy.ts` sends `/` and any path without a language to
  the saved (`lang` cookie) or browser language. Urdu = `dir="rtl"` on `<html>`; arrows and chevrons get `flip-rtl`;
  use logical classes (`ms-`, `pe-`, `start-`), never `ml-` / `left-`.
- Text: English is the key. Server Components and pages: `tr(lang, '...')`. Client Components: `useT()` from
  `@/i18n/client`. Browser-only code (handlers, pdfOps): `t()` from `@/i18n`. Data files (registry, options,
  categories) hold English keys; translate where shown. `__tests__/i18n.test.ts` fails when a key has no Urdu.
- Colours: never hard-code. Tailwind names from `@theme` in globals.css (`bg-surface`, `text-secondary`, `bg-ink`,
  `text-primary`...) or `var(--x)`. `.card`, `.lime-fill`, `.lime-glow` are the app's Card, LimeFill and Screen glow.
  Dark theme = `data-theme` on `<html>` (or the system), set before paint by the inline script in the layout.
- Shapes: cards 24 (`rounded-card` / `.card`), rows 20 (`rounded-row`), tiles 16 (`rounded-tile`), buttons pills.
  Reuse `components/ui/Button` and `components/flow/OptionFields`; extend them instead of styling inline.
- Accessibility: icon-only buttons get a translated `aria-label`; status and errors use `role="status"` / `"alert"`;
  everything works with the keyboard.
- Layout works from 360 px wide (16 px side gutter) up to desktop.

### Adding a web tool

1. Its option config in `src/tools/options.ts` (copy the app's labels exactly) and its `ACCEPT` if the input is new.
2. A handler in `src/tools/handlers/` (`ToolHandler`: `stepper(ctx)` for progress + cancel, `ToolError` for messages,
   returns `{ title, subtitle, files: [{ name, blob }] }` with the app's result title and file names).
3. Register it in `handlers/index.ts` and add the id to `handlers/ids.ts` (that marks it `web` in the registry).
4. A test in `__tests__/` when it has logic of its own.

## After each change

`npx tsc --noEmit`, `npx eslint src __tests__`, `npm test`, and `npx next build` for route or config changes. Then
list what to check in the browser (English + Urdu, light + dark, phone width + desktop).
