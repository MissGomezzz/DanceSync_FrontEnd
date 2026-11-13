import type { AccountInfo, IPublicClientApplication } from '@azure/msal-browser'
import { env } from '../../../shared/lib/env'

/** True when the Entra ID application is configured (VITE_AZURE_CLIENT_ID and VITE_AZURE_TENANT_ID). */
export function isEntraConfigured(): boolean {
  return env.azureClientId.length > 0 && env.azureTenantId.length > 0
}

/** Scope of the DanceSync API; the access token requested with it is the one the backend validates. */
export function apiScopes(): string[] {
  return [env.azureApiScope || `api://${env.azureClientId}/access_as_user`]
}

let clientPromise: Promise<IPublicClientApplication> | null = null

/**
 * The MSAL client, created on first use. The library is loaded on demand, so
 * a guest who never signs in does not download it.
 */
function client(): Promise<IPublicClientApplication> {
  clientPromise ??= import('@azure/msal-browser').then(({ createStandardPublicClientApplication }) =>
    createStandardPublicClientApplication({
      auth: {
        clientId: env.azureClientId,
        // Single tenant: only accounts of the organization can sign in.
        authority: `https://login.microsoftonline.com/${env.azureTenantId}`,
        redirectUri: window.location.origin,
        postLogoutRedirectUri: window.location.origin,
      },
      // Tokens live only as long as the tab: nothing is left behind in localStorage.
      cache: { cacheLocation: 'sessionStorage' },
    }),
  )
  return clientPromise
}

export interface EntraAccount {
  /** The account's object id in the tenant: the `oid` claim, which the backend uses as the player id. */
  id: string
  name: string
}

function toEntraAccount(account: AccountInfo): EntraAccount {
  const oid = account.idTokenClaims?.oid
  return {
    id: typeof oid === 'string' && oid.length > 0 ? oid : account.localAccountId,
    name: account.name ?? account.username,
  }
}

/**
 * Completes a sign-in that redirected back to the app (if any) and returns the
 * signed-in account, or null. Call once, before rendering.
 */
export async function restoreEntraAccount(): Promise<EntraAccount | null> {
  if (!isEntraConfigured()) return null
  const msal = await client()
  const result = await msal.handleRedirectPromise()
  const account = result?.account ?? msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null
  if (!account) return null
  msal.setActiveAccount(account)
  return toEntraAccount(account)
}

/** Sends the browser to the Microsoft sign-in page; the app is reloaded when it comes back. */
export async function signInWithEntra(): Promise<void> {
  const msal = await client()
  await msal.loginRedirect({ scopes: apiScopes() })
}

export async function signOutOfEntra(): Promise<void> {
  const msal = await client()
  await msal.logoutRedirect({ account: msal.getActiveAccount() })
}

/**
 * An access token for the DanceSync API, from the cache or renewed silently.
 * When the session can no longer be renewed without the user (expired sign-in,
 * consent needed) the browser is sent to sign in again and null is returned.
 */
export async function acquireEntraAccessToken(): Promise<string | null> {
  const msal = await client()
  const account = msal.getActiveAccount()
  if (!account) return null
  try {
    const result = await msal.acquireTokenSilent({ scopes: apiScopes(), account })
    return result.accessToken
  } catch (error) {
    const { InteractionRequiredAuthError } = await import('@azure/msal-browser')
    if (error instanceof InteractionRequiredAuthError) {
      await msal.acquireTokenRedirect({ scopes: apiScopes(), account })
    }
    return null
  }
}
