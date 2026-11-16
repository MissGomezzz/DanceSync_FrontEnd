import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { WordRaceBanner } from '../types'
import type { WordRoundView } from './RoundTimer'
import { WordRaceDialogView } from './WordRaceDialogView'

const round = (overrides: Partial<WordRoundView> = {}): WordRoundView => ({
  roundId: 'r1',
  word: 'salsa',
  roundNumber: 1,
  totalRounds: 3,
  remainingMs: 8000,
  totalMs: 10_000,
  ...overrides,
})

const banner: WordRaceBanner = { kind: 'won', text: 'You got it first!', winnerName: 'Me', word: 'salsa' }

function renderDialog(props: Partial<Parameters<typeof WordRaceDialogView>[0]> = {}) {
  const onSubmit = vi.fn()
  const onTypedChange = vi.fn()
  const view = render(
    <WordRaceDialogView
      round={round()}
      result={null}
      typed=""
      submitting={false}
      notice={null}
      onTypedChange={onTypedChange}
      onSubmit={onSubmit}
      {...props}
    />,
  )
  return { ...view, onSubmit, onTypedChange }
}

describe('WordRaceDialogView', () => {
  it('renders nothing without a round or a result', () => {
    renderDialog({ round: null })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows the word with the input focused and submits a typed word', async () => {
    const { onSubmit, onTypedChange } = renderDialog({ typed: 'sals' })

    expect(screen.getByRole('dialog', { name: 'Word 1 of 3' })).toBeTruthy()
    expect(screen.getByTestId('word-race-word').textContent).toBe('salsa')
    const input = screen.getByLabelText('Type the word')
    expect(document.activeElement).toBe(input)

    await userEvent.type(input, 'a')
    expect(onTypedChange).toHaveBeenCalledWith('salsa')
    fireEvent.submit(input.closest('form') as HTMLFormElement)
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('does not submit an empty word, while checking, or once the time is up', () => {
    const { onSubmit, rerender } = renderDialog({ typed: '  ' })
    const form = () => screen.getByLabelText('Type the word').closest('form') as HTMLFormElement
    fireEvent.submit(form())

    const props = { result: null, notice: null, onTypedChange: vi.fn(), onSubmit }
    rerender(<WordRaceDialogView {...props} round={round()} typed="salsa" submitting />)
    expect(screen.getByRole('button', { name: 'Checking...' })).toBeTruthy()
    fireEvent.submit(form())

    rerender(<WordRaceDialogView {...props} round={round({ remainingMs: 0 })} typed="salsa" submitting={false} />)
    expect((screen.getByLabelText('Type the word') as HTMLInputElement).placeholder).toBe("Time's up")
    fireEvent.submit(form())

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows the feedback on the last attempt', () => {
    renderDialog({ notice: 'Not quite, try again' })
    expect(screen.getByRole('alert').textContent).toBe('Not quite, try again')
  })

  it('blocks pasting the word', () => {
    renderDialog()
    const pasted = fireEvent.paste(screen.getByLabelText('Type the word'))
    expect(pasted).toBe(false)
  })

  it('does not close on Escape', () => {
    renderDialog()
    const notCancelled = fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(notCancelled).toBe(false)
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('keeps Tab and Shift+Tab inside the dialog', () => {
    renderDialog({ typed: 'salsa' })
    const input = screen.getByLabelText('Type the word')
    const send = screen.getByRole('button', { name: 'Send' })
    const dialog = screen.getByRole('dialog')

    send.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(input)

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(send)

    // In the middle of the controls the browser moves the focus normally.
    input.focus()
    expect(fireEvent.keyDown(dialog, { key: 'Tab' })).toBe(true)
  })

  it('shows the round result and keeps the focus on the dialog, which has no controls', () => {
    render(
      <WordRaceDialogView round={null} result={banner} typed="" submitting={false} notice={null} onTypedChange={vi.fn()} onSubmit={vi.fn()} />,
    )
    const dialog = screen.getByRole('dialog', { name: 'Round over' })
    expect(screen.getByRole('status').textContent).toBe('You got it first!')
    expect(screen.getByRole('status').getAttribute('data-kind')).toBe('won')
    expect(document.activeElement).toBe(dialog)

    expect(fireEvent.keyDown(dialog, { key: 'Tab' })).toBe(false)
  })

  it('gives the focus back to what had it when the dialog closes', () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const { unmount } = renderDialog()
    expect(document.activeElement).toBe(screen.getByLabelText('Type the word'))
    unmount()

    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })
})
