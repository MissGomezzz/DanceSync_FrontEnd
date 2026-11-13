import { create } from 'zustand'
import { httpClient } from '../../../shared/api/httpClient'
import { notifySessionChange, setAccessTokenProvider } from '../../../shared/lib/authSession'
import {
  acquireEntraAccessToken,
  isEntraConfigured,
  restoreEntraAccount,
  signInWithEntra,
  signOutOfEntra,
} from '../lib/msalClient'

/**
 * The player as the backend knows them. The id is never chosen here: it is the
 * one inside the access token (the Entra ID object id of a signed-in user, or
 * the id the server generated for a guest), and the server takes it from the
 * token, not from what the client sends.
 */
export interface PlayerIdentity {
  id: string
  displayName: string
}

/**
 * How the player is authenticated:
 * - user: signed in with Microsoft Entra ID; may create rooms and read the match history.
 * - guest: holds a short-lived token issued by the server for one room only.
 */
export type AuthSession = { kind: 'user' } | { kind: 'guest'; roomCode: string; expiresAt: string }

interface GuestGrant {
  token: string
  playerId: string
  displayName: string
  roomCode: string
  expiresAt: string
}

const GUEST_STORAGE_KEY = 'dancesync.guest'
const DISPLAY_NAME_STORAGE_KEY = 'dancesync.displayName'

export function defaultGuestName(): string {
  return `Guest-${Math.floor(1000 + Math.random() * 9000)}`
}

function isExpired(expiresAt: string, now = Date.now()): boolean {
  const expiry = Date.parse(expiresAt)
  return !Number.isFinite(expiry) || expiry <= now
}

function isGuestGrant(value: unknown): value is GuestGrant {
  if (typeof value !== 'object' || value === null) return false
  const grant = value as Record<string, unknown>
  return ['token', 'playerId', 'displayName', 'roomCode', 'expiresAt'].every((key) => typeof grant[key] === 'string')
}

/** The guest token is kept in sessionStorage: it survives a reload, not the tab. */
function loadGuestGrant(): GuestGrant | null {
  try {
    const raw = sessionStorage.getItem(GUEST_STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (isGuestGrant(parsed) && !isExpired(parsed.expiresAt)) return parsed
  } catch {
    // sessionStorage may be unavailable; the guest simply has to join again.
  }
  return null
}

function storeGuestGrant(grant: GuestGrant | null): void {
  try {
    if (grant) sessionStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(grant))
    else sessionStorage.removeItem(GUEST_STORAGE_KEY)
  } catch {
    // Persistence is best-effort; the in-memory session still works.
  }
}

/** Display name a signed-in user chose instead of their account name. */
function loadDisplayName(): string | null {
  try {
    return sessionStorage.getItem(DISPLAY_NAME_STORAGE_KEY)
  } catch {
    return null
  }
}

function storeDisplayName(displayName: string): void {
  try {
    sessionStorage.setItem(DISPLAY_NAME_STORAGE_KEY, displayName)
  } catch {
    // Best-effort, like the guest grant.
  }
}

let guestGrant: GuestGrant | null = loadGuestGrant()

function guestState(grant: GuestGrant): Pick<AuthState, 'identity' | 'session'> {
  return {
    identity: { id: grant.playerId, displayName: grant.displayName },
    session: { kind: 'guest', roomCode: grant.roomCode, expiresAt: grant.expiresAt },
  }
}

interface AuthState {
  identity: PlayerIdentity | null
  session: AuthSession | null
  /** False when the Entra ID application is not configured: only guests can get in. */
  canSignIn: boolean
  /**
   * Restores the session before the app renders: completes a Microsoft sign-in
   * that redirected back here, or picks up the guest token of this tab.
   */
  initialize: () => Promise<void>
  /** Sends the browser to the Microsoft sign-in page. */
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  /**
   * Asks the server for a guest token for `roomCode`. Rejects when the room
   * does not exist; the token allows joining that room and nothing else.
   */
  joinAsGuest: (roomCode: string, displayName: string) => Promise<PlayerIdentity>
  /** Updates the display name; the player id is the token's and cannot change. */
  setDisplayName: (displayName: string) => PlayerIdentity | null
  /** True when the current session may enter `roomCode`: any room for a user, their own for a guest. */
  canEnterRoom: (roomCode: string) => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ...(guestGrant ? guestState(guestGrant) : { identity: null, session: null }),
  canSignIn: isEntraConfigured(),
  initialize: async () => {
    try {
      const account = await restoreEntraAccount()
      if (!account) return
      // A signed-in user replaces whatever guest token this tab had.
      guestGrant = null
      storeGuestGrant(null)
      set({ identity: { id: account.id, displayName: loadDisplayName() || account.name }, session: { kind: 'user' } })
      notifySessionChange()
    } catch (error) {
      console.error('Could not restore the Microsoft session', error)
    }
  },
  signIn: () => signInWithEntra(),
  signOut: async () => {
    const wasUser = get().session?.kind === 'user'
    guestGrant = null
    storeGuestGrant(null)
    set({ identity: null, session: null })
    notifySessionChange()
    // Also ends the Microsoft session, so the next visitor of this browser is not signed in.
    if (wasUser && isEntraConfigured()) await signOutOfEntra()
  },
  joinAsGuest: async (roomCode, displayName) => {
    const code = roomCode.trim().toUpperCase()
    const grant = await httpClient.post<GuestGrant>(
      `/api/rooms/${encodeURIComponent(code)}/guest-token`,
      { displayName: displayName.trim() },
      { anonymous: true },
    )
    guestGrant = grant
    storeGuestGrant(grant)
    const state = guestState(grant)
    set(state)
    notifySessionChange()
    return state.identity as PlayerIdentity
  },
  setDisplayName: (displayName) => {
    const { identity, session } = get()
    const trimmed = displayName.trim()
    if (!identity || trimmed.length === 0) return identity
    const updated: PlayerIdentity = { ...identity, displayName: trimmed }
    if (session?.kind === 'user') storeDisplayName(trimmed)
    set({ identity: updated })
    return updated
  },
  canEnterRoom: (roomCode) => {
    const { identity, session } = get()
    if (!identity || !session) return false
    if (session.kind === 'user') return true
    return !isExpired(session.expiresAt) && session.roomCode.toUpperCase() === roomCode.trim().toUpperCase()
  },
}))

// The transport layer asks here for the token to send; see shared/lib/authSession.
setAccessTokenProvider(async () => {
  const { session } = useAuthStore.getState()
  if (session?.kind === 'user') return acquireEntraAccessToken()
  if (session?.kind === 'guest' && guestGrant) {
    if (!isExpired(guestGrant.expiresAt)) return guestGrant.token
    // The guest token ran out: the guest has to join again with the room code.
    guestGrant = null
    storeGuestGrant(null)
    useAuthStore.setState({ identity: null, session: null })
  }
  return null
})
