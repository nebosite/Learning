import { useEffect, useState } from 'react'
import './settings.css'

interface SettingsViewProps {
  categories: string[]
  /** Lowercased effective categories that appear in records — for highlighting unused customs. */
  usedCategoryKeys: Set<string>
  onAddCategory: (name: string) => void
  onDeleteCategory: (name: string) => void
  onDeleteUnusedCategories: () => void
}

export function SettingsView({
  categories,
  usedCategoryKeys,
  onAddCategory,
  onDeleteCategory,
  onDeleteUnusedCategories,
}: SettingsViewProps): JSX.Element {
  const [input, setInput] = useState('')
  const [settingsPath, setSettingsPath] = useState<string | null>(null)

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
              <span>{cat}</span>
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
