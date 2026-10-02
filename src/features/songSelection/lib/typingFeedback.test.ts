import { describe, expect, it } from 'vitest'
import { compareTyping } from './typingFeedback'

const statuses = (target: string, typed: string) => compareTyping(target, typed).chars.map((c) => c.status[0]).join('')

describe('compareTyping', () => {
  it('marks every character pending before typing', () => {
    const feedback = compareTyping('dale play', '')
    expect(statuses('dale play', '')).toBe('ppppppppp')
    expect(feedback.hasError).toBe(false)
    expect(feedback.isComplete).toBe(false)
    expect(feedback.correctPrefix).toBe(0)
  })

  it('marks correct characters as the player types', () => {
    expect(statuses('ritmo', 'rit')).toBe('cccpp')
    expect(compareTyping('ritmo', 'rit').correctPrefix).toBe(3)
  })

  it('highlights wrong characters and keeps evaluating the rest', () => {
    expect(statuses('ritmo', 'rytmo')).toBe('ciccc')
    const feedback = compareTyping('ritmo', 'rytmo')
    expect(feedback.hasError).toBe(true)
    expect(feedback.correctPrefix).toBe(1)
    expect(feedback.isComplete).toBe(false)
  })

  it('is case sensitive', () => {
    expect(compareTyping('ritmo', 'Ritmo').hasError).toBe(true)
  })

  it('counts extra characters as an error', () => {
    const feedback = compareTyping('ritmo', 'ritmos')
    expect(feedback.extraCount).toBe(1)
    expect(feedback.hasError).toBe(true)
  })

  it('is complete on an exact match', () => {
    const feedback = compareTyping('dale play', 'dale play')
    expect(feedback.isComplete).toBe(true)
    expect(feedback.hasError).toBe(false)
  })
})
