import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron'
import { readFile } from 'fs/promises'
import { join } from 'path'
import type {
  DiscardChoice,
  ImportResult,
  MasterFile,
  MenuCommand,
  Settings,
  TransactionRecord,
} from '../shared/types'
import { sortRecordsByDateDescending } from '../shared/records'
import { importTsvFile } from './import'
import { loadMasterFile, saveMasterFile } from './master-file'
import { loadSettings, saveSettings } from './settings-file'

const DEFAULT_WINDOW = { width: 1000, height: 768 }
const MIN_WINDOW = { width: 100, height: 100 }
const RESIZE_DEBOUNCE_MS = 400
const MASTER_FILE_FILTERS = [
  { name: 'Transaction Master', extensions: ['json'] },
  { name: 'All Files', extensions: ['*'] },
]

const ABOUT_NAME = 'Transaction Reader'
const ABOUT_DESCRIPTION =
  'Curate and normalize Monarch Money TSV exports into a personal record of your spending history.'
const ABOUT_AUTHOR = 'Eric Jorgensen'

function readmePath(): string {
  // README.md sits at the project root; app.getAppPath() resolves to that in
  // dev and to the asar root in a packaged build (where the file would need
  // to be added via the packager's extraResources configuration).
  return join(app.getAppPath(), 'README.md')
}

async function showAbout(win: BrowserWindow | null): Promise<void> {
  const opts: Electron.MessageBoxOptions = {
    type: 'info',
    title: `About ${ABOUT_NAME}`,
    message: `${ABOUT_NAME}\nVersion ${app.getVersion()}`,
    detail:
      `${ABOUT_DESCRIPTION}\n\n` +
      `© ${new Date().getFullYear()} ${ABOUT_AUTHOR}\n\n` +
      `Electron ${process.versions.electron} · ` +
      `Chromium ${process.versions.chrome} · ` +
      `Node ${process.versions.node}`,
    buttons: ['OK'],
  }
  await (win ? dialog.showMessageBox(win, opts) : dialog.showMessageBox(opts))
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

// Set by the renderer once the user has cleared its unsaved-changes flow.
// The window's close event short-circuits to a real close when this is true.
let allowClose = false

function sendMenuCommand(win: BrowserWindow, command: MenuCommand): void {
  win.webContents.send('menu:command', command)
}

function buildMenu(getActiveWindow: () => BrowserWindow | null): void {
  const sendIfActive = (command: MenuCommand): void => {
    const win = getActiveWindow()
    if (win) sendMenuCommand(win, command)
  }
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => sendIfActive('new') },
        {
          label: 'Open…',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendIfActive('open'),
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendIfActive('save'),
        },
        {
          label: 'Save As…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendIfActive('save-as'),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'Help',
          accelerator: 'F1',
          click: () => sendIfActive('help'),
        },
        { type: 'separator' },
        {
          label: `About ${ABOUT_NAME}`,
          click: () => void showAbout(getActiveWindow()),
        },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

async function createWindow(): Promise<BrowserWindow> {
  const settings = await loadSettings(settingsFilePath())

  const win = new BrowserWindow({
    width: settings.window?.width ?? DEFAULT_WINDOW.width,
    height: settings.window?.height ?? DEFAULT_WINDOW.height,
    minWidth: MIN_WINDOW.width,
    minHeight: MIN_WINDOW.height,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
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

  // Intercept close so the renderer can prompt about unsaved changes first.
  // The renderer must call `app:approve-close` (via the preload API) to let
  // a subsequent close go through.
  win.on('close', (event) => {
    if (allowClose) return
    event.preventDefault()
    win.webContents.send('app:close-request')
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

app.whenReady().then(async () => {
  let mainWindow: BrowserWindow | null = null

  buildMenu(() => mainWindow)

  ipcMain.handle(
    'dialog:open',
    async (event): Promise<string | null> => {
      const win = BrowserWindow.fromWebContents(event.sender)
      const result = win
        ? await dialog.showOpenDialog(win, {
            title: 'Open Transaction File',
            filters: MASTER_FILE_FILTERS,
            properties: ['openFile'],
          })
        : await dialog.showOpenDialog({
            title: 'Open Transaction File',
            filters: MASTER_FILE_FILTERS,
            properties: ['openFile'],
          })
      if (result.canceled || result.filePaths.length === 0) return null
      return result.filePaths[0]
    },
  )

  ipcMain.handle(
    'dialog:save',
    async (event, defaultName?: string): Promise<string | null> => {
      const win = BrowserWindow.fromWebContents(event.sender)
      const options: Electron.SaveDialogOptions = {
        title: 'Save Transaction File',
        filters: MASTER_FILE_FILTERS,
        defaultPath: defaultName,
      }
      const result = win
        ? await dialog.showSaveDialog(win, options)
        : await dialog.showSaveDialog(options)
      if (result.canceled || !result.filePath) return null
      return result.filePath
    },
  )

  ipcMain.handle(
    'file:read',
    async (_event, path: string): Promise<MasterFile> => {
      return loadMasterFile(path)
    },
  )

  ipcMain.handle(
    'file:write',
    async (_event, path: string, records: TransactionRecord[]): Promise<void> => {
      const file: MasterFile = {
        version: 1,
        records: sortRecordsByDateDescending(records),
      }
      await saveMasterFile(path, file)
    },
  )

  ipcMain.handle('file:read-readme', async (): Promise<string> => {
    return readFile(readmePath(), 'utf8')
  })

  ipcMain.handle(
    'dialog:confirm-discard',
    async (event): Promise<DiscardChoice> => {
      const win = BrowserWindow.fromWebContents(event.sender)
      const options: Electron.MessageBoxOptions = {
        type: 'question',
        buttons: ['Save', "Don't Save", 'Cancel'],
        defaultId: 0,
        cancelId: 2,
        title: 'Unsaved Changes',
        message: 'You have unsaved changes.',
        detail: 'Save them before continuing?',
      }
      const result = win
        ? await dialog.showMessageBox(win, options)
        : await dialog.showMessageBox(options)
      if (result.response === 0) return 'save'
      if (result.response === 1) return 'discard'
      return 'cancel'
    },
  )

  ipcMain.on('app:approve-close', (event) => {
    allowClose = true
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.close()
  })

  ipcMain.handle(
    'import-tsv',
    async (_event, currentRecords: TransactionRecord[]): Promise<ImportResult | null> => {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Import Monarch TSV',
        filters: [{ name: 'TSV Files', extensions: ['tsv'] }],
        properties: ['openFile'],
      })
      if (canceled || filePaths.length === 0) return null
      const current: MasterFile = { version: 1, records: currentRecords }
      return importTsvFile(filePaths[0], current)
    },
  )

  ipcMain.handle('settings-load', async (): Promise<Settings> => {
    return loadSettings(settingsFilePath())
  })

  ipcMain.handle(
    'settings-save-categories',
    async (_event, categories: string[]): Promise<void> => {
      await updateSettings((s) => ({ ...s, categories }))
    },
  )

  mainWindow = await createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
