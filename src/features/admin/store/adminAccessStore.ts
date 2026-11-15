import { create } from 'zustand'
import { HttpError } from '../../../shared/api/httpClient'
import { onSessionChange } from '../../../shared/lib/authSession'
import { adminApi } from '../api/adminApi'

/**
 * unknown: not asked yet. checking: asking. admin: the backend confirmed it. denied: it did not
 * (403, another account). error: the backend could not be reached; asking again may work.
 */
export type AdminAccess = 'unknown' | 'checking' | 'admin' | 'denied' | 'error'

interface AdminAccessState {
  access: AdminAccess
  /** Asks the backend whether the signed-in user is the admin. Only the backend decides. */
  check: () => Promise<void>
  reset: () => void
}

let inFlight: Promise<void> | null = null

export const useAdminAccessStore = create<AdminAccessState>((set) => ({
  access: 'unknown',
  check: () => {
    inFlight ??= (async () => {
      set({ access: 'checking' })
      try {
        const { admin } = await adminApi.session()
        set({ access: admin ? 'admin' : 'denied' })
      } catch (error) {
        set({ access: error instanceof HttpError && (error.status === 401 || error.status === 403) ? 'denied' : 'error' })
      } finally {
        inFlight = null
      }
    })()
    return inFlight
  },
  reset: () => set({ access: 'unknown' }),
}))

// Another account (or nobody) is signed in now: whatever was known about the old one is void.
onSessionChange(() => useAdminAccessStore.getState().reset())
