import { useEffect, useState } from 'react'
import type {
  ImportResult,
  OriginalTransaction,
  TransactionRecord,
} from '../shared/types'
import { Grid } from './grid'

export default function App(): JSX.Element {
  const [records, setRecords] = useState<TransactionRecord[]>([])
  const [dirty, setDirty] = useState(false)
  const [lastImport, setLastImport] = useState<ImportResult | null>(null)

  useEffect(() => {
    window.api.loadMaster().then((m) => {
      setRecords(m.records)
      setDirty(false)
    })
  }, [])

  async function handleImport(): Promise<void> {
    const result = await window.api.importTsv()
    if (result) {
      setRecords(result.master.records)
      setDirty(false)
      setLastImport(result)
    }
  }

  async function handleSave(): Promise<void> {
    await window.api.saveMaster(records)
    setDirty(false)
  }

  function handleRemoveOverride(index: number, field: keyof OriginalTransaction): void {
    setRecords((prev) => {
      const next = prev.slice()
      const r = next[index]
      const newOverrides = { ...r.overrides }
      delete newOverrides[field]
      next[index] = { ...r, overrides: newOverrides }
      return next
    })
    setDirty(true)
  }

  return (
    <div style={{ padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '0.75rem',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Transaction Reader</h1>
        <button onClick={handleImport}>Import</button>
        <button onClick={handleSave} disabled={!dirty}>
          {dirty ? 'Save *' : 'Save'}
        </button>
        <span style={{ marginLeft: 'auto', color: '#666', fontSize: '0.85rem' }}>
          {records.length} records{dirty ? ' (unsaved changes)' : ''}
        </span>
      </header>
      {lastImport && (
        <p style={{ marginTop: 0, color: '#555', fontSize: '0.85rem' }}>
          Last import: {lastImport.added} added, {lastImport.skipped} skipped,{' '}
          {lastImport.autoIgnored} auto-ignored, {lastImport.parseErrors.length} parse errors.
        </p>
      )}
      <Grid records={records} onRemoveOverride={handleRemoveOverride} />
    </div>
  )
}
