import { useState } from 'react'
import { Button } from '../../../shared/ui/atoms/Button'
import { Input } from '../../../shared/ui/atoms/Input'
import { DEV_ADMIN_OID, devOidFor, isDevLoginEnabled } from '../lib/devLogin'
import { useAuthStore } from '../store/authStore'

/**
 * Local testing only (vite dev + VITE_DEV_LOGIN_URL): sign in as the admin account or as any test
 * player through the fake Entra ID of the local stack. Renders nothing anywhere else.
 */
export function LocalTestLogin() {
  const signInForLocalTest = useAuthStore((state) => state.signInForLocalTest)
  const [name, setName] = useState('Ana')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isDevLoginEnabled()) return null

  const signIn = async (oid: string, displayName: string) => {
    setBusy(true)
    setError(null)
    try {
      await signInForLocalTest(oid, displayName)
    } catch {
      setError('The local test login did not answer. Is docker-compose.observability.yml running?')
      setBusy(false)
    }
  }

  return (
    <section
      aria-labelledby="local-test-title"
      className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border-2 border-dashed border-sun bg-sun-soft/60 p-5"
    >
      <div>
        <h2 id="local-test-title" className="text-sm font-bold text-sun-strong">
          Local test accounts
        </h2>
        <p className="text-xs text-ink-muted">Only in local development, through the fake Entra ID of the test stack.</p>
      </div>
      <Button onClick={() => void signIn(DEV_ADMIN_OID, 'Admin')} disabled={busy}>
        Sign in as the admin
      </Button>
      <div className="flex items-end gap-2">
        <Input id="dev-player-name" label="Test player" value={name} onChange={(event) => setName(event.target.value)} />
        <Button variant="secondary" onClick={() => void signIn(devOidFor(name), name.trim())} disabled={busy || name.trim().length === 0}>
          Sign in
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs font-medium text-rose-700">
          {error}
        </p>
      )}
    </section>
  )
}
