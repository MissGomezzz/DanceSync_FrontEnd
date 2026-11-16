import { useEffect, useRef, type ReactNode } from 'react'
import { Navigate } from 'react-router'
import { useAuthStore } from '../../auth/store/authStore'
import { useAdminAccessStore } from '../store/adminAccessStore'

/** While the backend cannot be reached, retry after 2 s, doubling up to 30 s. */
const RETRY_BASE_MS = 2_000
const RETRY_MAX_MS = 30_000

/**
 * The admin screen is for the single admin account (ADMIN_USER_OID in the gateway). The page only
 * asks the backend; the backend is what refuses every admin request from anyone else (403).
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const kind = useAuthStore((state) => state.session?.kind ?? null)
  const access = useAdminAccessStore((state) => state.access)
  const check = useAdminAccessStore((state) => state.check)

  /** Failed checks in a row; sets the delay before the next retry. */
  const failures = useRef(0)

  useEffect(() => {
    if (kind !== 'user') return
    if (access === 'unknown') {
      void check()
    } else if (access === 'error') {
      // Never re-check at once: with the gateway down that would loop, and every request is audited.
      const delay = Math.min(RETRY_BASE_MS * 2 ** failures.current, RETRY_MAX_MS)
      failures.current += 1
      const timer = setTimeout(() => void check(), delay)
      return () => clearTimeout(timer)
    } else if (access !== 'checking') {
      failures.current = 0
    }
  }, [kind, access, check])

  if (kind !== 'user') return <Navigate to="/" replace />
  if (access === 'denied') return <Navigate to="/home" replace />
  if (access !== 'admin') {
    return (
      <main className="flex flex-1 items-center justify-center p-6" aria-busy="true">
        <p role="status" className="text-sm text-ink-muted">
          {access === 'error' ? 'Could not reach the server. Retrying…' : 'Checking admin access…'}
        </p>
      </main>
    )
  }
  return <>{children}</>
}
