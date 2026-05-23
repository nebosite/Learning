import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  Budget,
  ImportResult,
  OriginalTransaction,
  TransactionOverrides,
  TransactionRecord,
} from '../shared/types'
import { effectiveValue } from '../shared/records'
import { BudgetView } from './budget'
import { Grid } from './grid'
import { HelpModal } from './help-modal'
import { Report } from './report'
import { SettingsView } from './settings'
import './app.css'

const MAX_HISTORY = 100

type View = 'transactions' | 'report' | 'budget' | 'settings'

interface History {
  past: TransactionRecord[][]
  present: TransactionRecord[]
  future: TransactionRecord[][]
}

const emptyHistory: History = { past: [], present: [], future: [] }

export default function App(): JSX.Element {
  const [view, setView] = useState<View>('transactions')
  const [history, setHistory] = useState<History>(emptyHistory)
  const [savedRef, setSavedRef] = useState<TransactionRecord[]>(emptyHistory.present)
  const [lastImport, setLastImport] = useState<ImportResult | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  // Bumped by the Resort button to make the grid re-sort/re-filter on demand.
  const [resortKey, setResortKey] = useState(0)
  // The file the records were last opened from or saved to; null = untitled.
  const [currentPath, setCurrentPath] = useState<string | null>(null)
  // Whether the in-app Help dialog (rendered README) is showing.
  const [helpOpen, setHelpOpen] = useState(false)
  // Budgets live in the master file; track them in parallel with the records
  // and their savedRef so dirty considers both.
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [savedBudgetsRef, setSavedBudgetsRef] = useState<Budget[]>(budgets)
  const dirty =
    history.present !== savedRef || budgets !== savedBudgetsRef

  const reset = useCallback(
    (records: TransactionRecord[], fileBudgets: Budget[] = []): void => {
      setHistory({ past: [], present: records, future: [] })
      setSavedRef(records)
      setBudgets(fileBudgets)
      setSavedBudgetsRef(fileBudgets)
    },
    [],
  )

  useEffect(() => {
    // Load settings, then try to reopen whatever file was open last session.
    // If that file has been moved or is no longer parseable, we silently
    // start empty — the user can still File > Open... anything else.
    void (async () => {
      const s = await window.api.loadSettings()
      setCategories(s.categories)
      if (!s.lastOpenedPath) return
      try {
        const master = await window.api.readMasterFile(s.lastOpenedPath)
        reset(master.records, master.budgets ?? [])
        setCurrentPath(s.lastOpenedPath)
      } catch (err) {
        console.warn('Could not auto-open last file:', err)
        await window.api.setLastOpenedPath(null)
      }
    })()
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

  // Latest handlers, accessed via ref so the menu/close subscriptions can stay
  // mounted once but always invoke the up-to-date logic.
  const handlersRef = useRef({
    handleNew,
    handleOpen,
    handleSave,
    handleSaveAs,
    handleCloseRequest,
  })
  handlersRef.current = {
    handleNew,
    handleOpen,
    handleSave,
    handleSaveAs,
    handleCloseRequest,
  }

  useEffect(() => {
    const offMenu = window.api.onMenuCommand((command) => {
      const h = handlersRef.current
      if (command === 'new') void h.handleNew()
      else if (command === 'open') void h.handleOpen()
      else if (command === 'save') void h.handleSave()
      else if (command === 'save-as') void h.handleSaveAs()
      else if (command === 'help') setHelpOpen(true)
    })
    const offClose = window.api.onCloseRequest(() => {
      void handlersRef.current.handleCloseRequest()
    })
    return () => {
      offMenu()
      offClose()
    }
  }, [])

  useEffect(() => {
    const fileName = currentPath ? currentPath.split(/[\\/]/).pop() ?? '(untitled)' : '(untitled)'
    document.title = `${dirty ? '* ' : ''}${fileName} — Transaction Reader`
  }, [currentPath, dirty])

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
    const result = await window.api.importCsv(history.present)
    if (!result) return
    // Make the import a single undoable step rather than overwriting history;
    // the merged records aren't on disk yet, so this leaves the doc dirty.
    apply(() => result.master.records)
    setLastImport(result)
  }

  // Save returns true if it persisted (or the user cancelled with nothing to
  // do); false if a Save-As dialog was cancelled, so callers can abort chains.
  async function handleSave(): Promise<boolean> {
    if (!currentPath) return handleSaveAs()
    const records = history.present
    const budgetsSnapshot = budgets
    await window.api.writeMasterFile(currentPath, records, budgetsSnapshot)
    setSavedRef(records)
    setSavedBudgetsRef(budgetsSnapshot)
    return true
  }

  async function handleSaveAs(): Promise<boolean> {
    const path = await window.api.showSaveDialog(currentPath ?? undefined)
    if (!path) return false
    const records = history.present
    const budgetsSnapshot = budgets
    await window.api.writeMasterFile(path, records, budgetsSnapshot)
    setCurrentPath(path)
    setSavedRef(records)
    setSavedBudgetsRef(budgetsSnapshot)
    void window.api.setLastOpenedPath(path)
    return true
  }

  // The standard "save / discard / cancel" prompt before a destructive action.
  // Returns true if the caller should proceed.
  async function confirmIfDirty(): Promise<boolean> {
    if (!dirty) return true
    const choice = await window.api.confirmDiscard()
    if (choice === 'cancel') return false
    if (choice === 'save') return handleSave()
    return true
  }

  async function handleOpen(): Promise<void> {
    if (!(await confirmIfDirty())) return
    const path = await window.api.showOpenDialog()
    if (!path) return
    const master = await window.api.readMasterFile(path)
    reset(master.records, master.budgets ?? [])
    setCurrentPath(path)
    setLastImport(null)
    void window.api.setLastOpenedPath(path)
  }

  async function handleNew(): Promise<void> {
    if (!(await confirmIfDirty())) return
    reset([], [])
    setCurrentPath(null)
    setLastImport(null)
    void window.api.setLastOpenedPath(null)
  }

  async function handleCloseRequest(): Promise<void> {
    if (!(await confirmIfDirty())) return
    window.api.approveClose()
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
    // A category set from the grid that isn't already known becomes a new
    // custom category (case-insensitive); the comparison is done by handleAddCategory.
    if (field === 'category' && typeof value === 'string' && value.trim() !== '') {
      handleAddCategory(value.trim())
    }
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

  // Drag-copy: write the source cell's value into every target record, as a
  // single undoable change.
  function handleFill(
    sourceIndex: number,
    targetIndices: number[],
    field: keyof OriginalTransaction | 'ignored',
  ): void {
    apply((prev) => {
      const source = prev[sourceIndex]
      if (!source) return prev
      const next = prev.slice()
      if (field === 'ignored') {
        for (const i of targetIndices) {
          if (next[i]) next[i] = { ...next[i], ignored: source.ignored }
        }
        return next
      }
      const val = effectiveValue(source, field)
      for (const i of targetIndices) {
        const r = next[i]
        if (!r) continue
        const newOverrides: TransactionOverrides = { ...r.overrides }
        if (val === r.original[field]) {
          delete newOverrides[field]
        } else {
          ;(newOverrides as Record<string, unknown>)[field] = val
        }
        next[i] = { ...r, overrides: newOverrides }
      }
      return next
    })
    // A filled-in category that isn't already known becomes a new category.
    if (field === 'category') {
      const source = history.present[sourceIndex]
      const name = source ? String(effectiveValue(source, 'category')).trim() : ''
      if (name !== '') handleAddCategory(name)
    }
  }

  function persistCategories(next: string[]): void {
    setCategories(next)
    void window.api.saveCategories(next)
  }

  function handleAddCategory(name: string): void {
    if (categories.some((c) => c.toLowerCase() === name.toLowerCase())) return
    persistCategories([...categories, name])
  }

  function handleDeleteCategory(name: string): void {
    persistCategories(categories.filter((c) => c !== name))
  }

  // Distinct categories used to seed a new budget: every effective category in
  // the records plus every custom category. Computed in App so the Budget tab
  // doesn't have to recompute on every render.
  const availableCategories = useMemo(() => {
    const set = new Set<string>()
    for (const r of history.present) {
      const c = effectiveValue(r, 'category')
      if (typeof c === 'string' && c.trim() !== '') set.add(c.trim())
    }
    for (const c of categories) {
      if (c.trim() !== '') set.add(c.trim())
    }
    return [...set].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
  }, [history.present, categories])

  // Shared by the Transactions and Report tabs (both edit transactions).
  const toolbar = (
    <div className="toolbar">
      <button onClick={handleImport}>Import</button>
      <button onClick={() => void handleSave()} disabled={!dirty}>
        {dirty ? 'Save *' : 'Save'}
      </button>
      <button
        className="icon-btn"
        onClick={undo}
        disabled={history.past.length === 0}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
      >
        ↶
      </button>
      <button
        className="icon-btn"
        onClick={redo}
        disabled={history.future.length === 0}
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo"
      >
        ↷
      </button>
      <button
        className="icon-btn"
        onClick={() => setResortKey((k) => k + 1)}
        title="Resort and refilter"
        aria-label="Resort and refilter"
      >
        ⟳
      </button>
      <span className="record-count">
        {history.present.length} records{dirty ? ' (unsaved changes)' : ''}
      </span>
    </div>
  )

  console.log(lastImport?.parseErrors);
  
  return (
    <div className="app">
      <div className="tabs">
        <button
          className={`tab${view === 'transactions' ? ' tab-active' : ''}`}
          onClick={() => setView('transactions')}
        >
          Transactions
        </button>
        <button
          className={`tab${view === 'report' ? ' tab-active' : ''}`}
          onClick={() => setView('report')}
        >
          Spending analysis
        </button>
        <button
          className={`tab${view === 'budget' ? ' tab-active' : ''}`}
          onClick={() => setView('budget')}
        >
          Budget
        </button>
        <button
          className={`tab${view === 'settings' ? ' tab-active' : ''}`}
          onClick={() => setView('settings')}
        >
          Settings
        </button>
      </div>

      {/* All panels stay mounted so each view keeps its filter, sort, and
          scroll position when the user switches tabs. */}
      <div
        className={`tab-panel${view !== 'transactions' ? ' tab-panel-hidden' : ''}`}
      >
        {toolbar}
        {lastImport && (
          <p className="import-status">
            Last import: {lastImport.added} added, {lastImport.skipped} skipped,{' '}
            {lastImport.autoIgnored} auto-ignored, {lastImport.parseErrors.length} parse
            errors.
          </p>
        )}
        <Grid
          records={history.present}
          categories={categories}
          active={view === 'transactions'}
          resortKey={resortKey}
          onSetField={handleSetField}
          onRemoveOverride={handleRemoveOverride}
          onToggleIgnored={handleToggleIgnored}
          onDelete={handleDelete}
          onFill={handleFill}
        />
      </div>
      <div className={`tab-panel${view !== 'report' ? ' tab-panel-hidden' : ''}`}>
        {toolbar}
        <Report
          records={history.present}
          categories={categories}
          active={view === 'report'}
          resortKey={resortKey}
          onSetField={handleSetField}
          onRemoveOverride={handleRemoveOverride}
          onToggleIgnored={handleToggleIgnored}
          onDelete={handleDelete}
          onFill={handleFill}
        />
      </div>
      <div className={`tab-panel${view !== 'budget' ? ' tab-panel-hidden' : ''}`}>
        {toolbar}
        <BudgetView
          budgets={budgets}
          availableCategories={availableCategories}
          onChange={setBudgets}
        />
      </div>
      <div className={`tab-panel${view !== 'settings' ? ' tab-panel-hidden' : ''}`}>
        <SettingsView
          categories={categories}
          onAddCategory={handleAddCategory}
          onDeleteCategory={handleDeleteCategory}
        />
      </div>
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  )
}
