# Transaction Reader

A desktop application for maintaining a personal record of your spending
history. Import transaction data exported from Monarch Money, override or
curate any field while preserving the original record, and persist the
result to a file you own and control.

## Features

- **Import Monarch CSV exports.** Comma-separated files exported from
  Monarch Money are parsed, deduplicated against your current records,
  and merged in.
- **Override any field.** The original parsed row is preserved verbatim;
  the displayed and exported value comes from your override when one
  exists, otherwise from the original. Hover an overridden cell to see
  the original and remove the override.
- **Auto-ignore transfers.** On import, paired transactions that look
  like transfers between your own accounts are flagged as non-spending.
- **Pivot report.** Browse spending by category and month with row /
  column totals and per-month / per-year averages; click any cell to
  edit the transactions behind it.

## Download, Build, and Run

Prerequisites: [Node.js](https://nodejs.org/) 18 or later with npm.

```bash
# Clone the repository
git clone https://github.com/nebosite/Learning.git
cd Learning/claude/transaction-reader

# Install dependencies
npm install

# Build the application
npm run build

# Launch it
npm start
```

`npm run build` compiles the main, preload, and renderer bundles into
`out/`, and `npm start` runs Electron against that build. For
development with hot reload, use `npm run dev` instead of the
build/start pair.

## Getting started

1. **Open or import.** From the File menu choose **Open…** to load an
   existing transaction file, or click **Import** to merge a Monarch
   CSV export into the current records.
2. **Edit.** Click a cell to edit. Enter saves and advances to the
   next row's same field; Escape cancels; ↑/↓ abandon the edit and
   jump rows. Drag the small blue square in a cell's lower-right
   corner up or down to copy that cell's value into the spanned rows.
3. **Filter and sort.** Use the filter inputs above the grid to narrow
   the view; click the arrows in column headers to sort. Sorting and
   filtering carry over to the Report tab. The transaction grid
   doesn't re-sort on edits — press the **⟳** Resort button when you
   want it to.
4. **Save.** Press Ctrl+S or use **File > Save** / **Save As…**. The
   title bar shows the current file and prepends `*` while there are
   unsaved changes.

## Categories

The Settings tab manages your custom category list. New categories
typed into the grid are added automatically. While editing a category
cell, a dropdown predicts a match against the custom list using
substring matching (case-insensitive).

## File format

Master files are JSON with a versioned envelope; the shape is defined
in `src/shared/types.ts`. Re-importing the same CSV is idempotent —
records are keyed on the original line text and not duplicated.

## Development

| Command            | Purpose                              |
| ------------------ | ------------------------------------ |
| `npm run dev`      | Start the app in development mode    |
| `npm run build`    | Compile and bundle for production    |
| `npm run lint`     | Run ESLint                           |
| `npm run typecheck`| `tsc --noEmit`                       |
| `npm test`         | Run the unit tests                   |
