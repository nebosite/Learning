import type { MasterFile, TransactionRecord } from '../shared/types'
import { canonicalRecordKey, sortRecordsByDateDescending } from '../shared/records'
import type { ParsedRow } from './csv-format'

export interface MergeResult {
  master: MasterFile
  added: TransactionRecord[]
  skipped: ParsedRow[]
}

/**
 * Merge freshly-parsed rows into an existing master.
 *
 * Dedup is count-matched on the canonical record key (see
 * `canonicalRecordKey`): if the master already holds N records with a given
 * key, the first N incoming rows with that key are skipped; any beyond that
 * are added as new records. This keeps "re-import the same file" idempotent
 * while preserving legitimate duplicates that appear inside a single export.
 *
 * The input master is not mutated. The returned master's records are sorted
 * by effective date (overrides.date ?? original.date), newest first.
 */
export function mergeIntoMaster(
  master: MasterFile,
  parsed: readonly ParsedRow[],
): MergeResult {
  const remainingByKey = new Map<string, number>()
  for (const record of master.records) {
    remainingByKey.set(record.key, (remainingByKey.get(record.key) ?? 0) + 1)
  }

  const added: TransactionRecord[] = []
  const skipped: ParsedRow[] = []

  for (const row of parsed) {
    const key = canonicalRecordKey(row.parsed)
    const count = remainingByKey.get(key) ?? 0
    if (count > 0) {
      remainingByKey.set(key, count - 1)
      skipped.push(row)
    } else {
      added.push({
        key,
        original: row.parsed,
        overrides: {},
        ignored: false,
      })
    }
  }

  const combined = sortRecordsByDateDescending([...master.records, ...added])

  return {
    master: { version: master.version, records: combined },
    added,
    skipped,
  }
}
