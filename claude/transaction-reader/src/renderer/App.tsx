import { useCallback, useEffect, useState } from 'react'
import type {
  ImportResult,
  OriginalTransaction,
  TransactionOverrides,
  TransactionRecord,
} from '../shared/types'
import { Grid } from './grid'

const MAX_HISTORY = 100

interface History {
  past: TransactionRecord[][]
  present: TransactionRecord[]
  future: TransactionRecord[][]
}

const emptyHistory: History = { past: [], present: [], future: [] }

export default function App(): JSX.Element {
  const [history, setHistory] = useState<History>(emptyHistory)
  const [savedRef, setSavedRef] = useState<TransactionRecord[]>(emptyHistory.present)
  const [lastImport, setLastImport] = useState<ImportResult | null>(null)
  const dirty = history.present !== savedRef

  const reset = useCallback((records: TransactionRecord[]): void => {
    setHistory({ past: [], present: records, future: [] })
    setSavedRef(records)
  }, [])

  useEffect(() => {
    window.api.loadMaster().then((m) => reset(m.records))
  }, [reset])

  const apply = useCallback(
    (updater: (records: TransactionRecord[]) => TransactionRecord[]): void => {
      setHistory(({ past, present }) => ({
        past: [...past.slice(-(MAX_HISTORY - 1)), present],
        present: updater(present),
        future: [],
      }))
    },
    [],
  )

  const undo = useCallback((): void => {
    setHistory(({ past, present, future }) =>
      past.length === 0
        ? { past, present, future }
        : {
            past: past.slice(0, -1),
            present: past[past.length - 1],
            future: [present, ...future.slice(0, MAX_HISTORY - 1)],
          },
    )
  }, [])

  const redo = useCallback((): void => {
    setHistory(({ past, present, future }) =>
      future.length === 0
        ? { past, present, future }
        : {
            past: [...past.slice(-(MAX_HISTORY - 1)), present],
            present: future[0],
            future: future.slice(1),
          },
    )
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      const t = e.target as HTMLElement | null
      // Let inputs handle their own Ctrl-Z (text undo within the editor).
      if (
        t &&
        (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      ) {
        return
      }
      const ctrl = e.ctrlKey || e.metaKey
      if (!ctrl || e.key.toLowerCase() !== 'z') return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])

  async function handleImport(): Promise<void> {
    const result = await window.api.importTsv()
    if (result) {
      reset(result.master.records)
      setLastImport(result)
    }
  }

  async function handleSave(): Promise<void> {
    await window.api.saveMaster(history.present)
    setSavedRef(history.present)
  }

  function handleSetField(
    index: number,
    field: keyof OriginalTransaction,
    value: OriginalTransaction[keyof OriginalTransaction],
  ): void {
    apply((prev) => {
      const r = prev[index]
      const newOverrides: TransactionOverrides = { ...r.overrides }
      if (value === r.original[field]) {
        delete newOverrides[field]
      } else {
        // TS won't narrow the generic indexed assignment; the runtime types
        // match because field/value come paired from the same key.
        ;(newOverrides as Record<string, unknown>)[field] = value
      }
      const next = prev.slice()
      next[index] = { ...r, overrides: newOverrides }
      return next
    })
  }

  function handleRemoveOverride(index: number, field: keyof OriginalTransaction): void {
    apply((prev) => {
      const r = prev[index]
      const newOverrides = { ...r.overrides }
      delete newOverrides[field]
      const next = prev.slice()
      next[index] = { ...r, overrides: newOverrides }
      return next
    })
  }

  function handleToggleIgnored(index: number): void {
    apply((prev) => {
      const r = prev[index]
      const next = prev.slice()
      next[index] = { ...r, ignored: !r.ignored }
      return next
    })
  }

  function handleDelete(index: number): void {
    apply((prev) => prev.filter((_, i) => i !== index))
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
        <button onClick={undo} disabled={history.past.length === 0} title="Undo (Ctrl+Z)">
          Undo
        </button>
        <button
          onClick={redo}
          disabled={history.future.length === 0}
          title="Redo (Ctrl+Shift+Z)"
        >
          Redo
        </button>
        <span style={{ marginLeft: 'auto', color: '#666', fontSize: '0.85rem' }}>
          {history.present.length} records{dirty ? ' (unsaved changes)' : ''}
        </span>
      </header>
      {lastImport && (
        <p style={{ marginTop: 0, color: '#555', fontSize: '0.85rem' }}>
          Last import: {lastImport.added} added, {lastImport.skipped} skipped,{' '}
          {lastImport.autoIgnored} auto-ignored, {lastImport.parseErrors.length} parse errors.
        </p>
      )}
      <Grid
        records={history.present}
        onSetField={handleSetField}
        onRemoveOverride={handleRemoveOverride}
        onToggleIgnored={handleToggleIgnored}
        onDelete={handleDelete}
      />
    </div>
  )
}
