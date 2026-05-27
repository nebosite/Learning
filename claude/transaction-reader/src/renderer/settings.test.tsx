import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsView } from './settings'

function renderView(
  categories: string[],
  usedKeys: string[] = [],
  overrides: Partial<{
    onAddCategory: (name: string) => void
    onDeleteCategory: (name: string) => void
    onDeleteUnusedCategories: () => void
    onRenameCategory: (oldName: string, newName: string) => void
  }> = {},
) {
  const onAddCategory = overrides.onAddCategory ?? vi.fn()
  const onDeleteCategory = overrides.onDeleteCategory ?? vi.fn()
  const onDeleteUnusedCategories = overrides.onDeleteUnusedCategories ?? vi.fn()
  const onRenameCategory = overrides.onRenameCategory ?? vi.fn()
  render(
    <SettingsView
      categories={categories}
      usedCategoryKeys={new Set(usedKeys.map((k) => k.toLowerCase()))}
      onAddCategory={onAddCategory}
      onDeleteCategory={onDeleteCategory}
      onDeleteUnusedCategories={onDeleteUnusedCategories}
      onRenameCategory={onRenameCategory}
    />,
  )
  return { onAddCategory, onDeleteCategory, onDeleteUnusedCategories, onRenameCategory }
}

describe('SettingsView', () => {
  it('marks unused categories with the settings-category-unused class', () => {
    renderView(['Food', 'Books'], ['food'])
    const food = screen.getByText('Food').closest('li')!
    const books = screen.getByText('Books').closest('li')!
    expect(food).not.toHaveClass('settings-category-unused')
    expect(books).toHaveClass('settings-category-unused')
  })

  it('matches used categories case-insensitively', () => {
    renderView(['FOOD'], ['food'])
    const food = screen.getByText('FOOD').closest('li')!
    expect(food).not.toHaveClass('settings-category-unused')
  })

  it('disables the "Delete unused categories" button when every category is used', () => {
    renderView(['Food'], ['food'])
    expect(
      screen.getByRole('button', { name: /Delete unused categories/i }),
    ).toBeDisabled()
  })

  it('enables the button and calls onDeleteUnusedCategories on click', async () => {
    const onDeleteUnusedCategories = vi.fn()
    renderView(['Food', 'Books'], ['food'], { onDeleteUnusedCategories })

    const btn = screen.getByRole('button', { name: /Delete unused categories/i })
    expect(btn).not.toBeDisabled()

    const user = userEvent.setup()
    await user.click(btn)
    expect(onDeleteUnusedCategories).toHaveBeenCalledOnce()
  })

  it('clicking a category name opens an inline editor with the current value', async () => {
    renderView(['Food'])
    const user = userEvent.setup()
    await user.click(screen.getByText('Food'))
    expect(screen.getByDisplayValue('Food')).toBeInTheDocument()
  })

  it('Enter commits the edit and calls onRenameCategory with the new name', async () => {
    const onRenameCategory = vi.fn()
    renderView(['Food'], [], { onRenameCategory })
    const user = userEvent.setup()
    await user.click(screen.getByText('Food'))
    const input = screen.getByDisplayValue('Food')
    await user.clear(input)
    await user.type(input, 'Eating Out')
    await user.keyboard('{Enter}')
    expect(onRenameCategory).toHaveBeenCalledWith('Food', 'Eating Out')
  })

  it('Escape cancels without calling onRenameCategory', async () => {
    const onRenameCategory = vi.fn()
    renderView(['Food'], [], { onRenameCategory })
    const user = userEvent.setup()
    await user.click(screen.getByText('Food'))
    const input = screen.getByDisplayValue('Food')
    await user.clear(input)
    await user.type(input, 'Eating Out')
    await user.keyboard('{Escape}')
    expect(onRenameCategory).not.toHaveBeenCalled()
  })

  it('committing with the same name does not call onRenameCategory', async () => {
    const onRenameCategory = vi.fn()
    renderView(['Food'], [], { onRenameCategory })
    const user = userEvent.setup()
    await user.click(screen.getByText('Food'))
    await user.keyboard('{Enter}')
    expect(onRenameCategory).not.toHaveBeenCalled()
  })

  it('still lets you add a new category', async () => {
    const onAddCategory = vi.fn()
    renderView([], [], { onAddCategory })
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('New category'), 'Travel')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(onAddCategory).toHaveBeenCalledWith('Travel')
  })
})
