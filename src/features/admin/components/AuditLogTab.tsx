import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '../../../shared/ui/atoms/Button'
import { Input } from '../../../shared/ui/atoms/Input'
import { adminApi, AUDIT_OUTCOMES, type AuditFilters, type AuditOutcome, type AuditRecord } from '../api/adminApi'
import { actorOf, browserOf, formatUtc, localInputToIso, OUTCOME_LABELS, toCsv } from '../lib/format'
import { AuditRecordDetail } from './AuditRecordDetail'
import { OutcomeBadge } from './Badges'

const LIVE_INTERVAL_MS = 5_000

interface FormState {
  user: string
  action: string
  ip: string
  correlationId: string
  channel: '' | 'http' | 'socket.io'
  from: string
  to: string
  outcomes: AuditOutcome[]
}

const EMPTY_FORM: FormState = { user: '', action: '', ip: '', correlationId: '', channel: '', from: '', to: '', outcomes: [] }

function formFrom(filters: AuditFilters): FormState {
  return {
    ...EMPTY_FORM,
    user: filters.user ?? '',
    action: filters.action ?? '',
    ip: filters.ip ?? '',
    correlationId: filters.correlationId ?? '',
    channel: filters.channel ?? '',
    outcomes: filters.outcomes ?? [],
  }
}

function filtersFrom(form: FormState): AuditFilters {
  return {
    user: form.user,
    action: form.action,
    ip: form.ip,
    correlationId: form.correlationId,
    channel: form.channel,
    outcomes: form.outcomes,
    from: localInputToIso(form.from),
    to: localInputToIso(form.to),
  }
}

function download(name: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * The audit log itself (SEG-2): every request with its user, address, region, browser and UTC time,
 * newest first, filterable, with live refresh and a CSV export that keeps the chain fields.
 * `initialFilters` is read once: the parent remounts it (key) to apply new ones.
 */
export function AuditLogTab({ initialFilters }: { initialFilters: AuditFilters }) {
  const [form, setForm] = useState<FormState>(() => formFrom(initialFilters))
  const [filters, setFilters] = useState<AuditFilters>(initialFilters)
  const [records, setRecords] = useState<AuditRecord[]>([])
  const [nextBeforeSeq, setNextBeforeSeq] = useState<number | null>(null)
  // True until the first page arrives, and again whenever the filters change.
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState(false)
  const [selected, setSelected] = useState<AuditRecord | null>(null)
  const request = useRef<AbortController | null>(null)

  /** Bumped by the live mode to reload the newest page with the same filters. */
  const [tick, setTick] = useState(0)

  useEffect(() => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    adminApi
      .records(filters, null, controller.signal)
      .then(
        (page) => {
          if (controller.signal.aborted) return
          setRecords(page.records)
          setNextBeforeSeq(page.nextBeforeSeq)
          setError(null)
        },
        (cause: unknown) => {
          if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Request failed')
        },
      )
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [filters, tick])

  useEffect(() => {
    if (!live) return
    const timer = setInterval(() => {
      if (document.visibilityState !== 'hidden') setTick((value) => value + 1)
    }, LIVE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [live])

  const loadOlder = async () => {
    if (!nextBeforeSeq) return
    setLoading(true)
    try {
      const page = await adminApi.records(filters, nextBeforeSeq)
      setRecords((current) => [...current, ...page.records])
      setNextBeforeSeq(page.nextBeforeSeq)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  const search = (next: AuditFilters) => {
    setLoading(true)
    setFilters(next)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    search(filtersFrom(form))
  }

  const clear = () => {
    setForm(EMPTY_FORM)
    search({})
  }

  const toggleOutcome = (outcome: AuditOutcome) =>
    setForm((current) => ({
      ...current,
      outcomes: current.outcomes.includes(outcome)
        ? current.outcomes.filter((o) => o !== outcome)
        : [...current.outcomes, outcome],
    }))

  const applyQuickFilter = (filter: AuditFilters) => {
    setSelected(null)
    setForm(formFrom(filter))
    search(filter)
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-soft" aria-label="Filters">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input id="f-user" label="User (id or name)" value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} placeholder="Ana, 3f1c…" />
          <Input id="f-action" label="Action" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} placeholder="vote, POST /api/rooms" />
          <Input id="f-ip" label="IP address" value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} placeholder="203.0.113.7" />
          <Input id="f-corr" label="Correlation id" value={form.correlationId} onChange={(e) => setForm({ ...form, correlationId: e.target.value })} />
          <Input id="f-from" label="From (local time)" type="datetime-local" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
          <Input id="f-to" label="To (local time)" type="datetime-local" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-muted" htmlFor="f-channel">
            <span>Channel</span>
            <select
              id="f-channel"
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value as FormState['channel'] })}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-ink focus:border-primary focus:ring-2 focus:ring-primary/25 focus:outline-none"
            >
              <option value="">Any</option>
              <option value="http">HTTP</option>
              <option value="socket.io">Socket.IO</option>
            </select>
          </label>
        </div>
        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="sr-only">Outcome</legend>
          <span className="mr-1 text-sm font-medium text-ink-muted">Outcome:</span>
          {AUDIT_OUTCOMES.map((outcome) => (
            <button
              key={outcome}
              type="button"
              aria-pressed={form.outcomes.includes(outcome)}
              onClick={() => toggleOutcome(outcome)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${form.outcomes.includes(outcome) ? 'border-primary bg-primary-soft text-primary-strong' : 'border-line text-ink-muted hover:border-ink-soft'}`}
            >
              {OUTCOME_LABELS[outcome]}
            </button>
          ))}
        </fieldset>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit">Search</Button>
          <Button variant="ghost" onClick={clear}>
            Clear
          </Button>
          <span className="flex-1" />
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-muted">
            <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} className="accent-primary" />
            Live (every 5 s)
          </label>
          <Button variant="secondary" disabled={records.length === 0} onClick={() => download(`dancesync-audit-${new Date().toISOString().slice(0, 19)}.csv`, toCsv(records))}>
            Export CSV
          </Button>
        </div>
      </form>

      {error && (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          Could not load the audit log: {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-soft">
        <table className="w-full min-w-[60rem] text-left text-sm">
          <thead className="sticky top-0 bg-surface-muted text-xs tracking-wide text-ink-soft uppercase">
            <tr>
              <th scope="col" className="px-3 py-2">#</th>
              <th scope="col" className="px-3 py-2">Date & time (UTC)</th>
              <th scope="col" className="px-3 py-2">User</th>
              <th scope="col" className="px-3 py-2">Action</th>
              <th scope="col" className="px-3 py-2">Outcome</th>
              <th scope="col" className="px-3 py-2">IP / region</th>
              <th scope="col" className="px-3 py-2">Browser</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr
                key={record.seq}
                tabIndex={0}
                onClick={() => setSelected(record)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelected(record)
                  }
                }}
                className="cursor-pointer border-t border-line/70 hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none"
              >
                <td className="px-3 py-2 font-mono text-xs text-ink-soft">{record.seq}</td>
                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap text-ink-muted">{formatUtc(record.occurredAt).replace(' UTC', '')}</td>
                <td className="px-3 py-2">
                  <span className="font-medium text-ink">{actorOf(record)}</span>
                  <span className="ml-1 text-xs text-ink-soft">{record.userKind}</span>
                </td>
                <td className="px-3 py-2">
                  <span className="font-mono text-xs text-ink">{record.action}</span>
                  {record.channel === 'socket.io' && record.resource && <span className="ml-1 text-xs text-ink-soft">· {record.resource}</span>}
                  {record.detail && <div className="max-w-xs truncate font-mono text-[11px] text-ink-soft">{record.detail}</div>}
                </td>
                <td className="px-3 py-2">
                  <OutcomeBadge outcome={record.outcome} />
                  {record.code && <div className="mt-0.5 font-mono text-[11px] text-ink-soft">{record.code}</div>}
                </td>
                <td className="px-3 py-2">
                  <div className="font-mono text-xs text-ink">{record.ip}</div>
                  <div className="text-[11px] text-ink-soft">{record.region}</div>
                </td>
                <td className="px-3 py-2 text-xs text-ink-muted" title={record.userAgent}>
                  {browserOf(record.userAgent)}
                </td>
              </tr>
            ))}
            {records.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-sm text-ink-soft">
                  No records match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-ink-muted">
        <span>{records.length} records shown</span>
        {nextBeforeSeq ? (
          <Button variant="secondary" onClick={() => void loadOlder()} disabled={loading}>
            {loading ? 'Loading…' : 'Load older'}
          </Button>
        ) : (
          loading && <span role="status">Loading…</span>
        )}
      </div>

      {selected && <AuditRecordDetail record={selected} onClose={() => setSelected(null)} onFilter={applyQuickFilter} />}
    </div>
  )
}
