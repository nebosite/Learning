import { useEffect, useState } from 'react'
import { marked } from 'marked'
import './help-modal.css'

interface HelpModalProps {
  onClose: () => void
}

export function HelpModal({ onClose }: HelpModalProps): JSX.Element {
  const [html, setHtml] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    window.api
      .readReadme()
      .then((text) => marked.parse(text))
      .then((rendered) => {
        if (cancelled) return
        // marked.parse may return a Promise<string> depending on options; the
        // intervening await above always resolves it to the string form.
        setHtml(typeof rendered === 'string' ? rendered : '')
        setLoaded(true)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
        setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="help-modal-backdrop" onClick={onClose}>
      <div
        className="help-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Help"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="help-modal-header">
          <h2 className="help-modal-title">Help</h2>
          <button
            type="button"
            className="help-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="help-modal-body">
          {!loaded && <p className="help-modal-loading">Loading…</p>}
          {error && (
            <p className="help-modal-error">Could not load help: {error}</p>
          )}
          {loaded && !error && (
            <div
              className="markdown-body"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
