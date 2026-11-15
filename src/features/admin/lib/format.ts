import type { AuditOutcome, AuditRecord } from '../api/adminApi'

/** "2026-11-15 12:00:00.123 UTC": the stored instant, unambiguous for an audit. */
export function formatUtc(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return `${date.toISOString().replace('T', ' ').replace('Z', '')} UTC`
}

/** "3 min ago", for freshness indicators. */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'never'
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h ago`
  return `${Math.round(hours / 24)} days ago`
}

export function formatCount(value: number): string {
  return value.toLocaleString('en-US')
}

export const OUTCOME_LABELS: Record<AuditOutcome, string> = {
  ok: 'OK',
  failed: 'Failed',
  rejected: 'Rejected',
  rate_limited: 'Rate limited',
  blocked: 'Blocked',
  error: 'Error',
}

/** Classes of the outcome pill: text tokens on a soft fill, always with the label (never color alone). */
export const OUTCOME_CLASSES: Record<AuditOutcome, string> = {
  ok: 'bg-accent-soft text-accent-strong',
  failed: 'bg-surface-muted text-ink-muted',
  rejected: 'bg-rose-100 text-rose-800',
  rate_limited: 'bg-sun-soft text-sun-strong',
  blocked: 'bg-rose-200 text-rose-900',
  error: 'bg-secondary-soft text-secondary-strong',
}

/** A short, readable browser name from a User-Agent; the full string stays in the detail view. */
export function browserOf(userAgent: string): string {
  if (!userAgent || userAgent === 'unknown') return 'unknown'
  const rules: Array<[RegExp, string]> = [
    [/Edg\/(\d+)/, 'Edge'],
    [/OPR\/(\d+)/, 'Opera'],
    [/Firefox\/(\d+)/, 'Firefox'],
    [/Chrome\/(\d+)/, 'Chrome'],
    [/Version\/(\d+).*Safari/, 'Safari'],
  ]
  for (const [pattern, name] of rules) {
    const match = pattern.exec(userAgent)
    if (match) return `${name} ${match[1]}`
  }
  return userAgent.length > 32 ? `${userAgent.slice(0, 32)}…` : userAgent
}

/** The person behind a record, as the screen names them. */
export function actorOf(record: Pick<AuditRecord, 'userId' | 'userName' | 'userKind'>): string {
  if (record.userKind === 'anonymous' || !record.userId) return 'Anonymous'
  return record.userName ?? record.userId
}

const CSV_COLUMNS: Array<keyof AuditRecord> = [
  'seq',
  'occurredAt',
  'userId',
  'userKind',
  'userName',
  'ip',
  'region',
  'userAgent',
  'channel',
  'action',
  'resource',
  'outcome',
  'status',
  'code',
  'detail',
  'correlationId',
  'source',
  'eventId',
  'recordedAt',
  'prevHash',
  'hash',
]

/** CSV of the records on screen, with the chain fields so a copy can be checked offline. */
export function toCsv(records: AuditRecord[]): string {
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return ''
    let text = String(value)
    // A cell starting with = + - @ would run as a formula in a spreadsheet.
    if (/^[=+\-@]/.test(text)) text = `'${text}`
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const lines = [CSV_COLUMNS.join(',')]
  for (const record of records) lines.push(CSV_COLUMNS.map((column) => escape(record[column])).join(','))
  return `${lines.join('\r\n')}\r\n`
}

/** `datetime-local` value (local time) -> ISO instant, or undefined. */
export function localInputToIso(value: string): string | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}
