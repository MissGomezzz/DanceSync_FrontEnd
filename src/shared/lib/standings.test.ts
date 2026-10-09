import { describe, expect, it } from 'vitest'
import type { Battle, Room } from '../types'
import {
  formatDelta,
  leaderIds,
  liveStandings,
  nameResolver,
  ordinal,
  rankEntries,
  rankTone,
  resultStandings,
  wordTally,
  wordsWonOf,
} from './standings'

function room(battle: Partial<Battle> = {}): Room {
  const dancers = [
    { id: 'a', displayName: 'Ana', role: 'dancer' as const },
    { id: 'b', displayName: 'Ben', role: 'dancer' as const },
    { id: 'c', displayName: 'Cy', role: 'dancer' as const },
  ]
  return {
    code: 'ROOM01',
    hostId: 'a',
    players: dancers,
    dancers,
    spectators: [],
    status: 'battling',
    battle: {
      id: 'b1',
      roomCode: 'ROOM01',
      dancerIds: ['a', 'b', 'c'],
      song: null,
      startedAt: '2026-01-01T00:00:00.000Z',
      finishedAt: null,
      result: null,
      ...battle,
    },
    songSelection: null,
    selectedSong: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

const entry = (dancerId: string, score: number) => ({ dancerId, displayName: dancerId, votes: 0, wordsWon: 0, score })

describe('rankEntries', () => {
  it('uses competition ranking: equal scores share a rank and the next rank skips', () => {
    const ranked = rankEntries([entry('c', 1), entry('a', 5), entry('b', 5), entry('d', 0)])

    expect(ranked.map((s) => [s.dancerId, s.rank])).toEqual([
      ['a', 1],
      ['b', 1],
      ['c', 3],
      ['d', 4],
    ])
  })
})

describe('liveStandings', () => {
  it("returns the server's standings untouched when it sends them", () => {
    const standings = [{ dancerId: 'b', displayName: 'Ben', votes: 1, wordsWon: 0, score: 2, rank: 1 }]
    expect(liveStandings(room({ standings }))).toBe(standings)
  })

  it('rebuilds the ranking from voteCounts and wordsWon (2 points a vote, 1 a word)', () => {
    const standings = liveStandings(room({ voteCounts: { a: 1, b: 2 }, wordsWon: { a: 3 } }))

    expect(standings.map((s) => [s.displayName, s.votes, s.wordsWon, s.score, s.rank])).toEqual([
      ['Ana', 1, 3, 5, 1],
      ['Ben', 2, 0, 4, 2],
      ['Cy', 0, 0, 0, 3],
    ])
  })
})

describe('wordsWonOf', () => {
  it('prefers wordsWon and still reads the older bonusPoints name', () => {
    expect(wordsWonOf(room({ wordsWon: { a: 2 }, bonusPoints: { a: 9 } }).battle)).toEqual({ a: 2 })
    expect(wordsWonOf(room({ bonusPoints: { b: 1 } }).battle)).toEqual({ b: 1 })
    expect(wordsWonOf(null)).toEqual({})
  })
})

describe('wordTally', () => {
  it('keeps the higher count per dancer, so the tiles agree with the ranking', () => {
    expect(wordTally({ a: 2, b: 0 }, { a: 1, c: 1 })).toEqual({ a: 2, b: 0, c: 1 })
  })
})

describe('resultStandings', () => {
  it('uses the result standings, or rebuilds them from legacy scores', () => {
    const standings = [{ dancerId: 'a', displayName: 'Ana', votes: 2, wordsWon: 1, score: 5, rank: 1 }]
    expect(resultStandings({ standings, winnerId: 'a' }, room())).toBe(standings)

    const legacy = resultStandings({ scores: { a: 3, b: 7 }, winnerId: 'b' }, room())
    expect(legacy?.map((s) => [s.displayName, s.score, s.rank])).toEqual([
      ['Ben', 7, 1],
      ['Ana', 3, 2],
    ])
    expect(resultStandings({ winnerId: null }, room())).toBeNull()
    expect(resultStandings(null, room())).toBeNull()
  })
})

describe('nameResolver', () => {
  it('names a dancer who left from the roster, and falls back to "Former dancer"', () => {
    const nameOf = nameResolver(room({ roster: [{ id: 'z', displayName: 'Zoe' }] }))
    expect(nameOf('z')).toBe('Zoe')
    expect(nameOf('a')).toBe('Ana')
    expect(nameOf('nobody')).toBe('Former dancer')
  })
})

describe('leaderIds', () => {
  it('is the winner, or every dancer sharing the top rank on a draw', () => {
    const standings = rankEntries([entry('a', 4), entry('b', 4), entry('c', 1)])
    expect(leaderIds(standings, 'a')).toEqual(['a'])
    expect(leaderIds(standings, null)).toEqual(['a', 'b'])
  })
})

describe('formatting', () => {
  it('writes ordinals, rank tones and signed deltas', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 103].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '103rd',
    ])
    expect([1, 2, 3, 4, 7].map(rankTone)).toEqual(['gold', 'silver', 'bronze', 'neutral', 'neutral'])
    expect(formatDelta(2)).toBe('+2')
    expect(formatDelta(-1)).toBe('−1')
  })
})
