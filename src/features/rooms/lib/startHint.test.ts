import { describe, expect, it } from 'vitest'
import type { Player } from '../../../shared/types'
import { startHint } from './startHint'

const player = (id: string, displayName: string): Player => ({ id, displayName, role: 'dancer' })

type Input = Parameters<typeof startHint>[0]

/** A lobby ready to start: two dancers, everyone ready, no song yet; seen by the host. */
const hintFor = (overrides: Partial<Input> = {}) =>
  startHint({
    isHost: true,
    myId: 'host',
    hostName: 'Hana',
    dancerCount: 2,
    minDancers: 2,
    choosingSong: false,
    songChosen: false,
    waitingFor: [],
    ...overrides,
  })

describe('startHint', () => {
  it('says nothing to the host when the battle can start', () => {
    expect(hintFor()).toBeNull()
    expect(hintFor({ songChosen: true })).toBeNull()
  })

  it('tells everyone else that the host is the one who starts it', () => {
    expect(hintFor({ isHost: false, myId: 'ana' })).toBe('Waiting for Hana to start the battle.')
    expect(hintFor({ isHost: false, myId: 'ana', hostName: null })).toBe('Waiting for the host to start the battle.')
  })

  it.each([true, false])('asks for enough dancers (host: %s)', (isHost) => {
    expect(hintFor({ isHost, dancerCount: 1 })).toBe('At least 2 players must choose "Dance" to start.')
  })

  it('names who is not ready, with the viewer first as "you"', () => {
    const ana = player('ana', 'Ana')
    const ben = player('ben', 'Ben')
    const cy = player('cy', 'Cy')

    expect(hintFor({ waitingFor: [ana] })).toBe('Waiting for Ana to be ready.')
    expect(hintFor({ waitingFor: [ana, ben] })).toBe('Waiting for Ana and Ben to be ready.')
    expect(hintFor({ waitingFor: [ana, ben, cy] })).toBe('Waiting for Ana, Ben and Cy to be ready.')
    expect(hintFor({ isHost: false, myId: 'ben', waitingFor: [ben] })).toBe('Waiting for you to be ready.')
    expect(hintFor({ isHost: false, myId: 'ben', waitingFor: [ana, ben, cy] })).toBe(
      'Waiting for you, Ana and Cy to be ready.',
    )
  })

  it('explains to everyone why a battle with a chosen song is not starting', () => {
    const ana = player('ana', 'Ana')
    const stuck = "The song is chosen, but the battle can't start yet."

    for (const isHost of [true, false]) {
      expect(hintFor({ isHost, songChosen: true, waitingFor: [ana] })).toBe(`${stuck} Waiting for Ana to be ready.`)
      expect(hintFor({ isHost, songChosen: true, dancerCount: 1 })).toBe(
        `${stuck} At least 2 players must choose "Dance" to start.`,
      )
    }
  })

  it('leaves the song challenge to its own panel, and only asks the host to wait', () => {
    expect(hintFor({ choosingSong: true })).toBe('Wait until the song has been chosen.')
    expect(hintFor({ isHost: false, myId: 'ana', choosingSong: true })).toBeNull()
    // Not ready during the challenge: nothing can start anyway, so no extra noise.
    expect(hintFor({ isHost: false, myId: 'ana', choosingSong: true, waitingFor: [player('ana', 'Ana')] })).toBeNull()
  })
})
