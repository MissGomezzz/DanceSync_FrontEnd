import { describe, expect, it } from 'vitest'
import type { WordRoundEndedEvent } from '../types'
import { outcomeMessage } from './outcomeMessage'

function ended(overrides: Partial<WordRoundEndedEvent> = {}): WordRoundEndedEvent {
  return {
    roomCode: 'ROOM01',
    roundId: 'b:1',
    roundNumber: 1,
    totalRounds: 3,
    word: 'salsa',
    winnerId: 'rival',
    winnerName: 'Rival',
    reason: 'won',
    wins: { me: 0, rival: 1 },
    ...overrides,
  }
}

describe('outcomeMessage', () => {
  it('congratulates the winner', () => {
    const banner = outcomeMessage({ myId: 'me', isDancer: true, outcome: 'won', ended: ended({ winnerId: 'me', winnerName: 'Me' }) })
    expect(banner.kind).toBe('won')
    expect(banner.text).toBe('You were first! You win this round.')
  })

  it('tells a dancer who did not make it who won', () => {
    const banner = outcomeMessage({ myId: 'me', isDancer: true, outcome: null, ended: ended() })
    expect(banner.kind).toBe('lost')
    expect(banner.text).toBe('Too slow! Rival typed it first.')
  })

  it('tells a dancer whose correct word arrived late that someone got there first', () => {
    const banner = outcomeMessage({ myId: 'me', isDancer: true, outcome: 'late', ended: ended() })
    expect(banner.kind).toBe('late')
    expect(banner.text).toBe('You typed it, but Rival got there first.')
  })

  it('shows spectators who won', () => {
    const banner = outcomeMessage({ myId: 'fan', isDancer: false, outcome: null, ended: ended() })
    expect(banner.kind).toBe('watching')
    expect(banner.text).toBe('Rival typed it first!')
  })

  it('announces an expired round to everyone', () => {
    const input = { ended: ended({ reason: 'expired', winnerId: null, winnerName: null }), outcome: null }
    for (const viewer of [{ myId: 'me', isDancer: true }, { myId: 'fan', isDancer: false }]) {
      const banner = outcomeMessage({ ...viewer, ...input })
      expect(banner.kind).toBe('expired')
      expect(banner.text).toBe('Time\'s up! Nobody typed "salsa".')
    }
  })

  it('falls back to a generic name when the winner name is unknown', () => {
    expect(outcomeMessage({ myId: 'me', isDancer: true, outcome: null, ended: ended({ winnerName: null }) }).text).toBe(
      'Too slow! Another dancer typed it first.',
    )
  })
})
