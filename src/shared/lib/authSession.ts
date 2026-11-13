/**
 * Where the transport layer (HTTP client, Socket.IO client, leave beacon) gets
 * the access token of the current session, without depending on the auth
 * feature. The auth store registers the provider; see features/auth.
 *
 * The token is the only proof of identity sent to the backend: a Microsoft
 * Entra ID access token for a signed-in user, or the guest token issued by the
 * server for one room. Without one, the gateway answers 401 and the Socket.IO
 * handshake is refused with UNAUTHORIZED.
 */
export type AccessTokenProvider = () => Promise<string | null>

let provider: AccessTokenProvider = async () => null
let lastToken: string | null = null
const sessionListeners = new Set<() => void>()

export function setAccessTokenProvider(next: AccessTokenProvider): void {
  provider = next
  lastToken = null
}

/** The current access token (renewed when needed), or null when nobody is signed in. */
export async function getAccessToken(): Promise<string | null> {
  try {
    lastToken = await provider()
  } catch {
    lastToken = null
  }
  return lastToken
}

/**
 * The token last returned by getAccessToken, for the one caller that cannot
 * wait: the leave beacon sent while the page is being closed.
 */
export function peekAccessToken(): string | null {
  return lastToken
}

/** Runs `listener` whenever the session changes (sign-in, sign-out, another guest token). */
export function onSessionChange(listener: () => void): () => void {
  sessionListeners.add(listener)
  return () => sessionListeners.delete(listener)
}

/** Called by the auth store after the identity changed: connections made as the old one must go. */
export function notifySessionChange(): void {
  lastToken = null
  for (const listener of sessionListeners) listener()
}
