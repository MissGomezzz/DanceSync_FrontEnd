/** Public STUN server: always offered, and the only ICE server when no TURN relay is configured. */
export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }]

/** TURN relay settings, as read from the environment (see `shared/lib/env`). */
export interface TurnConfig {
  /** Comma separated `turn:` / `turns:` URLs. */
  turnUrls: string
  turnUsername: string
  turnCredential: string
}

/** `turn:host[:port][?transport=udp|tcp]` or `turns:`; the host is a name, an IPv4 or a bracketed IPv6. */
const TURN_URL = /^turns?:(?:\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::\d{1,5})?(?:\?transport=(?:udp|tcp))?$/i

/**
 * ICE servers for every peer connection: the default STUN server plus the
 * configured TURN relay, which peers behind symmetric NATs need to connect.
 *
 * A wrong value must never break the camera: malformed URLs are skipped, and a
 * relay without both credentials is ignored (the browser would refuse to create
 * the connection), leaving STUN only. Credentials are never logged.
 */
export function buildIceServers({ turnUrls, turnUsername, turnCredential }: TurnConfig): RTCIceServer[] {
  const configured = turnUrls
    .split(',')
    .map((url) => url.trim())
    .filter((url) => url.length > 0)
  if (configured.length === 0) return DEFAULT_ICE_SERVERS

  const urls = configured.filter((url) => TURN_URL.test(url))
  if (urls.length < configured.length) {
    console.warn('Ignoring malformed TURN URLs: expected turn:host[:port] or turns:host[:port]')
  }
  if (urls.length === 0) return DEFAULT_ICE_SERVERS
  if (!turnUsername || !turnCredential) {
    console.warn('Ignoring the TURN servers: both a username and a credential are required')
    return DEFAULT_ICE_SERVERS
  }
  return [...DEFAULT_ICE_SERVERS, { urls, username: turnUsername, credential: turnCredential }]
}
