import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  openTsvDialog: (): Promise<string | null> => ipcRenderer.invoke('dialog:openTsv')
})
