import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useConnectionStore } from './connectionStatus'

type AckCallback = (err: Error | null, response?: unknown) => void

type Handler = (...args: unknown[]) => void
type HandshakeAuth = (send: (auth: Record<string, unknown>) => void) => void

const { fakeSocket, handlers, ioOptions } = vi.hoisted(() => {
  const handlers = new Map<string, Set<Handler>>()
  const ioOptions: { auth?: HandshakeAuth; transports?: string[]; tryAllTransports?: boolean } = {}
  const fakeSocket = {
    connected: true,
    active: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn((event: string, handler: Handler) => {
      if (!handlers.has(event)) handlers.set(event, new Set())
      handlers.get(event)?.add(handler)
    }),
    off: vi.fn((event: string, handler: Handler) => void handlers.get(event)?.delete(handler)),
    timeout: vi.fn(),
    emit: vi.fn(),
  }
  fakeSocket.timeout.mockImplementation(() => fakeSocket)
  return { fakeSocket, handlers, ioOptions }
})

vi.mock('socket.io-client', () => ({
  io: (_url: string, options: { auth?: HandshakeAuth; transports?: string[]; tryAllTransports?: boolean }) => {
    ioOptions.auth = options.auth
    ioOptions.transports = options.transports
    ioOptions.tryAllTransports = options.tryAllTransports
    return fakeSocket
  },
}))

const { ACK_TIMEOUT_MS, BLOCKED, emitWithAck, SLOW_DOWN_NOTICE_MS, SocketDomainError } = await import('./socket')
const { notifySessionChange, setAccessTokenProvider } = await import('./authSession')

/** Fires a socket event the way socket.io-client would. */
function fire(event: string, ...args: unknown[]): void {
  for (const handler of handlers.get(event) ?? []) handler(...args)
}

/** The auth payload the client would send in the next handshake. */
function handshakeAuth(): Promise<Record<string, unknown>> {
  return new Promise((resolve) => ioOptions.auth?.(resolve))
}

/** Answers the last emitted event the way socket.io-client calls a timed ack. */
function answerLastEmit(err: Error | null, response?: unknown): void {
  const callback = fakeSocket.emit.mock.calls.at(-1)?.[2] as AckCallback
  callback(err, response)
}

beforeEach(() => {
  fakeSocket.emit.mockReset()
  fakeSocket.timeout.mockClear()
  fakeSocket.disconnect.mockClear()
  fakeSocket.connected = true
  fakeSocket.active = true
  setAccessTokenProvider(async () => null)
})

describe('emitWithAck', () => {
  it('bounds every emit with the ack timeout', async () => {
    const pending = emitWithAck('room:join', { roomCode: 'ROOM01' })
    expect(fakeSocket.timeout).toHaveBeenCalledWith(ACK_TIMEOUT_MS)
    answerLastEmit(null, { ok: true, data: 'joined' })
    await expect(pending).resolves.toBe('joined')
  })

  it('rejects with a TIMEOUT domain error when the server never answers', async () => {
    const pending = emitWithAck('room:join', { roomCode: 'ROOM01' })
    answerLastEmit(new Error('operation has timed out'))
    const error = await pending.catch((e: unknown) => e)
    expect(error).toBeInstanceOf(SocketDomainError)
    expect(error).toMatchObject({ code: 'TIMEOUT', message: 'The server did not respond. Check your connection.' })
  })

  it('rejects with the server domain error on a negative ack', async () => {
    const pending = emitWithAck('room:join', { roomCode: 'NOPE' })
    answerLastEmit(null, { ok: false, error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' } })
    await expect(pending).rejects.toMatchObject({ code: 'ROOM_NOT_FOUND', message: 'Room not found' })
  })
})

describe('transports (REN-1, ADR-02)', () => {
  it('connects over WebSocket first and keeps long-polling only as a fallback', () => {
    // WebSocket first: a normal connection makes no long-polling request, so the
    // replicas behind the load balancer need no session affinity.
    expect(ioOptions.transports).toEqual(['websocket', 'polling'])
    // Without this, a failed WebSocket would not fall back to long-polling.
    expect(ioOptions.tryAllTransports).toBe(true)
  })
})

describe('connection status', () => {
  it('follows the socket connect, disconnect and connect_error events', () => {
    fire('connect')
    expect(useConnectionStore.getState().status).toBe('connected')
    fire('disconnect')
    expect(useConnectionStore.getState().status).toBe('disconnected')
    fire('connect')
    fire('connect_error', new Error('xhr poll error'))
    expect(useConnectionStore.getState().status).toBe('disconnected')
  })
})

describe('handshake authentication (SEG-1)', () => {
  it('sends the session access token in the handshake, asking for it on every connection', async () => {
    const provider = vi.fn().mockResolvedValueOnce('token-1').mockResolvedValueOnce('token-2')
    setAccessTokenProvider(provider)

    expect(await handshakeAuth()).toEqual({ token: 'token-1' })
    // A reconnection asks again, so a renewed token is used.
    expect(await handshakeAuth()).toEqual({ token: 'token-2' })
    expect(provider).toHaveBeenCalledTimes(2)
  })

  it('sends no token when nobody is signed in (the server then refuses the connection)', async () => {
    expect(await handshakeAuth()).toEqual({})
  })

  it('rejects a pending emit at once with UNAUTHORIZED when the server refuses the handshake', async () => {
    const pending = emitWithAck('room:join', { roomCode: 'ROOM01' })
    fire('connect_error', new Error('UNAUTHORIZED'))

    const error = await pending.catch((e: unknown) => e)
    expect(error).toBeInstanceOf(SocketDomainError)
    expect(error).toMatchObject({ code: 'UNAUTHORIZED' })
    expect(handlers.get('connect_error')?.size).toBe(1) // only the status listener is left
  })

  it('keeps waiting through connection errors that are not about the token', async () => {
    const pending = emitWithAck('room:join', { roomCode: 'ROOM01' })
    fire('connect_error', new Error('xhr poll error'))
    answerLastEmit(null, { ok: true, data: 'joined' })
    await expect(pending).resolves.toBe('joined')
    expect(handlers.get('connect_error')?.size).toBe(1)
  })

  it('drops the connection when the session changes, so the next one authenticates as the new identity', () => {
    notifySessionChange()
    expect(fakeSocket.disconnect).toHaveBeenCalledTimes(1)

    fakeSocket.connected = false
    fakeSocket.active = false
    notifySessionChange()
    expect(fakeSocket.disconnect).toHaveBeenCalledTimes(1)
  })
})

describe('abuse protection feedback (SEG-3)', () => {
  beforeEach(() => {
    useConnectionStore.setState({ status: 'connected', blockedUntil: null, slowDownUntil: null })
    fakeSocket.connect.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a "slow down" notice when the server drops some events, and hides it after a while', () => {
    vi.useFakeTimers()
    fire('rate:limited', { code: 'RATE_LIMITED', dropped: 12, retryAfterMs: 50 })
    expect(useConnectionStore.getState().status).toBe('connected')
    expect(useConnectionStore.getState().slowDownUntil).not.toBeNull()
    vi.advanceTimersByTime(SLOW_DOWN_NOTICE_MS)
    expect(useConnectionStore.getState().slowDownUntil).toBeNull()
  })

  it('keeps the block through the disconnect that follows it and comes back on its own when it ends', () => {
    vi.useFakeTimers()
    fire('rate:blocked', { code: 'BLOCKED', retryAfterMs: 30_000 })
    fire('disconnect', 'io server disconnect')
    expect(useConnectionStore.getState().status).toBe('blocked')
    expect(useConnectionStore.getState().blockedUntil).not.toBeNull()

    // socket.io-client never retries a connection the server closed: the client reconnects itself.
    fakeSocket.connected = false
    fakeSocket.active = false
    vi.advanceTimersByTime(29_000)
    expect(fakeSocket.connect).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1_500)
    expect(fakeSocket.connect).toHaveBeenCalledTimes(1)
    expect(useConnectionStore.getState().status).toBe('blocked') // until the server accepts it again

    fire('connect')
    expect(useConnectionStore.getState()).toMatchObject({ status: 'connected', blockedUntil: null })
  })

  it('refuses an action at once while blocked, without sending anything', async () => {
    fire('rate:blocked', { code: 'BLOCKED', retryAfterMs: 30_000 })
    const error = await emitWithAck('chat:message', { content: 'hi' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(SocketDomainError)
    expect(error).toMatchObject({ code: BLOCKED })
    expect((error as Error).message).toMatch(/Try again in (29|30) s/)
    expect(fakeSocket.emit).not.toHaveBeenCalled()
  })

  it('treats a handshake refused with BLOCKED as a block, and rejects the pending emit at once', async () => {
    const pending = emitWithAck('room:join', { roomCode: 'ROOM01' })
    const refusal = Object.assign(new Error('BLOCKED'), { data: { code: 'BLOCKED', retryAfterMs: 12_000 } })
    fire('connect_error', refusal)

    expect(useConnectionStore.getState().status).toBe('blocked')
    const error = await pending.catch((e: unknown) => e)
    expect(error).toMatchObject({ code: BLOCKED, message: 'You sent too many actions too fast. Try again in 12 s.' })
    expect(handlers.get('connect_error')?.size).toBe(1) // only the status listener is left
  })
})
