import { useEffect, type ReactNode } from 'react'
import { Navigate } from 'react-router'
import { useAuthStore } from '../../auth/store/authStore'
import { useAdminAccessStore } from '../store/adminAccessStore'

/**
 * The admin screen is for the single admin account (ADMIN_USER_OID in the gateway). The page only
 * asks the backend; the backend is what refuses every admin request from anyone else (403).
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const kind = useAuthStore((state) => state.session?.kind ?? null)
  const access = useAdminAccessStore((state) => state.access)
  const check = useAdminAccessStore((state) => state.check)

  useEffect(() => {
    if (kind === 'user' && (access === 'unknown' || access === 'error')) void check()
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
