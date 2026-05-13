import { useEffect, useState } from 'react'
import type { ImportResult, MasterFile } from '../shared/types'

export default function App(): JSX.Element {
  const [master, setMaster] = useState<MasterFile | null>(null)
  const [lastImport, setLastImport] = useState<ImportResult | null>(null)

  useEffect(() => {
    window.api.loadMaster().then(setMaster)
  }, [])

  async function handleImport(): Promise<void> {
    const result = await window.api.importTsv()
    if (result) {
      setLastImport(result)
      setMaster(result.master)
    }
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Transaction Reader</h1>
      <button onClick={handleImport}>Import</button>
      {master && (
        <p style={{ marginTop: '1rem', color: '#555' }}>
          Master holds {master.records.length} records.
        </p>
      )}
      {lastImport && (
        <p style={{ color: '#555' }}>
          Last import: {lastImport.added} added, {lastImport.skipped} skipped,{' '}
          {lastImport.autoIgnored} auto-ignored, {lastImport.parseErrors.length} parse errors.
        </p>
      )}
    </div>
  )
}
