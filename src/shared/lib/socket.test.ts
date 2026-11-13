import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useConnectionStore } from './connectionStatus'

type AckCallback = (err: Error | null, response?: unknown) => void

type Handler = (...args: unknown[]) => void
type HandshakeAuth = (send: (auth: Record<string, unknown>) => void) => void

const { fakeSocket, handlers, ioOptions } = vi.hoisted(() => {
  const handlers = new Map<string, Set<Handler>>()
  const ioOptions: { auth?: HandshakeAuth } = {}
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
  io: (_url: string, options: { auth?: HandshakeAuth }) => {
    ioOptions.auth = options.auth
    return fakeSocket
  },
}))

const { ACK_TIMEOUT_MS, emitWithAck, SocketDomainError } = await import('./socket')
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
