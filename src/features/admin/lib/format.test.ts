import { describe, expect, it } from 'vitest'
import { sampleRecord } from '../../../test/adminFixtures'
import { recordsQuery } from '../api/adminApi'
import { niceMax } from './chart'
import { actorOf, browserOf, formatUtc, localInputToIso, timeAgo, toCsv } from './format'

describe('admin formatting', () => {
  it('shows instants in UTC to the millisecond', () => {
    expect(formatUtc('2026-11-15T12:00:00.123Z')).toBe('2026-11-15 12:00:00.123 UTC')
    expect(formatUtc(null)).toBe('—')
    expect(formatUtc('garbage')).toBe('garbage')
  })

  it('names the browser from the User-Agent', () => {
    expect(browserOf(sampleRecord.userAgent)).toBe('Chrome 131')
    expect(browserOf('Mozilla/5.0 (Windows NT 10.0; rv:133.0) Gecko/20100101 Firefox/133.0')).toBe('Firefox 133')
    expect(browserOf('Mozilla/5.0 Chrome/131.0 Safari/537.36 Edg/131.0')).toBe('Edge 131')
    expect(browserOf('Mozilla/5.0 (Macintosh) Version/18.1 Safari/605.1.15')).toBe('Safari 18')
    expect(browserOf('curl/8.11')).toBe('curl/8.11')
    expect(browserOf('unknown')).toBe('unknown')
  })

  it('names the actor, or Anonymous when no token proved who it was', () => {
    expect(actorOf(sampleRecord)).toBe('Ana')
    expect(actorOf({ ...sampleRecord, userName: null })).toBe('oid-ana')
    expect(actorOf({ ...sampleRecord, userId: null, userKind: 'anonymous' })).toBe('Anonymous')
  })

  it('says how long ago something happened', () => {
    const now = Date.parse('2026-11-15T12:00:00Z')
    expect(timeAgo('2026-11-15T11:59:30Z', now)).toBe('30s ago')
    expect(timeAgo('2026-11-15T11:50:00Z', now)).toBe('10 min ago')
    expect(timeAgo('2026-11-15T09:00:00Z', now)).toBe('3 h ago')
    expect(timeAgo('2026-11-10T12:00:00Z', now)).toBe('5 days ago')
    expect(timeAgo(null, now)).toBe('never')
  })

  it('exports CSV with the chain fields, escaped, and without spreadsheet formulas', () => {
    const csv = toCsv([{ ...sampleRecord, userName: 'Ana, "la" bailarina', detail: '=HYPERLINK("x")' }])
    const [header, row] = csv.trim().split('\r\n')
    expect(header.split(',')).toEqual(expect.arrayContaining(['seq', 'occurredAt', 'ip', 'region', 'userAgent', 'prevHash', 'hash']))
    expect(row).toContain('"Ana, ""la"" bailarina"')
    expect(row).toContain(`"'=HYPERLINK(""x"")"`)
    expect(row).toContain('b'.repeat(64))
  })

  it('turns a local datetime input into an instant', () => {
    expect(localInputToIso('')).toBeUndefined()
    expect(localInputToIso('not a date')).toBeUndefined()
    expect(localInputToIso('2026-11-15T12:00')).toMatch(/^2026-11-15T\d{2}:00:00\.000Z$/)
  })

  it('rounds the chart axis to a clean number', () => {
    expect(niceMax(0)).toBe(1)
    expect(niceMax(7)).toBe(10)
    expect(niceMax(130)).toBe(200)
    expect(niceMax(4200)).toBe(5000)
    expect(niceMax(1000)).toBe(1000)
  })

  it('builds the records query with only the filters that are set', () => {
    expect(recordsQuery({})).toBe('limit=50')
    expect(
      recordsQuery({ user: ' Ana ', outcomes: ['rejected', 'blocked'], channel: 'socket.io', ip: '', correlationId: 'c-1' }, 120, 20),
    ).toBe('user=Ana&outcome=rejected&outcome=blocked&channel=socket.io&correlationId=c-1&beforeSeq=120&limit=20')
  })
})
