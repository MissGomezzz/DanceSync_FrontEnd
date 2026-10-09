import { env } from '../../../shared/lib/env'

/** HTTP twin of room:leave; the server runs the same leave flow. */
export function leaveUrl(roomCode: string): string {
  return `${env.apiUrl}/api/rooms/${encodeURIComponent(roomCode)}/leave`
}

/**
 * Asks the browser to deliver the leave request even while the page is being
 * closed. The body is a JSON string, sent as text/plain: a CORS-safelisted
 * type, so the beacon needs no preflight. Returns false when it could not be queued.
 */
export function sendLeaveBeacon(roomCode: string, playerId: string): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return false
  return navigator.sendBeacon(leaveUrl(roomCode), JSON.stringify({ playerId }))
}

/**
 * Sends the leave beacon when the page is hidden for good (tab or window
 * closed, navigation to another site), so the seat is freed at once instead of
 * after the server's disconnect grace period. `isStillSeated` is checked when
 * the page hides: after an explicit "Leave room" (room:leave already sent) no
 * beacon goes out. Returns the unbind function.
 */
export function bindLeaveBeacon(roomCode: string, playerId: string, isStillSeated: () => boolean): () => void {
  const onPageHide = () => {
    if (isStillSeated()) sendLeaveBeacon(roomCode, playerId)
  }
  window.addEventListener('pagehide', onPageHide)
  return () => window.removeEventListener('pagehide', onPageHide)
}
