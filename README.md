# Team Status Calendar 2026

A Vite + React project ready for deployment to Vercel.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Notes

- Data persistence uses browser `localStorage` with the key `team-calendar-overrides-2026`.
- This means changes persist on the same device/browser, but are not shared across users.
- To reset demo data, use the built-in "恢复默认数据" button.

## Deploy to Vercel

- Import this folder into GitHub or upload it directly to Vercel.
- Framework preset: **Vite**
- Build command: `npm run build`
- Output directory: `dist`
