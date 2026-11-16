import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acquireEntraAccessToken,
  apiScopes,
  isEntraConfigured,
  restoreEntraAccount,
  signInWithEntra,
  signOutOfEntra,
} from './msalClient'

const { env, msal, createClient, InteractionRequiredAuthError } = vi.hoisted(() => {
  class InteractionRequiredAuthError extends Error {}
  const msal = {
    handleRedirectPromise: vi.fn(),
    getActiveAccount: vi.fn(),
    getAllAccounts: vi.fn(),
    setActiveAccount: vi.fn(),
    loginRedirect: vi.fn(),
    logoutRedirect: vi.fn(),
    acquireTokenSilent: vi.fn(),
    acquireTokenRedirect: vi.fn(),
  }
  return {
    env: { azureClientId: 'client-id', azureTenantId: 'tenant-id', azureApiScope: '' },
    msal,
    createClient: vi.fn(async () => msal),
    InteractionRequiredAuthError,
  }
})

vi.mock('../../../shared/lib/env', () => ({ env }))
vi.mock('@azure/msal-browser', () => ({
  createStandardPublicClientApplication: createClient,
  InteractionRequiredAuthError,
}))

const account = {
  homeAccountId: 'home',
  localAccountId: 'local-id',
  environment: 'login.microsoftonline.com',
  tenantId: 'tenant-id',
  username: 'ana@contoso.com',
  name: 'Ana',
  idTokenClaims: { oid: 'oid-123' },
}

beforeEach(() => {
  Object.assign(env, { azureClientId: 'client-id', azureTenantId: 'tenant-id', azureApiScope: '' })
  for (const fn of Object.values(msal)) fn.mockReset()
  msal.getAllAccounts.mockReturnValue([])
})

describe('configuration', () => {
  it('is configured only with both the client and the tenant id', () => {
    expect(isEntraConfigured()).toBe(true)
    env.azureTenantId = ''
    expect(isEntraConfigured()).toBe(false)
  })

  it('asks for the default API scope unless one is configured', () => {
    expect(apiScopes()).toEqual(['api://client-id/access_as_user'])
    env.azureApiScope = 'api://custom/scope'
    expect(apiScopes()).toEqual(['api://custom/scope'])
  })
})

describe('restoreEntraAccount', () => {
  it('returns null without touching MSAL when Entra ID is not configured', async () => {
    env.azureClientId = ''
    expect(await restoreEntraAccount()).toBeNull()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('creates a single-tenant client that keeps tokens in sessionStorage, once', async () => {
    msal.handleRedirectPromise.mockResolvedValue(null)
    await restoreEntraAccount()
    await restoreEntraAccount()

    expect(createClient).toHaveBeenCalledTimes(1)
    expect(createClient).toHaveBeenCalledWith({
      auth: expect.objectContaining({
        clientId: 'client-id',
        authority: 'https://login.microsoftonline.com/tenant-id',
        redirectUri: window.location.origin,
      }),
      cache: { cacheLocation: 'sessionStorage' },
    })
  })

  it('completes a redirect sign-in and uses the oid claim as the player id', async () => {
    msal.handleRedirectPromise.mockResolvedValue({ account })

    expect(await restoreEntraAccount()).toEqual({ id: 'oid-123', name: 'Ana' })
    expect(msal.setActiveAccount).toHaveBeenCalledWith(account)
  })

  it('falls back to the active account, then to the first cached one', async () => {
    msal.handleRedirectPromise.mockResolvedValue(null)
    msal.getActiveAccount.mockReturnValueOnce({ ...account, name: undefined, idTokenClaims: {} })
    expect(await restoreEntraAccount()).toEqual({ id: 'local-id', name: 'ana@contoso.com' })

    msal.getAllAccounts.mockReturnValue([{ ...account, idTokenClaims: { oid: '' } }])
    expect(await restoreEntraAccount()).toEqual({ id: 'local-id', name: 'Ana' })
  })

  it('returns null when nobody is signed in', async () => {
    msal.handleRedirectPromise.mockResolvedValue(null)
    expect(await restoreEntraAccount()).toBeNull()
    expect(msal.setActiveAccount).not.toHaveBeenCalled()
  })
})

describe('sign-in and sign-out', () => {
  it('redirects to Microsoft asking for the API scope', async () => {
    await signInWithEntra()
    expect(msal.loginRedirect).toHaveBeenCalledWith({ scopes: ['api://client-id/access_as_user'] })
  })

  it('signs the active account out', async () => {
    msal.getActiveAccount.mockReturnValue(account)
    await signOutOfEntra()
    expect(msal.logoutRedirect).toHaveBeenCalledWith({ account })
  })
})

describe('acquireEntraAccessToken', () => {
  it('returns null without an active account', async () => {
    msal.getActiveAccount.mockReturnValue(null)
    expect(await acquireEntraAccessToken()).toBeNull()
    expect(msal.acquireTokenSilent).not.toHaveBeenCalled()
  })

  it('returns the token from the cache or a silent renewal', async () => {
    msal.getActiveAccount.mockReturnValue(account)
    msal.acquireTokenSilent.mockResolvedValue({ accessToken: 'token-1' })

    expect(await acquireEntraAccessToken()).toBe('token-1')
    expect(msal.acquireTokenSilent).toHaveBeenCalledWith({ scopes: ['api://client-id/access_as_user'], account })
  })

  it('sends the user to sign in again when interaction is required', async () => {
    msal.getActiveAccount.mockReturnValue(account)
    msal.acquireTokenSilent.mockRejectedValue(new InteractionRequiredAuthError('consent'))

    expect(await acquireEntraAccessToken()).toBeNull()
    expect(msal.acquireTokenRedirect).toHaveBeenCalledWith({ scopes: ['api://client-id/access_as_user'], account })
  })

  it('returns null without redirecting on any other failure', async () => {
    msal.getActiveAccount.mockReturnValue(account)
    msal.acquireTokenSilent.mockRejectedValue(new Error('network'))

    expect(await acquireEntraAccessToken()).toBeNull()
    expect(msal.acquireTokenRedirect).not.toHaveBeenCalled()
  })
})
