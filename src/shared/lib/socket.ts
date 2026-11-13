import { io, type Socket } from 'socket.io-client'
import { getAccessToken, onSessionChange } from './authSession'
import { useConnectionStore } from './connectionStatus'
import { env } from './env'

/**
 * Singleton Socket.IO client shared by all real-time features.
 * The connection is not opened automatically; call `connectSocket()`
 * once the user is about to join a room.
 */
// Default transports (HTTP long-polling upgraded to WebSocket) are kept on
// purpose: forcing 'websocket' only breaks in environments that instrument
// the WebSocket global, and the gateway supports both transports.
//
// The access token travels in the Socket.IO handshake and is asked for on every
// (re)connection, so a renewed token is used after a network drop. The server
// validates it before accepting the connection and takes the player from it.
export const socket: Socket = io(env.wsUrl, {
  path: '/socket.io',
  autoConnect: false,
  auth: (send) => {
    void getAccessToken().then((token) => send(token ? { token } : {}))
  },
})

/** `connect_error` message of a handshake refused for lack of a valid token. */
export const UNAUTHORIZED = 'UNAUTHORIZED'

const setConnectionStatus = useConnectionStore.getState().setStatus
socket.on('connect', () => setConnectionStatus('connected'))
// socket.io-client keeps retrying after both events, so they mean "reconnecting", not "gave up".
socket.on('disconnect', () => setConnectionStatus('disconnected'))
socket.on('connect_error', () => setConnectionStatus('disconnected'))

// A connection belongs to the identity of its handshake: after a sign-in, a
// sign-out or a new guest token it is closed, and the next use reconnects as
// the new identity.
onSessionChange(() => {
  if (socket.connected || socket.active) socket.disconnect()
})

/** Connects the singleton socket when it is not already connected. */
export function connectSocket(): Socket {
  if (!socket.connected && !socket.active) {
    setConnectionStatus('connecting')
    socket.connect()
  }
  return socket
}

/** How long an emitted event waits for the server's acknowledgement. */
export const ACK_TIMEOUT_MS = 8000

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
 * Rejects with a SocketDomainError when the server acks `{ ok: false }`, or with
 * code TIMEOUT when no acknowledgement arrives within `timeoutMs` (for example
 * while the connection is down: the emit stays buffered but the caller is freed),
 * or at once with code UNAUTHORIZED when the server refuses the connection
 * because the session has no valid token.
 */
export function emitWithAck<T>(event: string, payload: unknown, timeoutMs = ACK_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onConnectError = (error: Error) => {
      if (error.message !== UNAUTHORIZED) return
      socket.off('connect_error', onConnectError)
      reject(new SocketDomainError(UNAUTHORIZED, 'Your session is not valid any more. Sign in or join again.'))
    }
    socket.on('connect_error', onConnectError)
    connectSocket()
      .timeout(timeoutMs)
      .emit(event, payload, (err: Error | null, response: AckResponse<T>) => {
        socket.off('connect_error', onConnectError)
        if (err) {
          reject(new SocketDomainError('TIMEOUT', 'The server did not respond. Check your connection.'))
        } else if (response.ok) {
          resolve(response.data)
        } else {
          reject(new SocketDomainError(response.error.code, response.error.message))
        }
      })
  })
}
