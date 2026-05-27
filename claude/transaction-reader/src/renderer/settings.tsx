import { useEffect, useRef, useState } from 'react'
import './settings.css'

interface SettingsViewProps {
  categories: string[]
  /** Lowercased effective categories that appear in records — for highlighting unused customs. */
  usedCategoryKeys: Set<string>
  onAddCategory: (name: string) => void
  onDeleteCategory: (name: string) => void
  onDeleteUnusedCategories: () => void
  /** Cascades to records and budgets. See App's `handleRenameCategory`. */
  onRenameCategory: (oldName: string, newName: string) => void
}

export function SettingsView({
  categories,
  usedCategoryKeys,
  onAddCategory,
  onDeleteCategory,
  onDeleteUnusedCategories,
  onRenameCategory,
}: SettingsViewProps): JSX.Element {
  const [input, setInput] = useState('')
  const [settingsPath, setSettingsPath] = useState<string | null>(null)
  // The category currently being renamed inline, by its original name.
  const [editingName, setEditingName] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    window.api.getSettingsPath().then((p) => {
      if (!cancelled) setSettingsPath(p)
    })
    return () => {
      cancelled = true
    }
  }, [])

  function submit(): void {
    const trimmed = input.trim()
    if (trimmed === '') return
    onAddCategory(trimmed)
    setInput('')
  }

  const sorted = [...categories].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  )

  const isUsed = (name: string): boolean =>
    usedCategoryKeys.has(name.trim().toLowerCase())

  const unusedCount = sorted.filter((c) => !isUsed(c)).length

  return (
    <div className="settings">
      {settingsPath && (
        <button
          type="button"
          className="settings-path-note"
          onClick={() => void window.api.showInFolder(settingsPath)}
          title="Open this file in the OS file explorer"
        >
          Settings file: {settingsPath}
        </button>
      )}
      <div className="settings-title-row">
        <h2>Custom Categories</h2>
        <button
          type="button"
          className="settings-delete-unused"
          onClick={onDeleteUnusedCategories}
          disabled={unusedCount === 0}
          title={
            unusedCount === 0
              ? 'No unused categories'
              : `Delete ${unusedCount} categor${unusedCount === 1 ? 'y' : 'ies'} with no matching transactions`
          }
        >
          Delete unused categories
        </button>
      </div>
      <div className="settings-add">
        <input
          type="text"
          value={input}
          placeholder="New category"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
        />
        <button onClick={submit}>Add</button>
      </div>
      {sorted.length === 0 ? (
        <p className="settings-empty">No categories yet.</p>
      ) : (
        <ul className="settings-list">
          {sorted.map((cat) => (
            <li
              key={cat}
              className={isUsed(cat) ? '' : 'settings-category-unused'}
              title={isUsed(cat) ? undefined : 'No matching transactions'}
            >
              {editingName === cat ? (
                <CategoryEditor
                  initial={cat}
                  onCommit={(next) => {
                    setEditingName(null)
                    const trimmed = next.trim()
                    if (trimmed !== '' && trimmed !== cat) {
                      onRenameCategory(cat, trimmed)
                    }
                  }}
                  onCancel={() => setEditingName(null)}
                />
              ) : (
                <span
                  className="settings-category-name"
                  onClick={() => setEditingName(cat)}
                  title="Click to rename"
                >
                  {cat}
                </span>
              )}
              <button
                type="button"
                className="settings-delete"
                onClick={() => onDeleteCategory(cat)}
                title={`Delete ${cat}`}
                aria-label={`Delete ${cat}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Inline name editor: focus on mount, Enter / blur commit, Escape cancels. */
function CategoryEditor({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string
  onCommit: (next: string) => void
  onCancel: () => void
}): JSX.Element {
  const [value, setValue] = useState(initial)
  const ref = useRef<HTMLInputElement>(null)
  // Guards against a trailing blur committing again after Enter/Escape
  // already resolved the edit.
  const doneRef = useRef(false)

  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  function commit(): void {
    if (doneRef.current) return
    doneRef.current = true
    onCommit(value)
  }

  function cancel(): void {
    if (doneRef.current) return
    doneRef.current = true
    onCancel()
  }

  return (
    <input
      ref={ref}
      className="settings-category-input"
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          cancel()
        }
      }}
    />
  )
}
