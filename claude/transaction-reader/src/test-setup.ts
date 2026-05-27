import { afterEach, beforeEach, vi } from 'vitest'

// Wire up @testing-library/jest-dom matchers (toBeInTheDocument, etc.) and a
// stub Electron API only when we're running in a DOM-equipped environment
// (jsdom). Node-environment tests skip both, so they don't pay the cost.
const inDom = typeof window !== 'undefined'

if (inDom) {
  // The matchers are dynamically imported so the side-effect registers even
  // when the file is loaded under a non-jsdom test (no-op in that case).
  await import('@testing-library/jest-dom/vitest')
  const { cleanup } = await import('@testing-library/react')

  afterEach(() => {
    // Unmount everything before vi.restoreAllMocks; otherwise leftover DOM
    // from a previous test leaks across renders and produces duplicate matches.
    cleanup()
  })

  beforeEach(() => {
    // Cleanly stub the Electron preload bridge for each test. Tests that need
    // specific behavior reassign individual methods with vi.fn / vi.spyOn.
    ;(globalThis as unknown as { window: Window & { api: unknown } }).window.api = {
      importCsv: vi.fn(async () => null),
      showOpenDialog: vi.fn(async () => null),
      showSaveDialog: vi.fn(async () => null),
      readMasterFile: vi.fn(async () => ({ version: 1, records: [] })),
      writeMasterFile: vi.fn(async () => undefined),
      confirmDiscard: vi.fn(async () => 'cancel'),
      confirm: vi.fn(async () => true),
      readReadme: vi.fn(async () => '# Hello'),
      onMenuCommand: vi.fn(() => () => undefined),
      onCloseRequest: vi.fn(() => () => undefined),
      approveClose: vi.fn(() => undefined),
      loadSettings: vi.fn(async () => ({ version: 1, categories: [] })),
      saveCategories: vi.fn(async () => undefined),
      setLastOpenedPath: vi.fn(async () => undefined),
      getSettingsPath: vi.fn(async () => '/tmp/settings.json'),
      showInFolder: vi.fn(async () => undefined),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })
}
