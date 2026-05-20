import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type {
  DiscardChoice,
  ElectronApi,
  ImportResult,
  MasterFile,
  MenuCommand,
  Settings,
  TransactionRecord,
} from '../shared/types'

const api: ElectronApi = {
  importCsv: (
    currentRecords: readonly TransactionRecord[],
  ): Promise<ImportResult | null> =>
    ipcRenderer.invoke('import-csv', currentRecords),

  showOpenDialog: (): Promise<string | null> => ipcRenderer.invoke('dialog:open'),
  showSaveDialog: (defaultName?: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:save', defaultName),
  readMasterFile: (path: string): Promise<MasterFile> =>
    ipcRenderer.invoke('file:read', path),
  writeMasterFile: (
    path: string,
    records: readonly TransactionRecord[],
  ): Promise<void> => ipcRenderer.invoke('file:write', path, records),
  confirmDiscard: (): Promise<DiscardChoice> =>
    ipcRenderer.invoke('dialog:confirm-discard'),
  readReadme: (): Promise<string> => ipcRenderer.invoke('file:read-readme'),

  onMenuCommand: (callback: (command: MenuCommand) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, command: MenuCommand): void => {
      callback(command)
    }
    ipcRenderer.on('menu:command', listener)
    return () => ipcRenderer.off('menu:command', listener)
  },
  onCloseRequest: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('app:close-request', listener)
    return () => ipcRenderer.off('app:close-request', listener)
  },
  approveClose: (): void => {
    ipcRenderer.send('app:approve-close')
  },

  loadSettings: (): Promise<Settings> => ipcRenderer.invoke('settings-load'),
  saveCategories: (categories: string[]): Promise<void> =>
    ipcRenderer.invoke('settings-save-categories', categories),
}

contextBridge.exposeInMainWorld('api', api)
