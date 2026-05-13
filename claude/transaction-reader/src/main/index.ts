import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'path'
import type {
  ImportResult,
  MasterFile,
  TransactionRecord,
} from '../shared/types'
import { sortRecordsByDateDescending } from '../shared/records'
import { importTsvFile } from './import'
import { loadMasterFile, saveMasterFile } from './master-file'

function masterFilePath(): string {
  return join(app.getPath('userData'), 'master.json')
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
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
    return loadMasterFile(masterFilePath())
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

  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
