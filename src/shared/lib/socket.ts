import { io, type Socket } from 'socket.io-client'
import { env } from './env'

/**
 * Singleton Socket.IO client shared by all real-time features.
 * The connection is not opened automatically; call `connectSocket()`
 * once the user is about to join a room.
 */
// Default transports (HTTP long-polling upgraded to WebSocket) are kept on
// purpose: forcing 'websocket' only breaks in environments that instrument
// the WebSocket global, and the gateway supports both transports.
export const socket: Socket = io(env.wsUrl, {
  path: '/socket.io',
  autoConnect: false,
})

/** Connects the singleton socket when it is not already connected. */
export function connectSocket(): Socket {
  if (!socket.connected) {
    socket.connect()
  }
  return socket
}

/** Domain error relayed by the server through a Socket.IO acknowledgement. */
export class SocketDomainError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'SocketDomainError'
    this.code = code
  }
}

type AckResponse<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } }

/**
 * Emits an event and resolves with the acknowledged data.
 * Rejects with a SocketDomainError when the server acks `{ ok: false }`.
 */
export function emitWithAck<T>(event: string, payload: unknown): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    connectSocket().emit(event, payload, (response: AckResponse<T>) => {
      if (response.ok) {
        resolve(response.data)
      } else {
        reject(new SocketDomainError(response.error.code, response.error.message))
      }
    })
  })
}
