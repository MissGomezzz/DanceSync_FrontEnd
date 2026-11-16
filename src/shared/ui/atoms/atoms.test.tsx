import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'
import { Input } from './Input'

const classes = (element: HTMLElement) => element.className.split(/\s+/)

describe('Button', () => {
  it('is a plain button that reports clicks and shows a focus ring', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Go</Button>)
    const button = screen.getByRole('button', { name: 'Go' })

    await userEvent.click(button)

    expect(button.getAttribute('type')).toBe('button')
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(classes(button)).toContain('focus-visible:outline-primary')
  })

  it('grows to a 44 px target on touch screens only, so desktop layouts keep their size', () => {
    render(<Button className="px-2 py-1 text-xs">Remove</Button>)
    const button = screen.getByRole('button', { name: 'Remove' })

    expect(classes(button)).toContain('pointer-coarse:min-h-11')
    expect(classes(button)).not.toContain('min-h-11')
    // The caller's classes (a small button) are kept.
    expect(classes(button)).toContain('text-xs')
  })

  it('ignores clicks and looks disabled while disabled', async () => {
    const onClick = vi.fn()
    render(
      <Button variant="danger" disabled onClick={onClick}>
        Leave
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Leave' })

    await userEvent.click(button)

    expect(onClick).not.toHaveBeenCalled()
    expect(classes(button)).toContain('disabled:opacity-50')
    expect(classes(button)).toContain('disabled:cursor-not-allowed')
  })
})

describe('Input', () => {
  it('ties the label to the field', () => {
    render(<Input id="name" label="Your name" defaultValue="Ana" />)
    expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('Ana')
  })

  it('uses 16 px text on phones, so iOS does not zoom the page on focus', () => {
    render(<Input id="name" aria-label="Name" />)
    const input = screen.getByLabelText('Name')

    expect(classes(input)).toContain('text-base')
    expect(classes(input)).toContain('sm:text-sm')
  })

  it('draws the placeholder in an opaque colour that reaches AA contrast on white', () => {
    render(<Input id="name" aria-label="Name" placeholder="Write a message" />)
    const input = screen.getByPlaceholderText('Write a message')

    expect(classes(input)).toContain('placeholder:text-ink-soft')
    expect(input.className).not.toMatch(/placeholder:text-[\w-]+\/\d+/)
  })

  it('shows a focus ring and a disabled state', () => {
    render(<Input id="name" aria-label="Name" disabled />)
    const input = screen.getByLabelText('Name')

    expect(classes(input)).toContain('focus:ring-2')
    expect(classes(input)).toContain('disabled:opacity-50')
  })
})
