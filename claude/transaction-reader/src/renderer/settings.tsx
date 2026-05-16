import { useState } from 'react'
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
