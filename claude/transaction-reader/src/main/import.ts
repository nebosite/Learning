import { readFile } from 'fs/promises'
import type { MasterFile } from '../shared/types'
import { sortRecordsByDateDescending } from '../shared/records'
import { parseMonarchTsv, type ParseError } from './tsv'
import { loadMasterFile, saveMasterFile } from './master-file'
import { mergeIntoMaster } from './merge'
import { detectTransfers } from './transfer-detection'

export interface ImportResult {
  master: MasterFile
  added: number
  skipped: number
  autoIgnored: number
  parseErrors: ParseError[]
}

/**
 * End-to-end import: read and parse a Monarch TSV file, merge the parsed
 * rows into the master, run transfer detection on the newly-added records,
 * persist the updated master, and return counts for the UI.
 *
 * Whole-file problems (empty file, missing required column, I/O errors,
 * malformed master) propagate as exceptions. Per-row parse problems are
 * collected in `parseErrors` so the rest of the import still succeeds.
 */
export async function importTsvFile(
  filePath: string,
  masterPath: string,
): Promise<ImportResult> {
  const text = await readFile(filePath, 'utf8')
  const { rows, errors: parseErrors } = parseMonarchTsv(text)

  const existing = await loadMasterFile(masterPath)
  const merged = mergeIntoMaster(existing, rows)
  const detection = detectTransfers(merged.added, existing.records)

  const finalMaster: MasterFile = {
    version: existing.version,
    records: sortRecordsByDateDescending([...existing.records, ...detection.fresh]),
  }
  await saveMasterFile(masterPath, finalMaster)

  return {
    master: finalMaster,
    added: detection.fresh.length,
    skipped: merged.skipped.length,
    autoIgnored: detection.fresh.filter((r) => r.ignored).length,
    parseErrors,
  }
}
