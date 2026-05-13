import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, readdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { loadMasterFile, saveMasterFile } from './master-file'
import type { MasterFile, TransactionRecord } from '../shared/types'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'master-file-test-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('loadMasterFile', () => {
  it('returns an empty master when the file does not exist', async () => {
    const f = await loadMasterFile(join(dir, 'master.json'))
    expect(f).toEqual({ version: 1, records: [] })
  })

  it('throws on malformed JSON', async () => {
    const path = join(dir, 'master.json')
    await writeFile(path, 'not json{', 'utf8')
    await expect(loadMasterFile(path)).rejects.toThrow(/JSON/i)
  })

  it('throws on an unexpected version', async () => {
    const path = join(dir, 'master.json')
    await writeFile(path, JSON.stringify({ version: 99, records: [] }), 'utf8')
    await expect(loadMasterFile(path)).rejects.toThrow(/version/i)
  })

  it('throws when records is not an array', async () => {
    const path = join(dir, 'master.json')
    await writeFile(path, JSON.stringify({ version: 1, records: null }), 'utf8')
    await expect(loadMasterFile(path)).rejects.toThrow(/expected shape/i)
  })
})

describe('saveMasterFile + loadMasterFile', () => {
  const sampleRecord: TransactionRecord = {
    key: '5/8/2026\tNetflix\tsubscriptions\tJanet\tNETFLIX.COM\t\t-29.82\t\tShared',
    original: {
      date: '2026-05-08',
      merchant: 'Netflix',
      category: 'subscriptions',
      account: 'Janet',
      originalStatement: 'NETFLIX.COM',
      notes: '',
      amount: -29.82,
      tags: '',
      owner: 'Shared',
    },
    overrides: {},
    ignored: false,
  }

  it('round-trips a file with records', async () => {
    const path = join(dir, 'master.json')
    const file: MasterFile = { version: 1, records: [sampleRecord] }
    await saveMasterFile(path, file)
    const loaded = await loadMasterFile(path)
    expect(loaded).toEqual(file)
  })

  it('creates missing parent directories', async () => {
    const path = join(dir, 'sub', 'nested', 'master.json')
    await saveMasterFile(path, { version: 1, records: [] })
    const loaded = await loadMasterFile(path)
    expect(loaded).toEqual({ version: 1, records: [] })
  })

  it('leaves no stray .tmp file after a successful save', async () => {
    const path = join(dir, 'master.json')
    await saveMasterFile(path, { version: 1, records: [] })
    const entries = await readdir(dir)
    expect(entries).toContain('master.json')
    expect(entries.filter((e) => e.endsWith('.tmp'))).toEqual([])
  })

  it('overwrites an existing master atomically', async () => {
    const path = join(dir, 'master.json')
    await saveMasterFile(path, { version: 1, records: [] })
    await saveMasterFile(path, { version: 1, records: [sampleRecord] })
    const loaded = await loadMasterFile(path)
    expect(loaded.records).toHaveLength(1)
  })
})
