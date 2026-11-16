import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { devOidFor, isDevLoginEnabled, loadDevGrant, requestDevGrant, storeDevGrant, type DevGrant } from './devLogin'

const STORAGE_KEY = 'dancesync.devGrant'

const grant = (expiresInMs = 60_000): DevGrant => ({
  token: 'dev-token',
  oid: 'dev-ana',
  name: 'Ana',
  expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
})

beforeEach(() => {
  sessionStorage.clear()
  vi.stubEnv('DEV', true)
  vi.stubEnv('VITE_DEV_LOGIN_URL', 'http://localhost:9999//')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('isDevLoginEnabled', () => {
  it('is enabled under vite dev with a login URL', () => {
    expect(isDevLoginEnabled()).toBe(true)
  })

  it('is disabled without a login URL', () => {
    vi.stubEnv('VITE_DEV_LOGIN_URL', '')
    expect(isDevLoginEnabled()).toBe(false)
  })

  it('is disabled outside vite dev, whatever the URL', () => {
    vi.stubEnv('DEV', false)
    expect(isDevLoginEnabled()).toBe(false)
  })
})

describe('devOidFor', () => {
  it('derives a stable slug from the display name', () => {
    expect(devOidFor('  Ana María ')).toBe('dev-ana-mari-a')
    expect(devOidFor('Ana María')).toBe(devOidFor('ana maría'))
  })

  it('falls back to a generic player and caps the length', () => {
    expect(devOidFor('!!!')).toBe('dev-player')
    expect(devOidFor('x'.repeat(100))).toHaveLength(64)
  })
})

describe('requestDevGrant', () => {
  it('posts the user to the fake Entra ID and returns its grant', async () => {
    const body = grant()
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await requestDevGrant('dev-ana', 'Ana')).toEqual(body)
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:9999/dev/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oid: 'dev-ana', name: 'Ana' }),
    })
  })

  it('rejects when the fake Entra ID refuses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 503 })))
    await expect(requestDevGrant('dev-ana', 'Ana')).rejects.toThrow('The local test login answered 503')
  })
})

describe('stored grant', () => {
  it('round-trips a valid grant through sessionStorage', () => {
    const value = grant()
    storeDevGrant(value)
    expect(loadDevGrant()).toEqual(value)

    storeDevGrant(null)
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(loadDevGrant()).toBeNull()
  })

  it('drops an expired grant', () => {
    storeDevGrant(grant(-1000))
    expect(loadDevGrant()).toBeNull()
  })

  it('ignores a stored grant when the dev login is disabled', () => {
    storeDevGrant(grant())
    vi.stubEnv('VITE_DEV_LOGIN_URL', '')
    expect(loadDevGrant()).toBeNull()
  })

  it('ignores a corrupted grant', () => {
    sessionStorage.setItem(STORAGE_KEY, '{not json')
    expect(loadDevGrant()).toBeNull()
  })

  it('survives an unavailable sessionStorage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => storeDevGrant(grant())).not.toThrow()
  })
})
