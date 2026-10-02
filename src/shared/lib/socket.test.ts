import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useConnectionStore } from './connectionStatus'

type AckCallback = (err: Error | null, response?: unknown) => void

const { fakeSocket, handlers } = vi.hoisted(() => {
  const handlers = new Map<string, () => void>()
  const fakeSocket = {
    connected: true,
    active: true,
    connect: vi.fn(),
    on: vi.fn((event: string, handler: () => void) => handlers.set(event, handler)),
    timeout: vi.fn(),
    emit: vi.fn(),
  }
  fakeSocket.timeout.mockImplementation(() => fakeSocket)
  return { fakeSocket, handlers }
})

vi.mock('socket.io-client', () => ({ io: () => fakeSocket }))

const { ACK_TIMEOUT_MS, emitWithAck, SocketDomainError } = await import('./socket')

/** Answers the last emitted event the way socket.io-client calls a timed ack. */
function answerLastEmit(err: Error | null, response?: unknown): void {
  const callback = fakeSocket.emit.mock.calls.at(-1)?.[2] as AckCallback
  callback(err, response)
}

beforeEach(() => {
  fakeSocket.emit.mockReset()
  fakeSocket.timeout.mockClear()
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
    handlers.get('connect')?.()
    expect(useConnectionStore.getState().status).toBe('connected')
    handlers.get('disconnect')?.()
    expect(useConnectionStore.getState().status).toBe('disconnected')
    handlers.get('connect')?.()
    handlers.get('connect_error')?.()
    expect(useConnectionStore.getState().status).toBe('disconnected')
  })
})
