import { contextBridge, ipcRenderer } from 'electron'
import type {
  ElectronApi,
  ImportResult,
  MasterFile,
  TransactionRecord
} from '../shared/types'

const api: ElectronApi = {
  importTsv: (): Promise<ImportResult | null> => ipcRenderer.invoke('import-tsv'),
  loadMaster: (): Promise<MasterFile> => ipcRenderer.invoke('load-master'),
  saveMaster: (records: TransactionRecord[]): Promise<void> =>
    ipcRenderer.invoke('save-master', records)
}

contextBridge.exposeInMainWorld('api', api)
