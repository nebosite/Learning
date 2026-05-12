export interface ElectronApi {
  openTsvDialog: () => Promise<string | null>
}

declare global {
  interface Window {
    api: ElectronApi
  }
}
