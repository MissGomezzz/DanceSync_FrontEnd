import type { Socket } from 'socket.io-client'

/**
 * Minimum time between two signaling events. battle-service drops the events of
 * a socket above 20 per second (burst of 40) and blocks a client that keeps
 * going over; at most ~16 per second leaves room for the rest of the app.
 */
export const SIGNAL_GAP_MS = 60
/** How long an event waits for its acknowledgement before the queue moves on. */
export const SIGNAL_ACK_TIMEOUT_MS = 5000
/** Shortest wait before sending a rate-limited event again; it grows with every refusal. */
export const RATE_LIMIT_MIN_DELAY_MS = 250
/** Longest `retryAfterMs` taken from the server. */
export const RATE_LIMIT_MAX_HINT_MS = 5000
/** Times a rate-limited event is sent again before it is given up. */
export const MAX_RATE_LIMIT_RETRIES = 5
/** Wait and attempts for an event refused for another reason, when the sender asked to retry those. */
export const REJECTED_RETRY_DELAY_MS = 1000
export const MAX_REJECTED_RETRIES = 5

/** Code of the acknowledgement of an event dropped by the server's rate limit. */
const RATE_LIMITED = 'RATE_LIMITED'

/** The server's acknowledgement: `{ ok: true, data }` or `{ ok: false, error: { code, message } }`. */
interface AckResponse {
  ok?: boolean
  error?: { code?: string }
}

interface QueuedEvent {
  event: string
  payload: unknown
  retryRejected: boolean
  rateLimitRetries: number
  rejections: number
}

export interface SendOptions {
  /**
   * Also send the event again when the server refuses it for a reason other
   * than the rate limit (for example while the socket is still rejoining the room).
   */
  retryRejected?: boolean
}

export interface SignalingQueue {
  /** Queues an event; events are delivered one at a time, in order. */
  send: (event: string, payload: unknown, options?: SendOptions) => void
  /** Sends what was held while the socket was down. */
  resume: () => void
  dispose: () => void
}

/**
 * Paces the WebRTC signaling of one peer session and makes it survive the
 * server's rate limit.
 *
 * Events leave one at a time: the next one waits for the acknowledgement of the
 * previous one plus a short gap, so a dancer that opens many connections at
 * once never bursts. An event the rate limit dropped is acknowledged at once
 * with `RATE_LIMITED`; it stays at the head of the queue and is sent again
 * after the `retryAfterMs` of the `rate:limited` notice (the acknowledgement
 * itself carries no delay), with a floor that grows on every refusal, because a
 * dropped retry counts towards the server's temporary block too.
 */
export function createSignalingQueue(socket: Socket): SignalingQueue {
  const pending: QueuedEvent[] = []
  let inFlight: QueuedEvent | null = null
  let ackTimer: ReturnType<typeof setTimeout> | undefined
  let waitTimer: ReturnType<typeof setTimeout> | undefined
  /** The head of the queue while it waits out the rate limit. */
  let rateLimited: QueuedEvent | null = null
  let retryAfterMs = 0
  let disposed = false

  const waitThenPump = (ms: number) => {
    clearTimeout(waitTimer)
    waitTimer = setTimeout(() => {
      waitTimer = undefined
      rateLimited = null
      pump()
    }, ms)
  }

  const rateLimitDelay = (queued: QueuedEvent) =>
    Math.max(retryAfterMs, RATE_LIMIT_MIN_DELAY_MS) * queued.rateLimitRetries

  /** Whether the refused event stays at the head of the queue; arms the wait when it does. */
  const retryLater = (queued: QueuedEvent, code: string | undefined): boolean => {
    if (code === RATE_LIMITED) {
      if (queued.rateLimitRetries >= MAX_RATE_LIMIT_RETRIES) {
        console.warn(`WebRTC signaling dropped: ${queued.event} kept being rate limited`)
        return false
      }
      queued.rateLimitRetries += 1
      rateLimited = queued
      waitThenPump(rateLimitDelay(queued))
      return true
    }
    if (!queued.retryRejected || queued.rejections >= MAX_REJECTED_RETRIES) return false
    queued.rejections += 1
    waitThenPump(REJECTED_RETRY_DELAY_MS)
    return true
  }

  /** `response` is undefined when no acknowledgement arrived in time. */
  const settle = (queued: QueuedEvent, response?: AckResponse) => {
    if (inFlight !== queued) return
    inFlight = null
    clearTimeout(ackTimer)
    if (response?.ok === false && retryLater(queued, response.error?.code)) return
    // Delivered, refused for good, or unanswered: an unanswered event may have
    // been relayed, so it is not sent twice.
    pending.shift()
    waitThenPump(SIGNAL_GAP_MS)
  }

  function pump() {
    if (disposed || inFlight || waitTimer !== undefined || !socket.connected) return
    const queued = pending[0]
    if (!queued) return
    inFlight = queued
    ackTimer = setTimeout(() => settle(queued), SIGNAL_ACK_TIMEOUT_MS)
    socket.emit(queued.event, queued.payload, (response?: AckResponse) => settle(queued, response))
  }

  const onRateLimited = (notice?: { retryAfterMs?: unknown }) => {
    const hint = notice?.retryAfterMs
    if (typeof hint !== 'number' || !Number.isFinite(hint) || hint < 0) return
    retryAfterMs = Math.min(hint, RATE_LIMIT_MAX_HINT_MS)
    if (rateLimited) waitThenPump(rateLimitDelay(rateLimited))
  }
  socket.on('rate:limited', onRateLimited)

  return {
    send: (event, payload, options) => {
      pending.push({ event, payload, retryRejected: options?.retryRejected ?? false, rateLimitRetries: 0, rejections: 0 })
      pump()
    },
    resume: pump,
    dispose: () => {
      disposed = true
      socket.off('rate:limited', onRateLimited)
      clearTimeout(ackTimer)
      clearTimeout(waitTimer)
      pending.length = 0
      inFlight = null
    },
  }
}
