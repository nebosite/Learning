import { readFile } from 'fs/promises'
import type { Settings } from '../shared/types'
import { saveAtomic } from './atomic-write'

const CURRENT_VERSION = 1

/**
 * Read the settings file from disk. Returns defaults if the file does not
 * exist (first-run case). Other I/O errors propagate. Throws with a clear
 * message if the file is present but unparseable or in the wrong shape.
 */
export async function loadSettings(path: string): Promise<Settings> {
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch (e) {
    if (isNodeFsError(e) && e.code === 'ENOENT') {
      return { version: CURRENT_VERSION, categories: [] }
    }
    throw e
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    throw new Error(`Settings file at ${path} is not valid JSON: ${reason}`)
  }

  if (!isSettingsShape(parsed)) {
    throw new Error(`Settings file at ${path} is not in the expected shape.`)
  }
  if (parsed.version !== CURRENT_VERSION) {
    throw new Error(
      `Settings file at ${path} has version ${parsed.version}; this app expects version ${CURRENT_VERSION}.`,
    )
  }
  return parsed
}

/**
 * Write the settings file atomically. No backup is created here; the main
 * process snapshots the settings file on blur / close (see `backupCurrent`).
 */
export async function saveSettings(path: string, settings: Settings): Promise<void> {
  await saveAtomic(path, JSON.stringify(settings, null, 2))
}

function isNodeFsError(e: unknown): e is NodeJS.ErrnoException {
  return e instanceof Error && 'code' in e
}

function isSettingsShape(v: unknown): v is Settings {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  if (typeof obj.version !== 'number') return false
  if (
    !Array.isArray(obj.categories) ||
    !obj.categories.every((c) => typeof c === 'string')
  ) {
    return false
  }
  if (obj.window !== undefined) {
    if (typeof obj.window !== 'object' || obj.window === null) return false
    const w = obj.window as Record<string, unknown>
    if (typeof w.width !== 'number' || typeof w.height !== 'number') return false
  }
  if (obj.lastOpenedPath !== undefined && typeof obj.lastOpenedPath !== 'string') {
    return false
  }
  return true
}
