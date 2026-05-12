import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'path'

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
  ipcMain.handle('dialog:openTsv', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import TSV File',
      filters: [{ name: 'TSV Files', extensions: ['tsv'] }],
      properties: ['openFile']
    })
    return canceled ? null : filePaths[0]
  })

  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
