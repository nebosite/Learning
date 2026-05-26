# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Electron desktop application built with React and TypeScript. Its purpose is to maintain a consistent personal record of spending history: ingest transaction exports from Monarch Money, let the user curate and override fields, and persist the result.

### Purpose

Create a consistent record of the user's spending history that the user owns and controls.

### Scope

In scope: spending from
- **Checking accounts**
- **Credit cards**
- **Digital payment methods** (PayPal, Venmo, etc.)

Out of scope: savings accounts, installment debt, investment accounts.

### Core Capabilities

1. **Load Monarch Money exports.** Files are comma-separated (`.csv`, RFC 4180). See `sampledata.csv` at the repo root for an example of the columns and shape.
2. **Override model.** The original parsed record is preserved verbatim. The user can override any field on any record. The displayed/exported value of a field comes from the override if one exists, otherwise from the original.
3. **Auto-ignore non-spending.** Transfers between the user's own accounts (a withdrawal on one account paired with an equal deposit on another within a few days) are detected and excluded from the spending view automatically.
4. **Editable grid.** Transactions are shown in a large scrollable grid. The user can edit any field (creating an override) and toggle ignore/unignore on any record.
5. **Save with dirty indicator.** A Save button persists changes. The UI clearly indicates when there are unsaved changes ("dirty" state).

## Tech Stack

- **Electron** — desktop shell; main process handles file I/O and IPC
- **React** — UI layer rendered in the Electron renderer process
- **TypeScript** — used in both main and renderer processes
- **Vite** — bundler for the renderer process (preferred; use `electron-vite` for unified config)

## Project Structure Convention

```
src/
  main/        # Electron main process (Node.js context)
  renderer/    # React app (browser context)
  shared/      # Types and utilities shared between main and renderer
```

IPC between main and renderer is done via `contextBridge` / `ipcMain` / `ipcRenderer` — never expose raw Node APIs directly to the renderer.

## Key Commands

```bash
npm run dev        # Start Electron app in development mode (hot reload)
npm run build      # Compile TypeScript and bundle for production
npm run lint       # Run ESLint across src/
npm run typecheck  # Run tsc --noEmit to check types without emitting
npm test           # Run test suite (vitest)
npm start          # Run the built app via electron .
```

## Testing

Every component and every non-trivial pure module should have tests in a
sibling `*.test.ts` / `*.test.tsx` file. The bar is "would I notice if this
broke without clicking through the app" — bias toward tests for date math,
parsers, reducers, sort/filter predicates, edit-mode behavior, and selection
state machines.

- **Main / shared / pure logic**: vitest in the default `node` environment.
  Examples: `csv.test.ts`, `merge.test.ts`, `sort.test.ts`, `filter.test.ts`,
  `virtual.test.ts`.
- **React components**: vitest in `jsdom` with `@testing-library/react`. The
  glob `src/renderer/**` is mapped to jsdom in `vitest.config.ts`; the global
  setup (`src/test-setup.ts`) loads `@testing-library/jest-dom` matchers,
  stubs `window.api` per test, and runs `cleanup()` between tests.
- **Where pure logic lives inside a component file**, export it so tests can
  exercise it directly (see `defaultSpendingWindow`, `monthsInWindow`, the
  budget `moveRow` / `updateCell` helpers). Add the component-level test
  on top of that, scoped to behaviors that only exist when the React glue
  is present (edit-and-advance, selection, drag handlers).

When adding a new component, add at least a smoke test that renders it with
representative props and asserts one observable behavior. When fixing a
component bug, add the regression test first.

## Architecture Notes

### Data Flow

1. User selects a Monarch Money CSV export via a file picker (renderer triggers IPC call)
2. Main process reads and parses the CSV
3. Main process merges incoming transactions into the master record set, deduplicating against existing records
4. Transfer detection flags non-spending records as auto-ignored
5. The merged dataset is returned to the renderer for display and editing in the grid
6. User edits accumulate as overrides and ignore toggles in renderer state until Save is pressed; Save sends changes back to the main process to persist

### Process Boundary

- File I/O, CSV parsing, master-file persistence, deduplication, and transfer detection live in the **main process** (`src/main/`)
- Display logic, editing, dirty-state tracking, and user interaction live in the **renderer** (`src/renderer/`)
- Shared TypeScript types for transactions and IPC payloads live in **`src/shared/`**

### Record Model (high level)

Each record is two-layered:

- **original** — the immutable parsed row from Monarch
- **overrides** — a partial map of user-supplied values that shadow the original on a per-field basis
- **ignored** — whether the record is excluded from the spending view. Set once at import time (transfer detection runs only on freshly-imported records) and freely toggleable by the user thereafter.

The exact type shape lives in [src/shared/types.ts](src/shared/types.ts) and is the canonical definition.

### Deduplication

Repeated downloads from Monarch must merge incrementally without creating duplicates. Transactions are keyed on a stable composite (the exact field set is defined alongside the types in `src/shared/`). Fields that Monarch may re-categorize after the fact (e.g., merchant, category) should not be part of the key.

### Transfer Detection

A record is auto-ignored when it pairs with another record where the amounts are equal in magnitude and opposite in sign, the accounts differ, and the dates fall within a small window. The pairing logic should err on the side of caution — better to leave a real transfer un-flagged than to wrongly hide spending.

### Master Transaction File

The canonical persisted format should be defined in `src/shared/types.ts`. Keep it stable — downstream consumers (spreadsheets, scripts) depend on its shape. Schema changes should be versioned and migrated, not silently altered.

### Persistence and backups

All on-disk writes go through `src/main/atomic-write.ts`, which exposes three
helpers; pick the one whose backup cadence matches the file's write cadence.

**Generational, sortable, never deleted.** Every backup file lives at
`<path>.<stamp>.bak` where `<stamp>` is a Windows-safe,
lexicographically-sortable ISO timestamp (e.g.
`master.json.2026-05-26T10-15-30-123.bak`). Listing the directory and sorting
the names sorts them chronologically. Pruning is intentionally not done in
the atomic-write layer — if disk usage becomes a concern, add a trim pass
inside `atomic-write.ts` rather than spreading retention logic across
callers.

**Helpers:**

- `saveAtomic(path, content)` — atomic write (tmp + rename), no backup.
- `saveWithBackup(path, content)` — atomic write, AND move the previous
  canonical file to a timestamped `.bak` before promoting the new content.
  Use when every save deserves to be preserved.
- `backupCurrent(path)` — snapshot the existing canonical file as a
  timestamped `.bak` *without changing it*. Returns the backup path (or
  `null` if there was nothing to back up). Use when the backup cadence is
  decoupled from the write cadence.

**Per-file policy:**

- **Master file** (`master.json`): `saveWithBackup` on every save. Each user
  Save / Save As preserves the prior version.
- **Settings file** (`settings.json`): `saveAtomic` on every change (writes
  are frequent — every category edit, window resize, last-opened-path
  update). The main process tracks a `settingsDirty` flag and calls
  `backupCurrent` only on window **blur** and on **close approval**, so the
  settings backup chain reflects user-visible "sessions of activity" rather
  than every keystroke.

**Recovery convention**: list the directory, sort, pick the `.bak` you want
(newest is alphabetically last), and rename it over the canonical path.

Any new persistence should route through these helpers rather than calling
`fs.writeFile` directly.
