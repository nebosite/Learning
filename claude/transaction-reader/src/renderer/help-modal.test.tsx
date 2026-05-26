import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HelpModal } from './help-modal'

describe('HelpModal', () => {
  it('reads the README via window.api and renders the markdown', async () => {
    window.api.readReadme = vi.fn(async () => '# Hello\n\nWelcome to **Transaction Reader**.')
    render(<HelpModal onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Hello' })).toBeInTheDocument()
    })
    // The markdown emphasis is rendered as an HTML element, not literal asterisks.
    expect(screen.getByText('Transaction Reader').tagName.toLowerCase()).toBe('strong')
  })

  it('closes when the user presses Escape', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<HelpModal onClose={onClose} />)

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('closes when the user clicks the close button', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<HelpModal onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows an error message if the README cannot be loaded', async () => {
    window.api.readReadme = vi.fn(async () => {
      throw new Error('boom')
    })
    render(<HelpModal onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/could not load help/i)).toBeInTheDocument()
    })
  })
})
