import { readFile } from 'fs/promises'
import type { MasterFile } from '../shared/types'
import { saveWithBackup } from './atomic-write'

const CURRENT_VERSION = 1

/**
 * Read the master file from disk. Returns an empty master if the file does
 * not exist (first-run case). Other I/O errors propagate. Throws with a
 * clear message if the file is present but unparseable or in the wrong shape.
 */
export async function loadMasterFile(path: string): Promise<MasterFile> {
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch (e) {
    if (isNodeFsError(e) && e.code === 'ENOENT') {
      return { version: CURRENT_VERSION, records: [] }
    }
    throw e
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    throw new Error(`Master file at ${path} is not valid JSON: ${reason}`)
  }

  if (!isMasterFileShape(parsed)) {
    throw new Error(`Master file at ${path} is not in the expected shape.`)
  }
  if (parsed.version !== CURRENT_VERSION) {
    throw new Error(
      `Master file at ${path} has version ${parsed.version}; this app expects version ${CURRENT_VERSION}.`,
    )
  }
  return parsed
}

/**
 * Write the master file atomically and keep the prior version in a `.bak`
 * sidecar. See `saveWithBackup` for the exact sequence.
 */
export async function saveMasterFile(path: string, file: MasterFile): Promise<void> {
  await saveWithBackup(path, JSON.stringify(file, null, 2))
}

function isNodeFsError(e: unknown): e is NodeJS.ErrnoException {
  return e instanceof Error && 'code' in e
}

function isMasterFileShape(v: unknown): v is MasterFile {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  if (typeof obj.version !== 'number' || !Array.isArray(obj.records)) return false
  // `budgets` is optional; if present it must be an array. Older files written
  // before budgets existed simply omit the field.
  return obj.budgets === undefined || Array.isArray(obj.budgets)
}
