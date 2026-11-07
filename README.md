# ZipyZee web

The web version of the ZipyZee app. Next.js 16 + Tailwind 4; tools run in the browser.

```bash
npm install
npm run dev        # http://localhost:3000 (redirects to /en or /ur)
npm test           # vitest: i18n keys + tool handlers
npx tsc --noEmit && npx eslint src __tests__
npm run build && npm start
```

Read `CLAUDE.md` (rules, what's shared with the app) and `docs/WEB_PLAN.md` (what's done, what's next).
