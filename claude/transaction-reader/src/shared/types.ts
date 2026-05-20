export type Amount = number

/** ISO 8601 date string (YYYY-MM-DD). */
export type IsoDate = string

/** Parsed columns of a Monarch Money transaction row, mirroring the export header. */
export interface OriginalTransaction {
  date: IsoDate
  merchant: string
  category: string
  account: string
  originalStatement: string
  notes: string
  amount: Amount
  tags: string
  owner: string
}

/** User-supplied overrides. A missing key means "use the original value". */
export type TransactionOverrides = Partial<OriginalTransaction>

/**
 * One row in the master file.
 *
 * `key` is the verbatim TSV line text from the source file and serves as the
 * dedup identity — re-importing the same export produces identical keys.
 *
 * `ignored` is set once: transfer detection runs on freshly-imported records
 * only, never re-evaluates existing records, and the user can toggle it
 * freely after that.
 */
export interface TransactionRecord {
  key: string
  original: OriginalTransaction
  overrides: TransactionOverrides
  ignored: boolean
}

/** Persisted shape of the master file. Versioned so schema changes can be migrated. */
export interface MasterFile {
  version: 1
  records: TransactionRecord[]
}

/** A row that could not be parsed from a TSV import. */
export interface ParseError {
  /** 1-based line number in the source text, matching what an editor would show. */
  lineNumber: number
  raw: string
  reason: string
}

/** Outcome of a single TSV import, returned to the renderer for UI feedback. */
export interface ImportResult {
  master: MasterFile
  added: number
  skipped: number
  autoIgnored: number
  parseErrors: ParseError[]
}

/** Persisted window size in pixels. */
export interface WindowSize {
  width: number
  height: number
}

/**
 * App settings, persisted in their own file independently of the transaction
 * master file. Versioned so the schema can be migrated.
 */
export interface Settings {
  version: 1
  categories: string[]
  /** Last window size. Absent until the window has been resized at least once. */
  window?: WindowSize
}

/** Commands the application menu sends from the main process to the renderer. */
export type MenuCommand = 'new' | 'open' | 'save' | 'save-as' | 'help'

/** User's reply to the "save before losing changes?" prompt. */
export type DiscardChoice = 'save' | 'discard' | 'cancel'

export interface ElectronApi {
  /**
   * Open a file picker for a Monarch TSV export and merge it into the given
   * records. Returns the merged result, or null if the dialog was cancelled.
   * The renderer is responsible for persisting (no disk write happens here).
   */
  importTsv: (
    currentRecords: readonly TransactionRecord[],
  ) => Promise<ImportResult | null>

  /** Show a native open-file dialog; resolves to the chosen path or null. */
  showOpenDialog: () => Promise<string | null>
  /** Show a native save-as dialog; resolves to the chosen path or null. */
  showSaveDialog: (defaultName?: string) => Promise<string | null>
  /** Read a master file from disk. */
  readMasterFile: (path: string) => Promise<MasterFile>
  /** Write the records (sorted, in a versioned envelope) to disk. */
  writeMasterFile: (
    path: string,
    records: readonly TransactionRecord[],
  ) => Promise<void>
  /** Show the unsaved-changes prompt (Save / Don't Save / Cancel). */
  confirmDiscard: () => Promise<DiscardChoice>
  /** Read the bundled README.md (markdown source) for in-app help. */
  readReadme: () => Promise<string>

  /**
   * Subscribe to File-menu commands from the main process. Returns an
   * unsubscribe function.
   */
  onMenuCommand: (callback: (command: MenuCommand) => void) => () => void
  /**
   * Subscribe to a close request from the main process. The renderer must
   * eventually call `approveClose` (after any confirm/save flow) for the
   * window to actually close. Returns an unsubscribe function.
   */
  onCloseRequest: (callback: () => void) => () => void
  /** Tell the main process it is now safe to close the window. */
  approveClose: () => void

  /** Read app settings (returns defaults on first run). */
  loadSettings: () => Promise<Settings>
  /** Persist the custom-category list. Other settings fields are left untouched. */
  saveCategories: (categories: string[]) => Promise<void>
}

declare global {
  interface Window {
    api: ElectronApi
  }
}
