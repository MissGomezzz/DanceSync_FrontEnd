import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AlertsView, AuditOverview, ChainVerification } from '../api/adminApi'
import { sampleRecord } from '../../../test/adminFixtures'
import { AdminPage } from './AdminPage'

const api = vi.hoisted(() => ({
  session: vi.fn(),
  records: vi.fn(),
  overview: vi.fn(),
  verify: vi.fn(),
  alerts: vi.fn(),
}))

vi.mock('../api/adminApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/adminApi')>()),
  adminApi: api,
}))

const verification: ChainVerification = {
  valid: true,
  checked: 1234,
  headSeq: 1234,
  headHash: 'c'.repeat(64),
  firstBrokenSeq: null,
  problem: null,
  verifiedAt: new Date().toISOString(),
  durationMs: 12,
}

const overview: AuditOverview = {
  summary: {
    windowHours: 24,
    since: '2026-11-14T12:00:00Z',
    total: 1234,
    byOutcome: { ok: 1200, rejected: 30, rate_limited: 4 },
    byChannel: { http: 234, 'socket.io': 1000 },
    distinctUsers: 18,
    distinctIps: 9,
    topActions: [{ key: 'vote:cast', label: null, count: 600 }],
    topUsers: [{ key: 'oid-ana', label: 'Ana', count: 300 }],
    topIps: [{ key: '198.51.100.9', label: 'Lima, Peru (PE)', count: 30 }],
    topRegions: [{ key: 'Bogotá, Colombia (CO)', label: null, count: 900 }],
    timeline: [
      { hour: '2026-11-15T10:00:00Z', total: 200, incidents: 4 },
      { hour: '2026-11-15T11:00:00Z', total: 100, incidents: 30 },
    ],
    headSeq: 1234,
    lastRecordedAt: new Date().toISOString(),
  },
  lastVerification: verification,
  integrity: { keyedChain: true, geoipLoaded: true, verifyIntervalSeconds: 300 },
}

const alerts: AlertsView = {
  prometheusStatus: 'unavailable',
  operational: [],
  security: [
    {
      id: 'audit:auth-failures:198.51.100.9',
      source: 'audit',
      name: 'RepeatedAuthFailures',
      severity: 'critical',
      state: 'firing',
      summary: '60 refused requests from 198.51.100.9 in the last 15 minutes',
      description: 'A token being guessed looks like this.',
      since: new Date().toISOString(),
      labels: { ip: '198.51.100.9', region: 'Lima, Peru (PE)' },
    },
  ],
}

function renderAdmin(path = '/admin') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset()
  api.overview.mockResolvedValue(overview)
  api.records.mockResolvedValue({ records: [sampleRecord], nextBeforeSeq: null })
  api.alerts.mockResolvedValue(alerts)
  api.verify.mockResolvedValue(verification)
})

describe('AdminPage', () => {
  it('opens on the overview: totals, chain integrity, activity and top lists', async () => {
    renderAdmin()

    expect(await screen.findByText('Requests audited')).toBeTruthy()
    expect(screen.getAllByText('1,234').length).toBeGreaterThan(0)
    expect(screen.getByText('34')).toBeTruthy()
    expect(screen.getByText(/Intact: 1,234 records verified/)).toBeTruthy()
    expect(screen.getByText(/HMAC-SHA256/)).toBeTruthy()
    expect(screen.getAllByTestId('timeline-column')).toHaveLength(2)
    expect(screen.getByRole('table', { hidden: true })).toBeTruthy()
    expect(screen.getByRole('button', { name: /vote:cast/ })).toBeTruthy()
  })

  it('verifies the chain on demand and shows where it is broken', async () => {
    api.verify.mockResolvedValue({ ...verification, valid: false, firstBrokenSeq: 77, problem: 'ALTERED_RECORD' })
    renderAdmin()

    await userEvent.click(await screen.findByRole('button', { name: 'Verify now' }))

    expect(await screen.findByText(/Broken at record #77: a record was modified/)).toBeTruthy()
    expect(api.verify).toHaveBeenCalledTimes(1)
  })

  it('lists the audit records with the five fields and opens one with its hashes', async () => {
    renderAdmin('/admin?tab=audit')

    const row = (await screen.findByText('vote:cast')).closest('tr') as HTMLElement
    expect(within(row).getByText('Ana')).toBeTruthy()
    expect(within(row).getByText('203.0.113.7')).toBeTruthy()
    expect(within(row).getByText('Bogotá, Colombia (CO)')).toBeTruthy()
    expect(within(row).getByText('Chrome 131')).toBeTruthy()
    expect(within(row).getByText('2026-11-15 12:00:00.123')).toBeTruthy()

    await userEvent.click(row)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('b'.repeat(64))).toBeTruthy()
    expect(within(dialog).getByText('a'.repeat(64))).toBeTruthy()
    expect(within(dialog).getByText('dancerId=oid-beto')).toBeTruthy()

    await userEvent.click(within(dialog).getByRole('button', { name: 'All actions of this user' }))
    await waitFor(() => expect(api.records).toHaveBeenLastCalledWith(expect.objectContaining({ user: 'oid-ana' }), null, expect.anything()))
  })

  it('searches with the filters typed by the admin', async () => {
    renderAdmin('/admin?tab=audit')
    await screen.findByText('vote:cast')

    await userEvent.type(screen.getByLabelText('IP address'), '198.51.100.9')
    await userEvent.click(screen.getByRole('button', { name: 'Rejected' }))
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() =>
      expect(api.records).toHaveBeenLastCalledWith(
        expect.objectContaining({ ip: '198.51.100.9', outcomes: ['rejected'] }),
        null,
        expect.anything(),
      ),
    )
  })

  it('jumps from an address with incidents to its records', async () => {
    renderAdmin()

    await userEvent.click(await screen.findByRole('button', { name: /198\.51\.100\.9/ }))

    expect(await screen.findByRole('tab', { name: 'Audit log', selected: true })).toBeTruthy()
    await waitFor(() => expect(api.records).toHaveBeenCalledWith(expect.objectContaining({ ip: '198.51.100.9' }), null, expect.anything()))
  })

  it('shows the security alerts and says when Prometheus cannot be reached', async () => {
    renderAdmin('/admin?tab=alerts')

    expect(await screen.findByText('RepeatedAuthFailures')).toBeTruthy()
    expect(screen.getByText('Critical')).toBeTruthy()
    expect(screen.getByText(/Prometheus could not be reached/)).toBeTruthy()
    expect(screen.getByText('region=Lima, Peru (PE)')).toBeTruthy()
  })
})
