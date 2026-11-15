import { io, type Socket } from 'socket.io-client'
import { getAccessToken, onSessionChange } from './authSession'
import { remainingBlockMs, useConnectionStore } from './connectionStatus'
import { env } from './env'

/**
 * Singleton Socket.IO client shared by all real-time features.
 * The connection is not opened automatically; call `connectSocket()`
 * once the user is about to join a room.
 */
// Transports (REN-1, ADR-02): WebSocket first, HTTP long-polling only as a
// fallback. The battle-service runs as several replicas behind a load balancer
// without session affinity; a WebSocket lives on one replica from start to end,
// while the requests of a long-polling session must all reach the replica that
// created it. With the default order every connection began with a few polling
// requests; now a normal connection makes none. `tryAllTransports` keeps the
// reason the default was chosen before: where WebSocket is unavailable (for
// example, an environment that instruments the WebSocket global), the client
// falls back to long-polling instead of failing ('websocket' alone never
// connects there). With several replicas that fallback needs session affinity.
//
// The access token travels in the Socket.IO handshake and is asked for on every
// (re)connection, so a renewed token is used after a network drop. The server
// validates it before accepting the connection and takes the player from it.
export const socket: Socket = io(env.wsUrl, {
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  tryAllTransports: true,
  autoConnect: false,
  auth: (send) => {
    void getAccessToken().then((token) => send(token ? { token } : {}))
  },
})

/** `connect_error` message of a handshake refused for lack of a valid token. */
export const UNAUTHORIZED = 'UNAUTHORIZED'
/** SEG-3: `connect_error` message (and error code) while the server refuses this client for flooding. */
export const BLOCKED = 'BLOCKED'
/** How long the "slow down" notice stays after the server drops some events (SEG-3). */
export const SLOW_DOWN_NOTICE_MS = 4000
/** Used when the server does not say how long a block lasts. */
const DEFAULT_BLOCK_MS = 30_000

/** What the user reads while blocked, with the seconds left. */
export function blockedMessage(remainingMs: number): string {
  return `You sent too many actions too fast. Try again in ${Math.max(1, Math.ceil(remainingMs / 1000))} s.`
}

const connection = useConnectionStore.getState()
const setConnectionStatus = connection.setStatus
socket.on('connect', () => setConnectionStatus('connected'))
// socket.io-client keeps retrying after both events, so they mean "reconnecting", not "gave up".
socket.on('disconnect', () => {
  // A block closes the connection right after telling why: keep showing the block.
  if (useConnectionStore.getState().status !== 'blocked') setConnectionStatus('disconnected')
})
socket.on('connect_error', (error: Error & { data?: { retryAfterMs?: number } }) => {
  if (error?.message === BLOCKED) connection.setBlocked(error.data?.retryAfterMs ?? DEFAULT_BLOCK_MS)
  else setConnectionStatus('disconnected')
})

// SEG-3, early feedback: the server dropped some events, or blocked this client and closed the connection.
socket.on('rate:limited', () => connection.setSlowDown(SLOW_DOWN_NOTICE_MS))
socket.on('rate:blocked', (notice?: { retryAfterMs?: number }) => {
  const retryAfterMs = notice?.retryAfterMs ?? DEFAULT_BLOCK_MS
  connection.setBlocked(retryAfterMs)
  // A connection closed by the server is never retried by socket.io-client: come back when the block ends.
  setTimeout(() => connectSocket(), retryAfterMs + 500)
})

// A connection belongs to the identity of its handshake: after a sign-in, a
// sign-out or a new guest token it is closed, and the next use reconnects as
// the new identity.
onSessionChange(() => {
  if (socket.connected || socket.active) socket.disconnect()
})

/** Connects the singleton socket when it is not already connected. */
export function connectSocket(): Socket {
  if (!socket.connected && !socket.active) {
    if (useConnectionStore.getState().status !== 'blocked') setConnectionStatus('connecting')
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
 * because the session has no valid token, or with code BLOCKED while the server
 * refuses this client for sending too many events (SEG-3): then nothing is sent.
 */
export function emitWithAck<T>(event: string, payload: unknown, timeoutMs = ACK_TIMEOUT_MS): Promise<T> {
  const blockedForMs = remainingBlockMs()
  if (blockedForMs > 0) return Promise.reject(new SocketDomainError(BLOCKED, blockedMessage(blockedForMs)))
  return new Promise<T>((resolve, reject) => {
    const onConnectError = (error: Error & { data?: { retryAfterMs?: number } }) => {
      if (error.message === BLOCKED) {
        socket.off('connect_error', onConnectError)
        reject(new SocketDomainError(BLOCKED, blockedMessage(error.data?.retryAfterMs ?? DEFAULT_BLOCK_MS)))
        return
      }
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
