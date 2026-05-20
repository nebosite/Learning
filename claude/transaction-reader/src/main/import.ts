import { readFile } from 'fs/promises'
import type { ImportResult, MasterFile } from '../shared/types'
import { sortRecordsByDateDescending } from '../shared/records'
import { parseMonarchTsv } from './tsv'
import { mergeIntoMaster } from './merge'
import { detectTransfers } from './transfer-detection'

export type { ImportResult }

/**
 * Parse a Monarch TSV file and merge its rows into the given in-memory master,
 * running transfer detection on the newly-added records. Returns the merged
 * master and import counts; persistence is the caller's responsibility.
 *
 * Whole-file problems (empty file, missing required column, I/O errors)
 * propagate as exceptions. Per-row parse problems are collected in
 * `parseErrors` so the rest of the import still succeeds.
 */
export async function importTsvFile(
  filePath: string,
  existing: MasterFile,
): Promise<ImportResult> {
  const text = await readFile(filePath, 'utf8')
  const { rows, errors: parseErrors } = parseMonarchTsv(text)

  const merged = mergeIntoMaster(existing, rows)
  const detection = detectTransfers(merged.added, existing.records)

  const finalMaster: MasterFile = {
    version: existing.version,
    records: sortRecordsByDateDescending([...existing.records, ...detection.fresh]),
  }

  return {
    master: finalMaster,
    added: detection.fresh.length,
    skipped: merged.skipped.length,
    autoIgnored: detection.fresh.filter((r) => r.ignored).length,
    parseErrors,
  }
}
