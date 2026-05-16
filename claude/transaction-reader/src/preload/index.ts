import { contextBridge, ipcRenderer } from 'electron'
import type {
  ElectronApi,
  ImportResult,
  MasterFile,
  Settings,
  TransactionRecord
} from '../shared/types'

const api: ElectronApi = {
  importTsv: (): Promise<ImportResult | null> => ipcRenderer.invoke('import-tsv'),
  loadMaster: (): Promise<MasterFile> => ipcRenderer.invoke('load-master'),
  saveMaster: (records: TransactionRecord[]): Promise<void> =>
    ipcRenderer.invoke('save-master', records),
  loadSettings: (): Promise<Settings> => ipcRenderer.invoke('settings-load'),
  saveCategories: (categories: string[]): Promise<void> =>
    ipcRenderer.invoke('settings-save-categories', categories)
}

contextBridge.exposeInMainWorld('api', api)
