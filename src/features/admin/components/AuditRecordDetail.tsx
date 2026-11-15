import { useEffect, useRef } from 'react'
import { Button } from '../../../shared/ui/atoms/Button'
import type { AuditFilters, AuditRecord } from '../api/adminApi'
import { actorOf, formatUtc } from '../lib/format'
import { OutcomeBadge } from './Badges'

interface Props {
  record: AuditRecord
  onClose: () => void
  /** Narrows the log to records sharing a value of this one. */
  onFilter: (filter: AuditFilters) => void
}

function Field({ label, value, mono = false }: { label: string; value: string | number | null | undefined; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-3 border-b border-line/70 py-2 text-sm last:border-0">
      <dt className="text-ink-soft">{label}</dt>
      <dd className={`min-w-0 break-all text-ink ${mono ? 'font-mono text-xs leading-5' : ''}`}>{value ?? '—'}</dd>
    </div>
  )
}

/** Every field of one audit record, with its place in the hash chain. */
export function AuditRecordDetail({ record, onClose, onFilter }: Props) {
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    dialog.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-(--layer-overlay) flex justify-end bg-ink/30 animate-fade-in" onClick={onClose}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-title"
        tabIndex={-1}
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-surface p-6 shadow-2xl outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Audit record #{record.seq}</p>
            <h2 id="record-title" className="mt-1 font-mono text-lg font-bold break-all text-ink">
              {record.action}
            </h2>
            <div className="mt-2 flex items-center gap-2">
              <OutcomeBadge outcome={record.outcome} />
              {record.status !== null && <span className="text-xs text-ink-muted">HTTP {record.status}</span>}
              {record.code && <span className="font-mono text-xs text-ink-muted">{record.code}</span>}
            </div>
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>

        <h3 className="mt-2 text-sm font-semibold text-ink">Who, from where, when</h3>
        <dl className="mt-1">
          <Field label="User" value={actorOf(record)} />
          <Field label="User id" value={record.userId} mono />
          <Field label="Kind" value={record.userKind} />
          <Field label="IP address" value={record.ip} mono />
          <Field label="Region" value={record.region} />
          <Field label="Browser" value={record.userAgent} mono />
          <Field label="Date & time" value={formatUtc(record.occurredAt)} />
        </dl>

        <h3 className="mt-5 text-sm font-semibold text-ink">What</h3>
        <dl className="mt-1">
          <Field label="Channel" value={record.channel} />
          <Field label="Resource" value={record.resource} mono />
          <Field label="Detail" value={record.detail} mono />
          <Field label="Correlation id" value={record.correlationId} mono />
          <Field label="Handled by" value={record.source} mono />
          <Field label="Event id" value={record.eventId} mono />
          <Field label="Chained at" value={formatUtc(record.recordedAt)} />
        </dl>

        <h3 className="mt-5 text-sm font-semibold text-ink">Hash chain</h3>
        <dl className="mt-1">
          <Field label="Previous hash" value={record.prevHash} mono />
          <Field label="Hash" value={record.hash} mono />
        </dl>

        <div className="mt-6 flex flex-wrap gap-2">
          {record.correlationId && (
            <Button variant="secondary" onClick={() => onFilter({ correlationId: record.correlationId ?? undefined })}>
              Same correlation id
            </Button>
          )}
          {record.userId && (
            <Button variant="secondary" onClick={() => onFilter({ user: record.userId ?? undefined })}>
              All actions of this user
            </Button>
          )}
          <Button variant="secondary" onClick={() => onFilter({ ip: record.ip })}>
            All from this address
          </Button>
        </div>
      </div>
    </div>
  )
}
