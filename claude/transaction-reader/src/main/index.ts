import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'path'
import type {
  ImportResult,
  MasterFile,
  Settings,
  TransactionRecord,
} from '../shared/types'
import { sortRecordsByDateDescending } from '../shared/records'
import { importTsvFile } from './import'
import { loadMasterFile, saveMasterFile } from './master-file'
import { loadSettings, saveSettings } from './settings-file'
import { makeSeedRecords } from './seed'

const DEFAULT_WINDOW = { width: 1000, height: 768 }
const MIN_WINDOW = { width: 100, height: 100 }
const RESIZE_DEBOUNCE_MS = 400

function masterFilePath(): string {
  return join(app.getPath('userData'), 'master.json')
}

function settingsFilePath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

// Settings updates are serialized through this chain so that a window-resize
// save and a category save never interleave their read-modify-write steps.
let settingsWriteChain: Promise<void> = Promise.resolve()

function updateSettings(mutate: (current: Settings) => Settings): Promise<void> {
  const next = settingsWriteChain.then(async () => {
    const current = await loadSettings(settingsFilePath())
    await saveSettings(settingsFilePath(), mutate(current))
  })
  // Keep the chain alive even if one update fails; callers still see `next`.
  settingsWriteChain = next.catch(() => {})
  return next
}

async function createWindow(): Promise<void> {
  const settings = await loadSettings(settingsFilePath())

  const win = new BrowserWindow({
    width: settings.window?.width ?? DEFAULT_WINDOW.width,
    height: settings.window?.height ?? DEFAULT_WINDOW.height,
    minWidth: MIN_WINDOW.width,
    minHeight: MIN_WINDOW.height,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  let resizeTimer: NodeJS.Timeout | null = null
  win.on('resize', () => {
    // Skip while maximized so a maximize doesn't overwrite the user's chosen size.
    if (win.isMaximized()) return
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      const [width, height] = win.getSize()
      void updateSettings((s) => ({ ...s, window: { width, height } }))
    }, RESIZE_DEBOUNCE_MS)
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  ipcMain.handle('import-tsv', async (): Promise<ImportResult | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import Monarch TSV',
      filters: [{ name: 'TSV Files', extensions: ['tsv'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null
    return importTsvFile(filePaths[0], masterFilePath())
  })

  ipcMain.handle('load-master', async (): Promise<MasterFile> => {
    const path = masterFilePath()
    const file = await loadMasterFile(path)
    if (file.records.length === 0) {
      // Seed on first run so the override UI has something to demonstrate.
      // Persisted to disk immediately so subsequent loads return the same
      // records (and imports merge against them rather than against empty).
      const seeded: MasterFile = {
        version: 1,
        records: sortRecordsByDateDescending(makeSeedRecords()),
      }
      await saveMasterFile(path, seeded)
      return seeded
    }
    return file
  })

  ipcMain.handle(
    'save-master',
    async (_event, records: TransactionRecord[]): Promise<void> => {
      const file: MasterFile = {
        version: 1,
        records: sortRecordsByDateDescending(records)
      }
      await saveMasterFile(masterFilePath(), file)
    }
  )

  ipcMain.handle('settings-load', async (): Promise<Settings> => {
    return loadSettings(settingsFilePath())
  })

  ipcMain.handle(
    'settings-save-categories',
    async (_event, categories: string[]): Promise<void> => {
      await updateSettings((s) => ({ ...s, categories }))
    }
  )

  await createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
