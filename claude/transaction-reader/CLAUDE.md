# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Electron desktop application built with React and TypeScript. Its purpose is to ingest transaction CSV files exported from Monarch Money and merge/normalize them into a single, persistent "master" transaction file. The app handles deduplication so that repeated downloads from Monarch can be applied incrementally without creating duplicates.

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
npm test           # Run test suite
npm run test:unit <path>  # Run a single test file
```

## Architecture Notes

### Data Flow

1. User selects a Monarch Money CSV export via a file picker (renderer triggers IPC call)
2. Main process reads and parses the CSV
3. Main process compares incoming transactions against the master transaction file (stored locally as JSON or CSV)
4. Deduplication runs before merging — transactions are keyed on `(date, amount, merchant, account)` or a similar stable composite key
5. Merged result is written back to the master file and returned to the renderer for display

### Process Boundary

- File I/O, CSV parsing, and master-file persistence live in **main process** (`src/main/`)
- All display logic and user interaction live in the **renderer** (`src/renderer/`)
- Shared TypeScript types for transactions and IPC payloads live in **`src/shared/`**

### Master Transaction File

The canonical output format should be defined in `src/shared/types.ts`. Keep it stable — downstream consumers (spreadsheets, scripts) depend on its shape. Schema changes should be versioned and migrated, not silently altered.
