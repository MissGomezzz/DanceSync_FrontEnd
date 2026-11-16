import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DevGrant } from '../lib/devLogin'

const { msal, dev } = vi.hoisted(() => ({
  msal: {
    isEntraConfigured: vi.fn(() => false),
    restoreEntraAccount: vi.fn(),
    signInWithEntra: vi.fn(async () => {}),
    signOutOfEntra: vi.fn(async () => {}),
    acquireEntraAccessToken: vi.fn(),
  },
  dev: {
    isDevLoginEnabled: vi.fn(() => false),
    loadDevGrant: vi.fn((): DevGrant | null => null),
    requestDevGrant: vi.fn(),
    storeDevGrant: vi.fn(),
  },
}))

vi.mock('../lib/msalClient', () => msal)
vi.mock('../lib/devLogin', () => dev)

const GUEST_KEY = 'dancesync.guest'
const NAME_KEY = 'dancesync.displayName'

const inOneHour = () => new Date(Date.now() + 60 * 60_000).toISOString()

const guestGrant = () => ({
  token: 'guest-token',
  playerId: 'guest-1',
  displayName: 'Lucía',
  roomCode: 'ROOM01',
  expiresAt: inOneHour(),
})

const devGrant = (expiresAt = inOneHour()): DevGrant => ({ token: 'dev-token', oid: 'dev-ana', name: 'Ana', expiresAt })

/** Imports a fresh copy of the store, so its start-up reads (storage, dev grant) run again. */
async function loadStore() {
  vi.resetModules()
  const { useAuthStore } = await import('./authStore')
  const authSession = await import('../../../shared/lib/authSession')
  return { useAuthStore, ...authSession }
}

beforeEach(() => {
  sessionStorage.clear()
  for (const fn of [...Object.values(msal), ...Object.values(dev)]) fn.mockReset()
  msal.isEntraConfigured.mockReturnValue(false)
  msal.signInWithEntra.mockResolvedValue(undefined)
  msal.signOutOfEntra.mockResolvedValue(undefined)
  dev.isDevLoginEnabled.mockReturnValue(false)
  dev.loadDevGrant.mockReturnValue(null)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('start-up', () => {
  it('picks up the guest token this tab already had', async () => {
    const grant = guestGrant()
    sessionStorage.setItem(GUEST_KEY, JSON.stringify(grant))

    const { useAuthStore, getAccessToken } = await loadStore()

    expect(useAuthStore.getState().identity).toEqual({ id: 'guest-1', displayName: 'Lucía' })
    expect(useAuthStore.getState().session).toEqual({ kind: 'guest', roomCode: 'ROOM01', expiresAt: grant.expiresAt })
    expect(await getAccessToken()).toBe('guest-token')
  })

  it.each([
    ['an expired grant', JSON.stringify({ ...guestGrant(), expiresAt: '2000-01-01T00:00:00Z' })],
    ['a grant with missing fields', JSON.stringify({ token: 't' })],
    ['corrupted data', '{oops'],
  ])('ignores %s', async (_label, raw) => {
    sessionStorage.setItem(GUEST_KEY, raw)
    const { useAuthStore } = await loadStore()
    expect(useAuthStore.getState().identity).toBeNull()
  })

  it('starts signed out when sessionStorage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { useAuthStore } = await loadStore()
    expect(useAuthStore.getState().session).toBeNull()
  })

  it('offers Microsoft sign-in only when Entra ID is configured', async () => {
    msal.isEntraConfigured.mockReturnValue(true)
    const { useAuthStore } = await loadStore()
    expect(useAuthStore.getState().canSignIn).toBe(true)
  })
})

describe('initialize with Microsoft Entra ID', () => {
  it('becomes the signed-in user, replacing any guest token, and tells the transport layer', async () => {
    sessionStorage.setItem(GUEST_KEY, JSON.stringify(guestGrant()))
    msal.restoreEntraAccount.mockResolvedValue({ id: 'oid-1', name: 'Ana Account' })
    msal.acquireEntraAccessToken.mockResolvedValue('entra-token')
    const { useAuthStore, getAccessToken, onSessionChange } = await loadStore()
    const changed = vi.fn()
    onSessionChange(changed)

    await useAuthStore.getState().initialize()

    expect(useAuthStore.getState().identity).toEqual({ id: 'oid-1', displayName: 'Ana Account' })
    expect(useAuthStore.getState().session).toEqual({ kind: 'user' })
    expect(sessionStorage.getItem(GUEST_KEY)).toBeNull()
    expect(changed).toHaveBeenCalledTimes(1)
    expect(await getAccessToken()).toBe('entra-token')
    expect(useAuthStore.getState().canEnterRoom('ANY001')).toBe(true)
  })

  it('keeps the display name the user chose over the account name', async () => {
    sessionStorage.setItem(NAME_KEY, 'Anita')
    msal.restoreEntraAccount.mockResolvedValue({ id: 'oid-1', name: 'Ana Account' })
    const { useAuthStore } = await loadStore()

    await useAuthStore.getState().initialize()

    expect(useAuthStore.getState().identity?.displayName).toBe('Anita')
  })

  it('stays signed out when there is no Microsoft account', async () => {
    msal.restoreEntraAccount.mockResolvedValue(null)
    const { useAuthStore } = await loadStore()
    await useAuthStore.getState().initialize()
    expect(useAuthStore.getState().session).toBeNull()
  })

  it('logs and stays signed out when the session cannot be restored', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    msal.restoreEntraAccount.mockRejectedValue(new Error('msal down'))
    const { useAuthStore } = await loadStore()

    await useAuthStore.getState().initialize()

    expect(error).toHaveBeenCalledWith('Could not restore the Microsoft session', expect.any(Error))
    expect(useAuthStore.getState().session).toBeNull()
  })

  it('delegates sign-in to the Microsoft redirect', async () => {
    const { useAuthStore } = await loadStore()
    await useAuthStore.getState().signIn()
    expect(msal.signInWithEntra).toHaveBeenCalledTimes(1)
  })

  it('also ends the Microsoft session on sign-out', async () => {
    msal.isEntraConfigured.mockReturnValue(true)
    msal.restoreEntraAccount.mockResolvedValue({ id: 'oid-1', name: 'Ana' })
    const { useAuthStore } = await loadStore()
    await useAuthStore.getState().initialize()

    await useAuthStore.getState().signOut()

    expect(msal.signOutOfEntra).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().identity).toBeNull()
  })

  it('remembers a new display name for a signed-in user', async () => {
    msal.restoreEntraAccount.mockResolvedValue({ id: 'oid-1', name: 'Ana' })
    const { useAuthStore } = await loadStore()
    await useAuthStore.getState().initialize()

    expect(useAuthStore.getState().setDisplayName('  Anita ')).toEqual({ id: 'oid-1', displayName: 'Anita' })
    expect(sessionStorage.getItem(NAME_KEY)).toBe('Anita')
    // A blank name is ignored.
    expect(useAuthStore.getState().setDisplayName('   ')).toEqual({ id: 'oid-1', displayName: 'Anita' })
  })

  it('keeps working in memory when sessionStorage rejects writes', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('quota')
    })
    msal.restoreEntraAccount.mockResolvedValue({ id: 'oid-1', name: 'Ana' })
    const { useAuthStore } = await loadStore()
    await useAuthStore.getState().initialize()

    expect(useAuthStore.getState().setDisplayName('Anita')?.displayName).toBe('Anita')
  })
})

describe('local test login', () => {
  it('restores a dev grant at start-up and sends its token', async () => {
    dev.loadDevGrant.mockReturnValue(devGrant())
    sessionStorage.setItem(GUEST_KEY, JSON.stringify(guestGrant()))
    const { useAuthStore, getAccessToken } = await loadStore()

    await useAuthStore.getState().initialize()

    expect(msal.restoreEntraAccount).not.toHaveBeenCalled()
    expect(useAuthStore.getState().identity).toEqual({ id: 'dev-ana', displayName: 'Ana' })
    expect(sessionStorage.getItem(GUEST_KEY)).toBeNull()
    expect(await getAccessToken()).toBe('dev-token')
    expect(msal.acquireEntraAccessToken).not.toHaveBeenCalled()
  })

  it('signs out when the dev token has expired', async () => {
    dev.loadDevGrant.mockReturnValue(devGrant(new Date(Date.now() - 1000).toISOString()))
    const { useAuthStore, getAccessToken } = await loadStore()
    await useAuthStore.getState().initialize()

    expect(await getAccessToken()).toBeNull()
    expect(useAuthStore.getState().session).toBeNull()
    expect(dev.storeDevGrant).toHaveBeenCalledWith(null)
  })

  it('signs in through the fake Entra ID and never signs out of Microsoft', async () => {
    vi.stubEnv('DEV', true)
    dev.isDevLoginEnabled.mockReturnValue(true)
    const grant = devGrant()
    dev.requestDevGrant.mockResolvedValue(grant)
    msal.isEntraConfigured.mockReturnValue(true)
    const { useAuthStore, getAccessToken } = await loadStore()

    await useAuthStore.getState().signInForLocalTest('dev-ana', 'Ana')

    expect(dev.requestDevGrant).toHaveBeenCalledWith('dev-ana', 'Ana')
    expect(dev.storeDevGrant).toHaveBeenCalledWith(grant)
    expect(sessionStorage.getItem(NAME_KEY)).toBe('Ana')
    expect(useAuthStore.getState().identity).toEqual({ id: 'dev-ana', displayName: 'Ana' })
    expect(await getAccessToken()).toBe('dev-token')

    await useAuthStore.getState().signOut()
    expect(msal.signOutOfEntra).not.toHaveBeenCalled()
  })

  it('refuses when the local test login is not enabled', async () => {
    const { useAuthStore } = await loadStore()
    await expect(useAuthStore.getState().signInForLocalTest('dev-ana', 'Ana')).rejects.toThrow(/not enabled/)
    expect(dev.requestDevGrant).not.toHaveBeenCalled()
  })
})
