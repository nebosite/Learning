import { readFile } from 'fs/promises'
import type { ImportResult, MasterFile } from '../shared/types'
import { sortRecordsByDateDescending } from '../shared/records'
import { parseMonarchCsv } from './csv'
import { looksLikeAmazonCsv, parseAmazonCsv } from './amazon'
import { mergeIntoMaster } from './merge'
import { detectTransfers } from './transfer-detection'

export type { ImportResult }

/**
 * Parse a CSV file and merge its rows into the given in-memory master,
 * running transfer detection on the newly-added records. Returns the merged
 * master and import counts; persistence is the caller's responsibility.
 *
 * The format (Monarch Money export vs Amazon History Reporter export) is
 * detected from the header row, so the user just picks the file.
 *
 * Whole-file problems (empty file, missing required column, I/O errors)
 * propagate as exceptions. Per-row parse problems are collected in
 * `parseErrors` so the rest of the import still succeeds.
 */
export async function importCsvFile(
  filePath: string,
  existing: MasterFile,
): Promise<ImportResult> {
  const text = await readFile(filePath, 'utf8')
  const headerLine = text.split(/\r?\n/, 1)[0] ?? ''
  const { rows, errors: parseErrors } = looksLikeAmazonCsv(headerLine)
    ? parseAmazonCsv(text)
    : parseMonarchCsv(text)

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
