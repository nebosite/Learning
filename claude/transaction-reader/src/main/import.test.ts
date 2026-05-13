import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { importTsvFile } from './import'
import { loadMasterFile } from './master-file'

const HEADER =
  'Date\tMerchant\tCategory\tAccount\tOriginal Statement\tNotes\tAmount\tTags\tOwner'

let dir: string
let tsvPath: string
let masterPath: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'import-test-'))
  tsvPath = join(dir, 'export.tsv')
  masterPath = join(dir, 'master.json')
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('importTsvFile', () => {
  it('imports a TSV into an empty master', async () => {
    await writeFile(
      tsvPath,
      [
        HEADER,
        '5/8/2026\tNetflix\tsubs\tA\tNETFLIX\t\t-29.82\t\tShared',
        '5/7/2026\tHulu\tsubs\tA\tHULU\t\t-15.99\t\tShared',
      ].join('\n'),
      'utf8',
    )

    const r = await importTsvFile(tsvPath, masterPath)
    expect(r.added).toBe(2)
    expect(r.skipped).toBe(0)
    expect(r.autoIgnored).toBe(0)
    expect(r.parseErrors).toEqual([])
    expect(r.master.records).toHaveLength(2)

    const loaded = await loadMasterFile(masterPath)
    expect(loaded.records).toHaveLength(2)
  })

  it('is idempotent when re-importing the same file', async () => {
    const content = [
      HEADER,
      '5/8/2026\tNetflix\tsubs\tA\tNETFLIX\t\t-29.82\t\tShared',
    ].join('\n')
    await writeFile(tsvPath, content, 'utf8')

    await importTsvFile(tsvPath, masterPath)
    const second = await importTsvFile(tsvPath, masterPath)
    expect(second.added).toBe(0)
    expect(second.skipped).toBe(1)
    expect(second.master.records).toHaveLength(1)
  })

  it('auto-ignores transfer pairs detected on import', async () => {
    await writeFile(
      tsvPath,
      [
        HEADER,
        '5/8/2026\tTransfer\tTransfer\tChecking\tT-OUT\t\t-200\t\tShared',
        '5/8/2026\tTransfer\tTransfer\tSavings\tT-IN\t\t200\t\tShared',
      ].join('\n'),
      'utf8',
    )

    const r = await importTsvFile(tsvPath, masterPath)
    expect(r.added).toBe(2)
    expect(r.autoIgnored).toBe(2)

    const loaded = await loadMasterFile(masterPath)
    expect(loaded.records.every((rec) => rec.ignored)).toBe(true)
  })

  it('returns parse errors without aborting the import', async () => {
    await writeFile(
      tsvPath,
      [
        HEADER,
        'BAD-DATE\tFoo\tCat\tA\tStmt\t\t-1\t\tS',
        '5/8/2026\tNetflix\tsubs\tA\tNETFLIX\t\t-29.82\t\tShared',
      ].join('\n'),
      'utf8',
    )

    const r = await importTsvFile(tsvPath, masterPath)
    expect(r.parseErrors).toHaveLength(1)
    expect(r.added).toBe(1)
    expect(r.master.records).toHaveLength(1)
  })

  it('sorts the persisted master by effective date descending', async () => {
    await writeFile(
      tsvPath,
      [
        HEADER,
        '5/6/2026\tA\tcat\tAcct\tS\t\t-1\t\tS',
        '5/8/2026\tB\tcat\tAcct\tS\t\t-1\t\tS',
        '5/7/2026\tC\tcat\tAcct\tS\t\t-1\t\tS',
      ].join('\n'),
      'utf8',
    )

    const r = await importTsvFile(tsvPath, masterPath)
    expect(r.master.records.map((rec) => rec.original.merchant)).toEqual(['B', 'C', 'A'])
  })

  it('propagates whole-file parse errors as exceptions', async () => {
    await writeFile(tsvPath, '', 'utf8')
    await expect(importTsvFile(tsvPath, masterPath)).rejects.toThrow()
  })
})
