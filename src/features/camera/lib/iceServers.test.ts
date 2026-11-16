import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildIceServers, DEFAULT_ICE_SERVERS } from './iceServers'

const none = { turnUrls: '', turnUsername: '', turnCredential: '' }

let warn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => warn.mockRestore())

describe('buildIceServers', () => {
  it('uses the public STUN server when no TURN relay is configured', () => {
    expect(buildIceServers(none)).toEqual([{ urls: 'stun:stun.l.google.com:19302' }])
    expect(buildIceServers({ ...none, turnUrls: ' , ' })).toBe(DEFAULT_ICE_SERVERS)
    expect(warn).not.toHaveBeenCalled()
  })

  it('adds the configured TURN relay next to STUN', () => {
    const servers = buildIceServers({
      turnUrls: 'turn:relay.example.com:3478, turns:relay.example.com:5349?transport=tcp ,turn:[2001:db8::1]:3478',
      turnUsername: 'dancer',
      turnCredential: 'secret',
    })
    expect(servers).toEqual([
      ...DEFAULT_ICE_SERVERS,
      {
        urls: ['turn:relay.example.com:3478', 'turns:relay.example.com:5349?transport=tcp', 'turn:[2001:db8::1]:3478'],
        username: 'dancer',
        credential: 'secret',
      },
    ])
    expect(warn).not.toHaveBeenCalled()
  })

  it('skips malformed URLs and keeps the valid ones', () => {
    const servers = buildIceServers({
      turnUrls: 'https://relay.example.com, turn:, turn:relay.example.com, stun:other.example.com',
      turnUsername: 'dancer',
      turnCredential: 'secret',
    })
    expect(servers[1]).toEqual({ urls: ['turn:relay.example.com'], username: 'dancer', credential: 'secret' })
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('falls back to STUN when every URL is malformed', () => {
    expect(buildIceServers({ turnUrls: 'relay.example.com', turnUsername: 'dancer', turnCredential: 'secret' })).toBe(
      DEFAULT_ICE_SERVERS,
    )
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('ignores a relay without both credentials and never logs them', () => {
    const turnUrls = 'turn:relay.example.com:3478'
    expect(buildIceServers({ turnUrls, turnUsername: 'dancer', turnCredential: '' })).toBe(DEFAULT_ICE_SERVERS)
    expect(buildIceServers({ turnUrls, turnUsername: '', turnCredential: 'secret' })).toBe(DEFAULT_ICE_SERVERS)
    expect(warn).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret')
  })
})
