import { create } from 'zustand'

/**
 * Guest identity used until Azure Entra ID (MSAL) integration lands.
 * Persisted in sessionStorage so each browser tab acts as a distinct player.
 */
export interface GuestIdentity {
  id: string
  displayName: string
}

const STORAGE_KEY = 'dancesync.guest'

export function defaultGuestName(): string {
  return `Guest-${Math.floor(1000 + Math.random() * 9000)}`
}

function loadIdentity(): GuestIdentity | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<GuestIdentity>
    if (typeof parsed.id === 'string' && typeof parsed.displayName === 'string') {
      return { id: parsed.id, displayName: parsed.displayName }
    }
  } catch {
    // sessionStorage may be unavailable; fall back to an in-memory identity.
  }
  return null
}

function persistIdentity(identity: GuestIdentity): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(identity))
  } catch {
    // Persistence is best-effort; the in-memory identity still works.
  }
}

interface AuthState {
  identity: GuestIdentity | null
  /** Returns the current identity, creating and persisting one when missing. */
  ensureIdentity: () => GuestIdentity
  /** Updates the display name (keeping the player id) and returns the identity. */
  setDisplayName: (displayName: string) => GuestIdentity
  login: (username: string) => GuestIdentity
}

export const useAuthStore = create<AuthState>((set, get) => ({
  identity: loadIdentity(),
  ensureIdentity: () => {
    const existing = get().identity
    if (existing) return existing
    const identity: GuestIdentity = { id: crypto.randomUUID(), displayName: defaultGuestName() }
    persistIdentity(identity)
    set({ identity })
    return identity
  },
  setDisplayName: (displayName) => {
    const base = get().identity ?? { id: crypto.randomUUID(), displayName: defaultGuestName() }
    const trimmed = displayName.trim()
    const identity: GuestIdentity = { ...base, displayName: trimmed.length > 0 ? trimmed : base.displayName }
    persistIdentity(identity)
    set({ identity })
    return identity
  },
    login: (username) => {
    // Mocked for the MVP: no real backend check yet, password is intentionally ignored here.
    const trimmed = username.trim()
    const identity: GuestIdentity = {
      id: crypto.randomUUID(),
      displayName: trimmed.length > 0 ? trimmed : defaultGuestName(),
    }
    persistIdentity(identity)
    set({ identity })
    return identity
  },
}))
