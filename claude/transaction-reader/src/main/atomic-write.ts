import { access, copyFile, mkdir, rename, writeFile } from 'fs/promises'
import { dirname } from 'path'

/**
 * Build the timestamped backup path for `path`. The timestamp is ISO-8601 with
 * colons and the millisecond dot replaced by dashes, so the result is
 * filesystem-safe on Windows AND lexicographically sortable (i.e. listing the
 * directory with .sort() yields chronological order).
 *
 *   master.json   ->   master.json.2026-05-26T10-15-30-123.bak
 */
export function timestampedBackupPath(path: string, now: Date = new Date()): string {
  const stamp = now
    .toISOString()
    .replace(/:/g, '-')
    .replace(/\.(\d{3})Z$/, '-$1')
  return `${path}.${stamp}.bak`
}

/**
 * Atomically write `content` to `path`. No backup is created — the previous
 * canonical file (if any) is simply replaced by an atomic rename.
 *
 *   1. Write the new content to `<path>.tmp`.
 *   2. Rename `<path>.tmp` to `<path>`.
 *
 * A crash before step 2 leaves the canonical file untouched and at worst
 * orphans `<path>.tmp`.
 */
export async function saveAtomic(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const tmpPath = `${path}.tmp`
  await writeFile(tmpPath, content, 'utf8')
  await rename(tmpPath, path)
}

/**
 * Like `saveAtomic` but also preserves the previous version under a
 * timestamped `<path>.<stamp>.bak` sidecar before overwriting. Backups are
 * generational — every call keeps the prior file, none are deleted.
 *
 *   1. Write the new content to `<path>.tmp`.
 *   2. If `<path>` exists, rename it to `<path>.<stamp>.bak`.
 *   3. Rename `<path>.tmp` to `<path>`.
 *
 * A crash between steps 2 and 3 leaves `<path>.tmp` (new) and the fresh
 * `<path>.<stamp>.bak` (old) on disk — recoverable by renaming either back
 * to the canonical path.
 */
export async function saveWithBackup(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const tmpPath = `${path}.tmp`
  await writeFile(tmpPath, content, 'utf8')
  if (await pathExists(path)) {
    await rename(path, timestampedBackupPath(path))
  }
  await rename(tmpPath, path)
}

/**
 * Snapshot the current canonical file as a timestamped backup without touching
 * the canonical itself. Used when the backup cadence is decoupled from the
 * write cadence (e.g. settings: write on every change, back up only on blur /
 * close). Resolves to the path the backup was written to, or `null` if the
 * canonical file does not exist (nothing to back up).
 */
export async function backupCurrent(path: string): Promise<string | null> {
  if (!(await pathExists(path))) return null
  const bakPath = timestampedBackupPath(path)
  await copyFile(path, bakPath)
  return bakPath
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}
