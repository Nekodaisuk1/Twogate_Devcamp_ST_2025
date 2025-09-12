
# Frontend skeleton (Next.js App Router, TS)

This is a minimal UI scaffold designed to work with your current backend.

## Setup
1. Create a Next.js app or use an existing one. Copy `app/`, `components/`, and `lib/` into your project root.
2. Install deps:
   ```bash
   npm i @tanstack/react-query zustand
   ```
3. Create `.env.local`:
   ```env
   NEXT_PUBLIC_API_BASE=http://localhost:3001
   ```
4. Run:
   ```bash
   npm run dev
   ```

## What works
- Layout with fixed Sidebar + Topbar
- Grid page: list & create notes (title + optional content), open modal to view/edit/delete
- Graph page: fetches `/api/graph` JSON; search funnels results into sidebar

## Where to edit
- API paths: `lib/data/NotesRepo.ts`
- UI state:   `lib/stores/useUiStore.ts`
- Sidebar UI: `components/SidebarView.tsx` (+ .module.css)
- Topbar UI:  `components/Topbar.tsx`
