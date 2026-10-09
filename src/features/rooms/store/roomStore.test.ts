import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatMessage, Room } from '../../../shared/types'
import { useAuthStore } from '../../auth/store/authStore'
import { useChatStore } from '../../chat/store/chatStore'
import { useVoteStore } from '../../voting/store/voteStore'
import { useWordRaceStore } from '../../wordRace/store/wordRaceStore'
import { initRoomSync, useRoomStore } from './roomStore'

const { emitWithAck, handlers } = vi.hoisted(() => ({
  emitWithAck: vi.fn(),
  handlers: new Map<string, (payload: unknown) => void>(),
}))

vi.mock('../../../shared/lib/socket', () => ({
  emitWithAck,
  connectSocket: vi.fn(),
  socket: {
    on: vi.fn((event: string, handler: (payload: unknown) => void) => handlers.set(event, handler)),
    off: vi.fn(),
    io: { on: vi.fn() },
  },
  SocketDomainError: class extends Error {},
}))

const NOW = '2026-01-01T00:00:00.000Z'

function room(code: string, overrides: Partial<Room> = {}): Room {
  return {
    code,
    hostId: 'host',
    players: [{ id: 'me', displayName: 'Me', role: 'dancer' }],
    dancers: null,
    spectators: [],
    status: 'waiting',
    battle: null,
    songSelection: null,
    selectedSong: null,
    createdAt: NOW,
    ...overrides,
  }
}

function chat(roomCode: string, content: string): ChatMessage {
  return { id: content, roomCode, senderId: 'x', senderName: 'X', content, sentAt: NOW }
}

/** Simulates a server push on the mocked socket. */
function serverEmits(event: string, payload: unknown): void {
  const handler = handlers.get(event)
  if (!handler) throw new Error(`no listener for ${event}`)
  handler(payload)
}

beforeEach(() => {
  emitWithAck.mockReset()
  useAuthStore.setState({ identity: { id: 'me', displayName: 'Me' } })
  useRoomStore.setState({ room: null, error: null, joinError: null })
  useChatStore.getState().clear()
  useWordRaceStore.getState().reset()
  initRoomSync()
})

describe('room payloads from a room the player left', () => {
  it('are ignored, while the current room keeps updating', () => {
    useRoomStore.setState({ room: room('BBBBBB') })

    serverEmits('room:updated', room('AAAAAA'))
    serverEmits('battle:started', room('AAAAAA', { status: 'battling' }))
    serverEmits('battle:finished', room('AAAAAA', { status: 'finished' }))
    serverEmits('chat:message', chat('AAAAAA', 'from the old room'))
    expect(useRoomStore.getState().room?.code).toBe('BBBBBB')
    expect(useRoomStore.getState().room?.status).toBe('waiting')
    expect(useChatStore.getState().messages).toHaveLength(0)

    serverEmits('room:updated', room('BBBBBB', { status: 'battling' }))
    serverEmits('chat:message', chat('BBBBBB', 'hello'))
    expect(useRoomStore.getState().room?.status).toBe('battling')
    expect(useChatStore.getState().messages.map((m) => m.content)).toEqual(['hello'])
  })

  it('are ignored when the player is in no room at all', () => {
    serverEmits('room:updated', room('AAAAAA'))
    expect(useRoomStore.getState().room).toBeNull()
  })

  it('accepts the broadcast of the room being joined before its ack arrives', async () => {
    let answerJoin: (value: Room) => void = () => {}
    emitWithAck.mockImplementation(() => new Promise<Room>((resolve) => (answerJoin = resolve)))

    const joining = useRoomStore.getState().joinRoom('cccccc')
    await Promise.resolve()
    serverEmits('room:updated', room('CCCCCC'))
    expect(useRoomStore.getState().room?.code).toBe('CCCCCC')

    answerJoin(room('CCCCCC'))
    await joining
    serverEmits('room:updated', room('AAAAAA'))
    expect(useRoomStore.getState().room?.code).toBe('CCCCCC')
  })
})

describe('joining another room while still seated in one', () => {
  it('leaves the previous room first and clears its chat and word race', async () => {
    useRoomStore.setState({ room: room('AAAAAA') })
    useChatStore.getState().addMessage(chat('AAAAAA', 'old message'))
    useWordRaceStore.getState().roundStarted({
      roomCode: 'AAAAAA',
      roundId: 'r1',
      roundNumber: 1,
      totalRounds: 3,
      word: 'salsa',
      expiresInMs: 5000,
    })
    emitWithAck.mockImplementation((event: string) =>
      Promise.resolve(event === 'room:join' ? room('BBBBBB') : null),
    )

    await useRoomStore.getState().joinRoom('BBBBBB')

    expect(emitWithAck.mock.calls.map(([event, payload]) => [event, payload])).toEqual([
      ['room:leave', { roomCode: 'AAAAAA', playerId: 'me' }],
      ['room:join', { roomCode: 'BBBBBB', playerId: 'me', displayName: 'Me' }],
    ])
    expect(useRoomStore.getState().room?.code).toBe('BBBBBB')
    expect(useChatStore.getState().messages).toHaveLength(0)
    expect(useWordRaceStore.getState().activeRound).toBeNull()
  })

  it('still joins the new room when the leave fails', async () => {
    useRoomStore.setState({ room: room('AAAAAA') })
    emitWithAck.mockImplementation((event: string) =>
      event === 'room:join' ? Promise.resolve(room('BBBBBB')) : Promise.reject(new Error('gone')),
    )

    await useRoomStore.getState().joinRoom('BBBBBB')

    expect(useRoomStore.getState().room?.code).toBe('BBBBBB')
  })

  it('does not leave when rejoining the same room', async () => {
    useRoomStore.setState({ room: room('AAAAAA') })
    useChatStore.getState().addMessage(chat('AAAAAA', 'kept'))
    emitWithAck.mockResolvedValue(room('AAAAAA'))

    await useRoomStore.getState().joinRoom('aaaaaa')

    expect(emitWithAck).toHaveBeenCalledTimes(1)
    expect(emitWithAck.mock.calls[0][0]).toBe('room:join')
    expect(useChatStore.getState().messages).toHaveLength(1)
  })
})

describe('a failed rejoin', () => {
  it('drops the stale room so the unavailable view can show', async () => {
    useRoomStore.setState({ room: room('AAAAAA') })
    emitWithAck.mockRejectedValue(new Error('Room not found'))

    const result = await useRoomStore.getState().joinRoom('AAAAAA')

    expect(result).toBeNull()
    expect(useRoomStore.getState().room).toBeNull()
    expect(useRoomStore.getState().joinError).toBe('Room not found')
  })
})

describe('a room that goes back to the lobby (rematch)', () => {
  it('resets the vote and the word race of the previous battle, but not on other updates', () => {
    useRoomStore.setState({ room: room('AAAAAA', { status: 'finished' }) })
    useVoteStore.getState().receiveMine({ roomCode: 'AAAAAA', dancerId: 'x' })
    useWordRaceStore.setState({ wins: { x: 2 } })

    serverEmits('room:updated', room('AAAAAA', { status: 'finished' }))
    expect(useVoteStore.getState().dancerId).toBe('x')

    serverEmits('room:updated', room('AAAAAA', { status: 'waiting' }))
    expect(useVoteStore.getState().dancerId).toBeNull()
    expect(useWordRaceStore.getState().wins).toEqual({})
  })
})
