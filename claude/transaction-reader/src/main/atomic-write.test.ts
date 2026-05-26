import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, readdir, rm, stat } from 'fs/promises'
import { tmpdir } from 'os'
import { basename, join } from 'path'
import {
  backupCurrent,
  saveAtomic,
  saveWithBackup,
  timestampedBackupPath,
} from './atomic-write'

let dir: string
let filePath: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'atomic-write-test-'))
  filePath = join(dir, 'master.json')
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function backupsFor(path: string): Promise<string[]> {
  const parent = join(path, '..')
  const baseName = basename(path)
  const entries = await readdir(parent)
  return entries
    .filter((name) => name.startsWith(`${baseName}.`) && name.endsWith('.bak'))
    .sort()
}

describe('timestampedBackupPath', () => {
  it('uses a Windows-safe, lexicographically-sortable ISO stamp', () => {
    const out = timestampedBackupPath('/x/master.json', new Date('2026-05-26T10:15:30.123Z'))
    expect(out).toBe('/x/master.json.2026-05-26T10-15-30-123.bak')
  })

  it('sorts in chronological order', () => {
    const earlier = timestampedBackupPath('f', new Date('2026-05-26T10:15:30.000Z'))
    const later = timestampedBackupPath('f', new Date('2026-05-26T10:15:30.001Z'))
    expect([later, earlier].sort()).toEqual([earlier, later])
  })
})

describe('saveAtomic', () => {
  it('writes the new content to the canonical path', async () => {
    await saveAtomic(filePath, 'hello')
    expect(await readFile(filePath, 'utf8')).toBe('hello')
  })

  it('never creates a backup, even on repeated saves', async () => {
    await saveAtomic(filePath, 'v1')
    await saveAtomic(filePath, 'v2')
    await saveAtomic(filePath, 'v3')
    expect(await backupsFor(filePath)).toEqual([])
  })

  it('does not leave a .tmp behind', async () => {
    await saveAtomic(filePath, 'hello')
    await expect(stat(`${filePath}.tmp`)).rejects.toThrow()
  })

  it('creates parent directories as needed', async () => {
    const nested = join(dir, 'a', 'b', 'c', 'file.txt')
    await saveAtomic(nested, 'deep')
    expect(await readFile(nested, 'utf8')).toBe('deep')
  })
})

describe('saveWithBackup', () => {
  it('writes the new content to the canonical path', async () => {
    await saveWithBackup(filePath, 'hello')
    expect(await readFile(filePath, 'utf8')).toBe('hello')
  })

  it('does not create any backup on the very first save', async () => {
    await saveWithBackup(filePath, 'hello')
    expect(await backupsFor(filePath)).toEqual([])
  })

  it('moves the previous contents to a timestamped .bak on subsequent saves', async () => {
    await saveWithBackup(filePath, 'v1')
    await saveWithBackup(filePath, 'v2')
    expect(await readFile(filePath, 'utf8')).toBe('v2')
    const backups = await backupsFor(filePath)
    expect(backups).toHaveLength(1)
    expect(await readFile(join(dir, backups[0]), 'utf8')).toBe('v1')
  })

  it('keeps every prior version as its own generational backup', async () => {
    await saveWithBackup(filePath, 'v1')
    await new Promise((r) => setTimeout(r, 5))
    await saveWithBackup(filePath, 'v2')
    await new Promise((r) => setTimeout(r, 5))
    await saveWithBackup(filePath, 'v3')

    expect(await readFile(filePath, 'utf8')).toBe('v3')
    const backups = await backupsFor(filePath)
    expect(backups).toHaveLength(2)
    expect(await readFile(join(dir, backups[0]), 'utf8')).toBe('v1')
    expect(await readFile(join(dir, backups[1]), 'utf8')).toBe('v2')
  })
})

describe('backupCurrent', () => {
  it('copies the current canonical file to a timestamped .bak without changing it', async () => {
    await saveAtomic(filePath, 'live content')
    const bakPath = await backupCurrent(filePath)

    expect(bakPath).not.toBeNull()
    // Canonical file is untouched.
    expect(await readFile(filePath, 'utf8')).toBe('live content')
    // Backup file is a copy.
    expect(await readFile(bakPath!, 'utf8')).toBe('live content')
  })

  it('returns null and creates nothing when the canonical file is absent', async () => {
    const bakPath = await backupCurrent(filePath)
    expect(bakPath).toBeNull()
    expect(await backupsFor(filePath)).toEqual([])
  })

  it('creates a new backup on each call (generational, not overwriting)', async () => {
    await saveAtomic(filePath, 'first')
    await backupCurrent(filePath)
    await new Promise((r) => setTimeout(r, 5))
    await saveAtomic(filePath, 'second')
    await backupCurrent(filePath)

    const backups = await backupsFor(filePath)
    expect(backups).toHaveLength(2)
    expect(await readFile(join(dir, backups[0]), 'utf8')).toBe('first')
    expect(await readFile(join(dir, backups[1]), 'utf8')).toBe('second')
  })
})
