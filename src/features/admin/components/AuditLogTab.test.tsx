import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { sampleRecord } from '../../../test/adminFixtures'
import type { RecordsPage, AuditRecord } from '../api/adminApi'
import { AuditLogTab } from './AuditLogTab'

const api = vi.hoisted(() => ({ records: vi.fn() }))

vi.mock('../api/adminApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/adminApi')>()),
  adminApi: api,
}))

const record = (seq: number, overrides: Partial<AuditRecord> = {}): AuditRecord => ({
  ...sampleRecord,
  seq,
  eventId: `event-${seq}`,
  ...overrides,
})

const page = (records: AuditRecord[], nextBeforeSeq: number | null = null): RecordsPage => ({ records, nextBeforeSeq })

/** Arguments of the last records() call: filters and the cursor. */
const lastQuery = () => api.records.mock.calls.at(-1) as [Record<string, unknown>, number | null, AbortSignal?]

beforeEach(() => {
  api.records.mockReset()
  api.records.mockResolvedValue(page([record(42)]))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('AuditLogTab: loading', () => {
  it('starts from the initial filters and shows them in the form', async () => {
    render(<AuditLogTab initialFilters={{ user: 'oid-ana', channel: 'http', outcomes: ['rejected'] }} />)

    expect(screen.getByRole('status').textContent).toBe('Loading…')
    expect(await screen.findByText('vote:cast')).toBeTruthy()
    expect(lastQuery()[0]).toEqual({ user: 'oid-ana', channel: 'http', outcomes: ['rejected'] })
    expect((screen.getByLabelText('User (id or name)') as HTMLInputElement).value).toBe('oid-ana')
    expect((screen.getByLabelText('Channel') as HTMLSelectElement).value).toBe('http')
    expect(screen.getByRole('button', { name: 'Rejected' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('1 records shown')).toBeTruthy()
  })

  it('says when no record matches', async () => {
    api.records.mockResolvedValue(page([]))
    render(<AuditLogTab initialFilters={{}} />)
    expect(await screen.findByText('No records match these filters.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Export CSV' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('reports a failed request', async () => {
    api.records.mockRejectedValue(new Error('403 Forbidden'))
    render(<AuditLogTab initialFilters={{}} />)
    expect((await screen.findByRole('alert')).textContent).toBe('Could not load the audit log: 403 Forbidden')
  })

  it('reports a failure without a message', async () => {
    api.records.mockRejectedValue('offline')
    render(<AuditLogTab initialFilters={{}} />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/Request failed/)
  })

  it('ignores the answer of a search that was replaced by a newer one', async () => {
    let resolveFirst: (value: RecordsPage) => void = () => {}
    api.records.mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
    api.records.mockResolvedValueOnce(page([record(7, { action: 'room:join' })]))
    render(<AuditLogTab initialFilters={{}} />)

    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(await screen.findByText('room:join')).toBeTruthy()
    const [firstFilters, , firstSignal] = api.records.mock.calls[0] as [unknown, unknown, AbortSignal]
    expect(firstFilters).toEqual({})
    expect(firstSignal.aborted).toBe(true)

    await act(async () => resolveFirst(page([record(1, { action: 'stale:action' })])))
    expect(screen.queryByText('stale:action')).toBeNull()
  })
})

describe('AuditLogTab: filters', () => {
  it('searches with every filter of the form', async () => {
    render(<AuditLogTab initialFilters={{}} />)
    await screen.findByText('vote:cast')

    await userEvent.type(screen.getByLabelText('User (id or name)'), 'Ana')
    await userEvent.type(screen.getByLabelText('Action'), 'vote')
    await userEvent.type(screen.getByLabelText('IP address'), '203.0.113.7')
    await userEvent.type(screen.getByLabelText('Correlation id'), 'corr-1')
    await userEvent.selectOptions(screen.getByLabelText('Channel'), 'socket.io')
    fireEvent.change(screen.getByLabelText('From (local time)'), { target: { value: '2026-11-15T10:00' } })
    fireEvent.change(screen.getByLabelText('To (local time)'), { target: { value: '2026-11-15T11:00' } })
    await userEvent.click(screen.getByRole('button', { name: 'Blocked' }))
    await userEvent.click(screen.getByRole('button', { name: 'Error' }))
    // Pressing an outcome again removes it.
    await userEvent.click(screen.getByRole('button', { name: 'Error' }))
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => expect(api.records).toHaveBeenCalledTimes(2))
    expect(lastQuery()[0]).toEqual({
      user: 'Ana',
      action: 'vote',
      ip: '203.0.113.7',
      correlationId: 'corr-1',
      channel: 'socket.io',
      outcomes: ['blocked'],
      from: new Date('2026-11-15T10:00').toISOString(),
      to: new Date('2026-11-15T11:00').toISOString(),
    })
    expect(lastQuery()[1]).toBeNull()
  })

  it('clears the form and searches without filters', async () => {
    render(<AuditLogTab initialFilters={{ ip: '198.51.100.9' }} />)
    await screen.findByText('vote:cast')

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))

    await waitFor(() => expect(lastQuery()[0]).toEqual({}))
    expect((screen.getByLabelText('IP address') as HTMLInputElement).value).toBe('')
  })

  it('applies a quick filter from the detail of a record', async () => {
    render(<AuditLogTab initialFilters={{}} />)
    const row = (await screen.findByText('vote:cast')).closest('tr') as HTMLElement

    row.focus()
    await userEvent.keyboard('{Enter}')
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'All actions of this user' }))

    await waitFor(() => expect(lastQuery()[0]).toMatchObject({ user: 'oid-ana' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect((screen.getByLabelText('User (id or name)') as HTMLInputElement).value).toBe('oid-ana')
  })

  it('opens a record with the space key and closes it', async () => {
    render(<AuditLogTab initialFilters={{}} />)
    const row = (await screen.findByText('vote:cast')).closest('tr') as HTMLElement

    fireEvent.keyDown(row, { key: 'a' })
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.keyDown(row, { key: ' ' })
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('AuditLogTab: records', () => {
  it('shows the socket resource, the detail and the rejection code', async () => {
    api.records.mockResolvedValue(page([record(5, { outcome: 'rejected', code: 'NOT_A_DANCER' })]))
    render(<AuditLogTab initialFilters={{}} />)
    const row = (await screen.findByText('vote:cast')).closest('tr') as HTMLElement

    expect(within(row).getByText('· ABC123')).toBeTruthy()
    expect(within(row).getByText('dancerId=oid-beto')).toBeTruthy()
    expect(within(row).getByText('NOT_A_DANCER')).toBeTruthy()
  })

  it('hides the resource of an HTTP record', async () => {
    api.records.mockResolvedValue(page([record(5, { channel: 'http', detail: null })]))
    render(<AuditLogTab initialFilters={{}} />)
    const row = (await screen.findByText('vote:cast')).closest('tr') as HTMLElement
    expect(within(row).queryByText('· ABC123')).toBeNull()
  })

  it('loads older pages and appends them', async () => {
    api.records.mockResolvedValueOnce(page([record(42)], 42))
    api.records.mockResolvedValueOnce(page([record(41, { action: 'room:leave' })], null))
    render(<AuditLogTab initialFilters={{ user: 'oid-ana' }} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Load older' }))

    expect(await screen.findByText('room:leave')).toBeTruthy()
    expect(lastQuery()).toEqual([{ user: 'oid-ana' }, 42])
    expect(screen.getByText('2 records shown')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Load older' })).toBeNull()
  })

  it('reports a failure while loading an older page', async () => {
    api.records.mockResolvedValueOnce(page([record(42)], 42))
    api.records.mockRejectedValueOnce(new Error('timeout'))
    render(<AuditLogTab initialFilters={{}} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Load older' }))

    expect((await screen.findByRole('alert')).textContent).toMatch(/timeout/)
    expect(screen.getByText('1 records shown')).toBeTruthy()
  })

  it('exports the records shown as a CSV file', async () => {
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:audit')
    const revokeObjectURL = vi.fn()
    // jsdom has no object URLs: install fakes for this test and put the originals back after it.
    const original = { createObjectURL: URL.createObjectURL, revokeObjectURL: URL.revokeObjectURL }
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    onTestFinished(() => {
      Object.assign(URL, original)
    })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<AuditLogTab initialFilters={{}} />)
    await screen.findByText('vote:cast')

    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }))

    expect(click).toHaveBeenCalledTimes(1)
    const link = click.mock.contexts[0] as HTMLAnchorElement
    expect(link.download).toMatch(/^dancesync-audit-.*\.csv$/)
    const blob = createObjectURL.mock.calls[0][0]
    expect(blob.type).toBe('text/csv;charset=utf-8')
    expect(await blob.text()).toContain('vote:cast')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:audit')
  })
})

describe('AuditLogTab: live mode', () => {
  it('reloads the newest page every 5 seconds while the page is visible', async () => {
    vi.useFakeTimers()
    render(<AuditLogTab initialFilters={{}} />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(api.records).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Live (every 5 s)' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    expect(api.records).toHaveBeenCalledTimes(2)

    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    expect(api.records).toHaveBeenCalledTimes(2)
    visibility.mockRestore()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Live (every 5 s)' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(api.records).toHaveBeenCalledTimes(2)
  })
})
