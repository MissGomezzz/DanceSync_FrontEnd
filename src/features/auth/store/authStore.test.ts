import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAccessToken, onSessionChange } from '../../../shared/lib/authSession'
import { env } from '../../../shared/lib/env'
import { useAuthStore } from './authStore'

const grant = {
  token: 'guest-token-for-ROOM01',
  playerId: 'guest-0b9c7f0e',
  displayName: 'Lucía',
  roomCode: 'ROOM01',
  expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
}

function respondWith(status: number, body: unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(async () => {
  sessionStorage.clear()
  await useAuthStore.getState().signOut()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('guest session (SEG-1)', () => {
  it('asks the server for a token for the room and becomes the player the server generated', async () => {
    const fetchMock = respondWith(201, grant)

    const identity = await useAuthStore.getState().joinAsGuest(' room01 ', '  Lucía ')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${env.apiUrl}/api/rooms/ROOM01/guest-token`)
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ displayName: 'Lucía' }))
    // The guest has no token yet, so none is sent with this request.
    expect(init.headers).not.toHaveProperty('Authorization')

    // The id is the server's, not one made up in the browser.
    expect(identity).toEqual({ id: 'guest-0b9c7f0e', displayName: 'Lucía' })
    expect(useAuthStore.getState().session).toEqual({ kind: 'guest', roomCode: 'ROOM01', expiresAt: grant.expiresAt })
    expect(await getAccessToken()).toBe('guest-token-for-ROOM01')
  })

  it('stays signed out when the room does not exist', async () => {
    respondWith(404, { error: 'Room NOPE00 does not exist', code: 'ROOM_NOT_FOUND' })

    await expect(useAuthStore.getState().joinAsGuest('NOPE00', 'Lucía')).rejects.toMatchObject({ status: 404 })

    expect(useAuthStore.getState().identity).toBeNull()
    expect(useAuthStore.getState().session).toBeNull()
    expect(await getAccessToken()).toBeNull()
  })

  it('may enter the room of its token and no other', async () => {
    respondWith(201, grant)
    await useAuthStore.getState().joinAsGuest('ROOM01', 'Lucía')

    expect(useAuthStore.getState().canEnterRoom('room01')).toBe(true)
    expect(useAuthStore.getState().canEnterRoom('OTHER1')).toBe(false)
  })

  it('ends when the token expires: no token is sent and the guest has to join again', async () => {
    respondWith(201, { ...grant, expiresAt: new Date(Date.now() + 1000).toISOString() })
    await useAuthStore.getState().joinAsGuest('ROOM01', 'Lucía')
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 5000)

    expect(useAuthStore.getState().canEnterRoom('ROOM01')).toBe(false)
    expect(await getAccessToken()).toBeNull()
    expect(useAuthStore.getState().identity).toBeNull()
    expect(sessionStorage.getItem('dancesync.guest')).toBeNull()
  })

  it('tells the transport layer when the session changes, so open connections are dropped', async () => {
    const changed = vi.fn()
    const stop = onSessionChange(changed)
    respondWith(201, grant)

    await useAuthStore.getState().joinAsGuest('ROOM01', 'Lucía')
    expect(changed).toHaveBeenCalledTimes(1)
    await useAuthStore.getState().signOut()
    expect(changed).toHaveBeenCalledTimes(2)
    expect(await getAccessToken()).toBeNull()
    stop()
  })
})

describe('setDisplayName', () => {
  it('changes the name and never the player id', () => {
    useAuthStore.setState({ identity: { id: 'player-1', displayName: 'Guest-1234' }, session: { kind: 'user' } })
    const identity = useAuthStore.getState().setDisplayName('  Beto  ')
    expect(identity).toEqual({ id: 'player-1', displayName: 'Beto' })
    expect(useAuthStore.getState().identity).toEqual(identity)
  })

  it('does not invent an identity when nobody is signed in', () => {
    expect(useAuthStore.getState().setDisplayName('Beto')).toBeNull()
    expect(useAuthStore.getState().identity).toBeNull()
  })
})

describe('without a session', () => {
  it('no room can be entered and no token is sent', async () => {
    expect(useAuthStore.getState().canEnterRoom('ROOM01')).toBe(false)
    expect(await getAccessToken()).toBeNull()
  })

  it('reports that Microsoft sign-in is unavailable when the application is not configured', () => {
    expect(env.azureClientId).toBe('')
    expect(useAuthStore.getState().canSignIn).toBe(false)
  })
})
