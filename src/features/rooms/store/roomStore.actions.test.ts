import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Room } from '../../../shared/types'
import { useAuthStore } from '../../auth/store/authStore'
import { useVoteStore } from '../../voting/store/voteStore'
import { initRoomSync, KICKED_NOTICE, SIGN_IN_REQUIRED, useRoomStore } from './roomStore'

const { emitWithAck, post, handlers, ioHandlers, DomainError } = vi.hoisted(() => {
  class DomainError extends Error {
    readonly code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  }
  return {
    emitWithAck: vi.fn(),
    post: vi.fn(),
    handlers: new Map<string, (payload: unknown) => void>(),
    ioHandlers: new Map<string, () => void>(),
    DomainError,
  }
})

vi.mock('../../../shared/api/httpClient', () => ({ httpClient: { post } }))
vi.mock('../../../shared/lib/socket', () => ({
  emitWithAck,
  connectSocket: vi.fn(),
  socket: {
    on: vi.fn((event: string, handler: (payload: unknown) => void) => handlers.set(event, handler)),
    off: vi.fn(),
    io: { on: vi.fn((event: string, handler: () => void) => ioHandlers.set(event, handler)) },
  },
  SocketDomainError: DomainError,
}))

const NOW = '2026-01-01T00:00:00.000Z'

function room(code = 'ROOM01', overrides: Partial<Room> = {}): Room {
  return {
    code,
    hostId: 'me',
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

function serverEmits(event: string, payload: unknown): void {
  const handler = handlers.get(event)
  if (!handler) throw new Error(`no listener for ${event}`)
  handler(payload)
}

beforeEach(() => {
  emitWithAck.mockReset()
  post.mockReset()
  sessionStorage.clear()
  useAuthStore.setState({ identity: { id: 'me', displayName: 'Me' }, session: { kind: 'user' } })
  useRoomStore.setState({ room: null, error: null, joinError: null, notice: null, kickedFrom: null })
  initRoomSync()
})

describe('createRoom', () => {
  it('creates the room as the signed-in user with the chosen name, then joins it', async () => {
    post.mockResolvedValue(room('NEW001'))
    emitWithAck.mockResolvedValue(room('NEW001'))

    const created = await useRoomStore.getState().createRoom('  Host Name ')

    expect(post).toHaveBeenCalledWith('/api/rooms', { displayName: 'Host Name' })
    expect(emitWithAck).toHaveBeenCalledWith('room:join', { roomCode: 'NEW001', playerId: 'me', displayName: 'Host Name' })
    expect(created?.code).toBe('NEW001')
    expect(useRoomStore.getState().room?.code).toBe('NEW001')
  })

  it('asks to sign in when there is no session', async () => {
    useAuthStore.setState({ identity: null, session: null })
    expect(await useRoomStore.getState().createRoom('Host')).toBeNull()
    expect(useRoomStore.getState().error).toBe(SIGN_IN_REQUIRED)
    expect(post).not.toHaveBeenCalled()
  })

  it('shows why the room could not be created', async () => {
    post.mockRejectedValue(new Error('Only signed-in users can create rooms'))
    expect(await useRoomStore.getState().createRoom('Host')).toBeNull()
    expect(useRoomStore.getState().error).toBe('Only signed-in users can create rooms')
  })

  it('falls back to a generic message for a non-error failure', async () => {
    post.mockRejectedValue('boom')
    await useRoomStore.getState().createRoom('Host')
    expect(useRoomStore.getState().error).toBe('Unexpected error')
  })
})

describe('joinRoom', () => {
  it('asks to sign in when there is no session', async () => {
    useAuthStore.setState({ identity: null, session: null })
    expect(await useRoomStore.getState().joinRoom('ROOM01')).toBeNull()
    expect(useRoomStore.getState().joinError).toBe(SIGN_IN_REQUIRED)
    expect(emitWithAck).not.toHaveBeenCalled()
  })

  it('shows the server rejection', async () => {
    emitWithAck.mockRejectedValue(new DomainError('ROOM_FULL', 'The room is full'))
    expect(await useRoomStore.getState().joinRoom('ROOM01')).toBeNull()
    expect(useRoomStore.getState().joinError).toBe('The room is full')
  })

  it('joins the room again after a reconnection', async () => {
    useRoomStore.setState({ room: room() })
    emitWithAck.mockResolvedValue(room())

    ioHandlers.get('reconnect')?.()

    expect(emitWithAck).toHaveBeenCalledWith('room:join', expect.objectContaining({ roomCode: 'ROOM01' }))
  })

  it('does nothing on reconnection outside a room', () => {
    ioHandlers.get('reconnect')?.()
    expect(emitWithAck).not.toHaveBeenCalled()
  })
})

describe('leaveRoom', () => {
  it('drops the room locally and tells the server', async () => {
    useRoomStore.setState({ room: room() })
    emitWithAck.mockResolvedValue(null)

    await useRoomStore.getState().leaveRoom()

    expect(useRoomStore.getState().room).toBeNull()
    expect(emitWithAck).toHaveBeenCalledWith('room:leave', { roomCode: 'ROOM01', playerId: 'me' })
  })

  it('still leaves locally when the server cannot be reached', async () => {
    useRoomStore.setState({ room: room() })
    emitWithAck.mockRejectedValue(new Error('offline'))
    await expect(useRoomStore.getState().leaveRoom()).resolves.toBeUndefined()
    expect(useRoomStore.getState().room).toBeNull()
  })

  it('sends nothing outside a room', async () => {
    await useRoomStore.getState().leaveRoom()
    expect(emitWithAck).not.toHaveBeenCalled()
  })
})

describe('room actions', () => {
  type Action = [name: string, run: () => Promise<unknown>, event: string, payload: Record<string, unknown>]
  const actions: Action[] = [
    ['selectRole', () => useRoomStore.getState().selectRole('spectator'), 'role:select', { playerId: 'me', role: 'spectator' }],
    ['setReady', () => useRoomStore.getState().setReady(true), 'player:ready', { playerId: 'me', ready: true }],
    ['kickPlayer', () => useRoomStore.getState().kickPlayer('other'), 'player:kick', { requesterId: 'me', playerId: 'other' }],
    ['startBattle', () => useRoomStore.getState().startBattle(), 'battle:start', { requesterId: 'me' }],
    ['startSongChallenge', () => useRoomStore.getState().startSongChallenge(), 'song-challenge:start', { requesterId: 'me' }],
    ['rematch', () => useRoomStore.getState().rematch(), 'room:rematch', { requesterId: 'me' }],
    ['chooseSong', () => useRoomStore.getState().chooseSong('song-1'), 'song:choose', { playerId: 'me', songId: 'song-1' }],
  ]

  it.each(actions)('%s sends its event and applies the updated room', async (_name, run, event, payload) => {
    useRoomStore.setState({ room: room(), error: 'old error' })
    emitWithAck.mockResolvedValue(room('ROOM01', { hostId: 'updated' }))

    await run()

    expect(emitWithAck).toHaveBeenCalledWith(event, { roomCode: 'ROOM01', ...payload })
    expect(useRoomStore.getState().room?.hostId).toBe('updated')
    expect(useRoomStore.getState().error).toBeNull()
  })

  it.each(actions)('%s shows the server rejection', async (_name, run) => {
    useRoomStore.setState({ room: room() })
    emitWithAck.mockRejectedValue(new DomainError('SOMETHING', 'Not allowed right now'))

    await run()

    expect(useRoomStore.getState().error).toBe('Not allowed right now')
  })

  it.each(actions)('%s does nothing outside a room', async (_name, run) => {
    await run()
    expect(emitWithAck).not.toHaveBeenCalled()
  })

  it('explains a known rematch rejection in plain words', async () => {
    useRoomStore.setState({ room: room() })
    emitWithAck.mockRejectedValue(new DomainError('NOT_HOST', 'requester is not the host'))

    await useRoomStore.getState().rematch()

    expect(useRoomStore.getState().error).toBe('Only the host can start a rematch.')
  })
})

describe('submitSongPhrase', () => {
  it('returns the server verdict and applies the room', async () => {
    useRoomStore.setState({ room: room() })
    emitWithAck.mockResolvedValue({ room: room('ROOM01', { hostId: 'updated' }), outcome: 'accepted' })

    expect(await useRoomStore.getState().submitSongPhrase('la la la')).toBe('accepted')
    expect(emitWithAck).toHaveBeenCalledWith('song-challenge:submit', { roomCode: 'ROOM01', playerId: 'me', text: 'la la la' })
    expect(useRoomStore.getState().room?.hostId).toBe('updated')
  })

  it('returns null when the submission fails or there is no room', async () => {
    expect(await useRoomStore.getState().submitSongPhrase('x')).toBeNull()

    useRoomStore.setState({ room: room() })
    emitWithAck.mockRejectedValue(new Error('too late'))
    expect(await useRoomStore.getState().submitSongPhrase('x')).toBeNull()
    expect(useRoomStore.getState().error).toBe('too late')
  })
})

describe('server pushes', () => {
  it('a kick drops the current room and leaves a notice for home', () => {
    useRoomStore.setState({ room: room() })

    serverEmits('room:kicked', { roomCode: 'room01' })

    expect(useRoomStore.getState()).toMatchObject({ room: null, notice: KICKED_NOTICE, kickedFrom: 'ROOM01' })
    useRoomStore.getState().acknowledgeKick()
    useRoomStore.getState().dismissNotice()
    expect(useRoomStore.getState()).toMatchObject({ notice: null, kickedFrom: null })
  })

  it('a kick from another room is ignored', () => {
    useRoomStore.setState({ room: room() })
    serverEmits('room:kicked', { roomCode: 'OTHER1' })
    expect(useRoomStore.getState().room?.code).toBe('ROOM01')
  })

  it('a kick during the join ends the join', async () => {
    let answerJoin: (value: Room) => void = () => {}
    emitWithAck.mockImplementation(() => new Promise<Room>((resolve) => (answerJoin = resolve)))
    const joining = useRoomStore.getState().joinRoom('ROOM02')

    serverEmits('room:kicked', { roomCode: 'ROOM02' })
    expect(useRoomStore.getState().kickedFrom).toBe('ROOM02')
    // Once the kick ended the join, broadcasts of that room are no longer accepted.
    serverEmits('room:updated', room('ROOM02'))
    expect(useRoomStore.getState().room).toBeNull()

    answerJoin(room('ROOM02'))
    await joining
  })

  it('a domain error is shown', () => {
    serverEmits('error:domain', { code: 'X', message: 'Something went wrong' })
    expect(useRoomStore.getState().error).toBe('Something went wrong')
    useRoomStore.getState().setError(null)
    expect(useRoomStore.getState().error).toBeNull()
  })

  it('the player own vote is applied only for the current room', () => {
    const receiveMine = vi.fn()
    const original = useVoteStore.getState().receiveMine
    useVoteStore.setState({ receiveMine })
    useRoomStore.setState({ room: room() })

    serverEmits('vote:mine', { roomCode: 'OTHER1' })
    serverEmits('vote:mine', { roomCode: 'ROOM01' })

    expect(receiveMine).toHaveBeenCalledTimes(1)
    expect(receiveMine).toHaveBeenCalledWith({ roomCode: 'ROOM01' })
    useVoteStore.setState({ receiveMine: original })
  })

  it('setRoom replaces the room as is', () => {
    useRoomStore.getState().setRoom(room('ZZZ999'))
    expect(useRoomStore.getState().room?.code).toBe('ZZZ999')
  })
})
