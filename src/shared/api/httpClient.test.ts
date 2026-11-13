import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setAccessTokenProvider } from '../lib/authSession'
import { env } from '../lib/env'
import { HttpError, httpClient } from './httpClient'

let fetchMock: ReturnType<typeof vi.fn>

function headersOfLastCall(): Record<string, string> {
  const [, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, RequestInit]
  return init.headers as Record<string, string>
}

beforeEach(() => {
  fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  setAccessTokenProvider(async () => null)
})

describe('httpClient authentication (SEG-1)', () => {
  it('sends the session access token as a Bearer token on every request', async () => {
    setAccessTokenProvider(async () => 'access-token-1')

    await httpClient.post('/api/rooms', { displayName: 'Ana' })
    await httpClient.get('/api/matches/match-1')

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([`${env.apiUrl}/api/rooms`, `${env.apiUrl}/api/matches/match-1`])
    for (const [, init] of fetchMock.mock.calls) {
      expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer access-token-1' })
    }
  })

  it('asks for the token on each request, so a renewed one is used', async () => {
    const provider = vi.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('renewed')
    setAccessTokenProvider(provider)

    await httpClient.get('/api/matches/1')
    expect(headersOfLastCall().Authorization).toBe('Bearer old')
    await httpClient.get('/api/matches/1')
    expect(headersOfLastCall().Authorization).toBe('Bearer renewed')
  })

  it('sends no Authorization header without a session, nor for an anonymous request', async () => {
    await httpClient.get('/api/battles/health')
    expect(headersOfLastCall()).not.toHaveProperty('Authorization')

    setAccessTokenProvider(async () => 'access-token-1')
    await httpClient.post('/api/rooms/ROOM01/guest-token', { displayName: 'Lucía' }, { anonymous: true })
    expect(headersOfLastCall()).not.toHaveProperty('Authorization')
  })

  it('surfaces the 401 and 403 of the gateway as an HttpError with the status', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"code":"UNAUTHORIZED"}', { status: 401 }))
    await expect(httpClient.post('/api/rooms', {})).rejects.toMatchObject({ status: 401 })

    fetchMock.mockResolvedValueOnce(new Response('{"code":"FORBIDDEN"}', { status: 403 }))
    const error = await httpClient.get('/api/matches/1').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(HttpError)
    expect(error).toMatchObject({ status: 403 })
  })
})
