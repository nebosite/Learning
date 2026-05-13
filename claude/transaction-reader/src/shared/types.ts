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

export interface ElectronApi {
  openTsvDialog: () => Promise<string | null>
}

declare global {
  interface Window {
    api: ElectronApi
  }
}
