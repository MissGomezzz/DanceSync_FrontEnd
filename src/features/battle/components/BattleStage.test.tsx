import { act, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Battle, Room } from '../../../shared/types'
import { useAuthStore } from '../../auth/store/authStore'
import { useRoomStore } from '../../rooms/store/roomStore'
import { BattleStage } from './BattleStage'

const { emitWithAck, songPlayer } = vi.hoisted(() => ({ emitWithAck: vi.fn(), songPlayer: vi.fn() }))

vi.mock('../../../shared/lib/socket', () => ({
  emitWithAck,
  connectSocket: vi.fn(),
  socket: { on: vi.fn(), off: vi.fn(), io: { on: vi.fn() } },
  SocketDomainError: class extends Error {},
}))
vi.mock('../../camera/hooks/useBattleVideo', () => ({
  useBattleVideo: () => ({ dancerVideos: [], needsCameraPrompt: false }),
}))
vi.mock('../../wordRace/hooks/useWordRaceSync', () => ({ useWordRaceSync: () => {} }))
vi.mock('../../wordRace/components/WordRaceOverlay', () => ({ WordRaceOverlay: () => null }))
vi.mock('../../songSelection/components/SongPlayer', () => ({
  YOUTUBE_API_UNAVAILABLE: -1,
  SongPlayer: (props: { startAt: number | null; durationSeconds: number }) => {
    songPlayer(props)
    return null
  },
}))

const SKEW_MS = 90_000

function battlingRoom(battle: Partial<Battle>): Room {
  const dancers = [
    { id: 'me', displayName: 'Me', role: 'dancer' as const },
    { id: 'rival', displayName: 'Rival', role: 'dancer' as const },
  ]
  return {
    code: 'ROOM01',
    hostId: 'me',
    players: dancers,
    dancers,
    spectators: [],
    status: 'battling',
    battle: {
      id: 'b1',
      roomCode: 'ROOM01',
      dancerIds: ['me', 'rival'],
      song: { id: 's1', title: 'Song', artist: 'Artist', durationSeconds: 120, youtubeId: 'yt1' },
      startedAt: new Date(Date.now() - SKEW_MS - 30_000).toISOString(),
      finishedAt: null,
      result: null,
      ...battle,
    },
    songSelection: null,
    selectedSong: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

async function renderWith(room: Room) {
  useRoomStore.setState({ room })
  emitWithAck.mockImplementation((event: string) =>
    event === 'room:join' ? Promise.resolve(room) : new Promise(() => {}),
  )
  render(
    <MemoryRouter>
      <BattleStage roomCode="ROOM01" />
    </MemoryRouter>,
  )
  await act(async () => {})
  return songPlayer.mock.lastCall?.[0] as { startAt: number | null; durationSeconds: number }
}

beforeEach(() => {
  songPlayer.mockReset()
  emitWithAck.mockReset()
  useAuthStore.setState({ identity: { id: 'me', displayName: 'Me' } })
  // This device's wall clock runs 90 s ahead of the server.
  vi.spyOn(Date, 'now').mockImplementation(() => new Date().getTime() + SKEW_MS)
})

afterEach(() => {
  vi.restoreAllMocks()
  useRoomStore.setState({ room: null, error: null, joinError: null })
})

describe('BattleStage song timing', () => {
  it('starts the song from the server-relative startsInMs, ignoring the skewed wall clock', async () => {
    // Started 30 s ago by the server's clock; startedAt is on the server's clock too.
    const props = await renderWith(battlingRoom({ startsInMs: -30_000, startedAt: new Date().toISOString() }))

    expect(props.startAt).not.toBeNull()
    expect(performance.now() - (props.startAt ?? 0)).toBeGreaterThan(29_000)
    expect(performance.now() - (props.startAt ?? 0)).toBeLessThan(31_000)
    expect(props.durationSeconds).toBe(120)
  })

  it('falls back to the absolute startedAt when the server does not send startsInMs', async () => {
    const startedAt = new Date(Date.now() - 10_000).toISOString()
    const props = await renderWith(battlingRoom({ startedAt }))

    expect(performance.now() - (props.startAt ?? 0)).toBeGreaterThan(9_000)
    expect(performance.now() - (props.startAt ?? 0)).toBeLessThan(11_000)
  })
})
