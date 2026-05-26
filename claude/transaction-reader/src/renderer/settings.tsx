import { useEffect, useState } from 'react'
import './settings.css'

interface SettingsViewProps {
  categories: string[]
  onAddCategory: (name: string) => void
  onDeleteCategory: (name: string) => void
}

export function SettingsView({
  categories,
  onAddCategory,
  onDeleteCategory,
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
      <h2>Custom Categories</h2>
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
            <li key={cat}>
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
