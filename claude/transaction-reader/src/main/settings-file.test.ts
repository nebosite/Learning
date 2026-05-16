import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, readdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { loadSettings, saveSettings } from './settings-file'
import type { Settings } from '../shared/types'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'settings-file-test-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('loadSettings', () => {
  it('returns default settings when the file does not exist', async () => {
    const s = await loadSettings(join(dir, 'settings.json'))
    expect(s).toEqual({ version: 1, categories: [] })
  })

  it('throws on malformed JSON', async () => {
    const path = join(dir, 'settings.json')
    await writeFile(path, 'not json{', 'utf8')
    await expect(loadSettings(path)).rejects.toThrow(/JSON/i)
  })

  it('throws on an unexpected version', async () => {
    const path = join(dir, 'settings.json')
    await writeFile(path, JSON.stringify({ version: 99, categories: [] }), 'utf8')
    await expect(loadSettings(path)).rejects.toThrow(/version/i)
  })

  it('throws when categories is not an array of strings', async () => {
    const path = join(dir, 'settings.json')
    await writeFile(path, JSON.stringify({ version: 1, categories: [1, 2] }), 'utf8')
    await expect(loadSettings(path)).rejects.toThrow(/expected shape/i)
  })

  it('throws when the window field is malformed', async () => {
    const path = join(dir, 'settings.json')
    await writeFile(
      path,
      JSON.stringify({ version: 1, categories: [], window: { width: 'big' } }),
      'utf8',
    )
    await expect(loadSettings(path)).rejects.toThrow(/expected shape/i)
  })
})

describe('saveSettings + loadSettings', () => {
  it('round-trips settings with categories', async () => {
    const path = join(dir, 'settings.json')
    const settings: Settings = { version: 1, categories: ['Coffee', 'Gas', 'Rent'] }
    await saveSettings(path, settings)
    expect(await loadSettings(path)).toEqual(settings)
  })

  it('round-trips settings with a window size', async () => {
    const path = join(dir, 'settings.json')
    const settings: Settings = {
      version: 1,
      categories: [],
      window: { width: 1200, height: 800 },
    }
    await saveSettings(path, settings)
    expect(await loadSettings(path)).toEqual(settings)
  })

  it('creates missing parent directories', async () => {
    const path = join(dir, 'nested', 'deep', 'settings.json')
    await saveSettings(path, { version: 1, categories: [] })
    expect(await loadSettings(path)).toEqual({ version: 1, categories: [] })
  })

  it('leaves no stray .tmp file after a successful save', async () => {
    const path = join(dir, 'settings.json')
    await saveSettings(path, { version: 1, categories: ['X'] })
    const entries = await readdir(dir)
    expect(entries).toContain('settings.json')
    expect(entries.filter((e) => e.endsWith('.tmp'))).toEqual([])
  })

  it('overwrites an existing settings file', async () => {
    const path = join(dir, 'settings.json')
    await saveSettings(path, { version: 1, categories: ['A'] })
    await saveSettings(path, { version: 1, categories: ['B', 'C'] })
    expect((await loadSettings(path)).categories).toEqual(['B', 'C'])
  })
})
