/**
 * Local testing only: signs in through the fake Entra ID of docker-compose.observability.yml
 * (POST /dev/token), which issues tokens the local backend validates exactly like Microsoft's.
 *
 * Enabled only under `vite dev` with VITE_DEV_LOGIN_URL set. `import.meta.env.DEV` is false in a
 * production build, so this never reaches a deployed site (and the real backend would refuse
 * these tokens anyway: they are not signed by the tenant).
 */
export interface DevGrant {
  token: string
  oid: string
  name: string
  expiresAt: string
}

const STORAGE_KEY = 'dancesync.devGrant'

export const DEV_ADMIN_OID = import.meta.env.VITE_DEV_ADMIN_OID ?? '00000000-0000-4000-8000-00000000ad01'

function devLoginUrl(): string {
  return import.meta.env.DEV ? (import.meta.env.VITE_DEV_LOGIN_URL ?? '').replace(/\/+$/, '') : ''
}

export function isDevLoginEnabled(): boolean {
  return devLoginUrl().length > 0
}

/** A stable test user id for a display name: the same name signs in as the same user. */
export function devOidFor(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `dev-${slug || 'player'}`.slice(0, 64)
}

export async function requestDevGrant(oid: string, name: string): Promise<DevGrant> {
  const response = await fetch(`${devLoginUrl()}/dev/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oid, name }),
  })
  if (!response.ok) throw new Error(`The local test login answered ${response.status}`)
  return (await response.json()) as DevGrant
}

export function loadDevGrant(): DevGrant | null {
  if (!isDevLoginEnabled()) return null
  try {
    const grant = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null') as DevGrant | null
    return grant && Date.parse(grant.expiresAt) > Date.now() ? grant : null
  } catch {
    return null
  }
}

export function storeDevGrant(grant: DevGrant | null): void {
  try {
    if (grant) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(grant))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Best-effort, like the guest grant.
  }
}
