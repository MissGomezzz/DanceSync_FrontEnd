import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Player, Room } from '../../../shared/types'
import { useAuthStore } from '../../auth/store/authStore'
import { useRoomStore } from '../../rooms/store/roomStore'
import { useCameraStore } from '../store/cameraStore'
import { usePeerStore } from '../store/peerStore'
import { useBattleVideo } from './useBattleVideo'

const { createPeerSession } = vi.hoisted(() => ({
  createPeerSession: vi.fn(() => ({ dispose: vi.fn() })),
}))

vi.mock('../lib/peerSession', () => ({ createPeerSession }))
vi.mock('../../../shared/lib/socket', () => ({
  emitWithAck: vi.fn(),
  connectSocket: vi.fn(),
  socket: { on: vi.fn(), off: vi.fn(), io: { on: vi.fn() } },
  SocketDomainError: class extends Error {},
}))

const NOW = '2026-01-01T00:00:00.000Z'

const player = (id: string, role: Player['role']): Player => ({ id, displayName: id.toUpperCase(), role })

/** Battle with three dancers (a, b, c) and the spectator fan. */
function battleRoom(): Room {
  const dancers = ['a', 'b', 'c'].map((id) => player(id, 'dancer'))
  const fan = player('fan', 'spectator')
  return {
    code: 'ROOM01',
    hostId: 'a',
    players: [...dancers, fan],
    dancers,
    spectators: [fan],
    status: 'battling',
    battle: {
      id: 'battle',
      roomCode: 'ROOM01',
      dancerIds: dancers.map((d) => d.id),
      song: null,
      ratings: [],
      startedAt: NOW,
      finishedAt: null,
      result: null,
    },
    songSelection: null,
    selectedSong: null,
    createdAt: NOW,
  }
}

const fakeStream = (label: string) => ({ id: label }) as unknown as MediaStream

beforeEach(() => {
  createPeerSession.mockClear()
  usePeerStore.getState().reset()
  useRoomStore.setState({ room: battleRoom() })
  useCameraStore.setState({ checkPermission: vi.fn(async () => {}), stopCamera: vi.fn(), localStream: null })
})

describe('useBattleVideo', () => {
  it('returns one video per dancer, not only the first two', () => {
    useAuthStore.setState({ identity: { id: 'fan', displayName: 'FAN' } })
    const { result } = renderHook(() => useBattleVideo('ROOM01'))

    expect(result.current.dancerVideos.map((v) => v.dancer.id)).toEqual(['a', 'b', 'c'])
    expect(result.current.dancerVideos.every((v) => !v.isMe)).toBe(true)
    expect(result.current.needsCameraPrompt).toBe(false)
  })

  it('maps each remote stream and connection state to its own dancer', () => {
    useAuthStore.setState({ identity: { id: 'fan', displayName: 'FAN' } })
    const { result } = renderHook(() => useBattleVideo('ROOM01'))
    const streamC = fakeStream('c')

    act(() => {
      usePeerStore.getState().setRemoteStream('c', streamC)
      usePeerStore.getState().setConnectionState('b', 'connecting')
    })

    const [a, b, c] = result.current.dancerVideos
    expect(a.stream).toBeNull()
    expect(a.placeholder).toBe("Waiting for A's camera...")
    expect(b.placeholder).toBe("Connecting to B's camera...")
    expect(c.stream).toBe(streamC)
  })

  it('shows the local preview in the local dancer tile among the others', () => {
    const mine = fakeStream('mine')
    useAuthStore.setState({ identity: { id: 'b', displayName: 'B' } })
    useCameraStore.setState({ localStream: mine, status: 'granted' })
    const { result } = renderHook(() => useBattleVideo('ROOM01'))

    const videos = result.current.dancerVideos
    expect(videos).toHaveLength(3)
    expect(videos.filter((v) => v.isMe).map((v) => v.dancer.id)).toEqual(['b'])
    expect(videos[1].stream).toBe(mine)
    expect(createPeerSession).toHaveBeenCalledWith(expect.objectContaining({ myId: 'b', isDancer: true, localStream: mine }))
  })

  it('is empty before the battle starts', () => {
    useAuthStore.setState({ identity: { id: 'fan', displayName: 'FAN' } })
    useRoomStore.setState({ room: { ...battleRoom(), status: 'waiting', dancers: null, battle: null } })
    const { result } = renderHook(() => useBattleVideo('ROOM01'))
    expect(result.current.dancerVideos).toEqual([])
  })
})
