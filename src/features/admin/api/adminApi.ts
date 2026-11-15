import { httpClient } from '../../../shared/api/httpClient'

/** What happened to a request (SEG-2). */
export type AuditOutcome = 'ok' | 'failed' | 'rejected' | 'rate_limited' | 'blocked' | 'error'
export type AuditChannel = 'http' | 'socket.io'
export type AuditUserKind = 'user' | 'guest' | 'anonymous'

export const AUDIT_OUTCOMES: AuditOutcome[] = ['ok', 'failed', 'rejected', 'rate_limited', 'blocked', 'error']

/** One record of the hash-chained audit log, as served by `GET /api/admin/audit/records`. */
export interface AuditRecord {
  seq: number
  eventId: string
  /** UTC instant, clock of the server that handled the request. */
  occurredAt: string
  recordedAt: string
  source: string
  channel: AuditChannel
  action: string
  resource: string | null
  outcome: AuditOutcome
  status: number | null
  code: string | null
  userId: string | null
  userKind: AuditUserKind
  userName: string | null
  ip: string
  region: string
  userAgent: string
  correlationId: string | null
  detail: string | null
  prevHash: string
  hash: string
}

export interface RecordsPage {
  records: AuditRecord[]
  /** Pass as `beforeSeq` to get the next (older) page; null on the last one. */
  nextBeforeSeq: number | null
}

export interface AuditFilters {
  user?: string
  action?: string
  outcomes?: AuditOutcome[]
  channel?: AuditChannel | ''
  ip?: string
  correlationId?: string
  /** ISO-8601 instants. */
  from?: string
  to?: string
}

export type ChainProblem = 'MISSING_RECORD' | 'BROKEN_LINK' | 'ALTERED_RECORD' | 'TRUNCATED'

export interface ChainVerification {
  valid: boolean
  checked: number
  headSeq: number
  headHash: string
  firstBrokenSeq: number | null
  problem: ChainProblem | null
  verifiedAt: string
  durationMs: number
}

export interface CountEntry {
  key: string
  label: string | null
  count: number
}

export interface TimelineBucket {
  hour: string
  total: number
  incidents: number
}

export interface AuditSummary {
  windowHours: number
  since: string
  total: number
  byOutcome: Partial<Record<AuditOutcome, number>>
  byChannel: Partial<Record<AuditChannel, number>>
  distinctUsers: number
  distinctIps: number
  topActions: CountEntry[]
  topUsers: CountEntry[]
  topIps: CountEntry[]
  topRegions: CountEntry[]
  timeline: TimelineBucket[]
  headSeq: number
  lastRecordedAt: string | null
}

export interface AuditOverview {
  summary: AuditSummary
  lastVerification: ChainVerification | null
  integrity: { keyedChain: boolean; geoipLoaded: boolean; verifyIntervalSeconds: number }
}

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface AdminAlert {
  id: string
  source: 'prometheus' | 'audit'
  name: string
  severity: AlertSeverity | string
  state: 'firing' | 'pending' | string
  summary: string
  description: string | null
  since: string | null
  labels: Record<string, string>
}

export interface AlertsView {
  operational: AdminAlert[]
  security: AdminAlert[]
  prometheusStatus: 'ok' | 'unavailable' | 'not_configured'
}

/** The query string of a records request; empty filters are left out. */
export function recordsQuery(filters: AuditFilters, beforeSeq?: number | null, limit = 50): string {
  const params = new URLSearchParams()
  const add = (name: string, value: string | undefined) => {
    if (value && value.trim().length > 0) params.append(name, value.trim())
  }
  add('user', filters.user)
  add('action', filters.action)
  for (const outcome of filters.outcomes ?? []) params.append('outcome', outcome)
  add('channel', filters.channel || undefined)
  add('ip', filters.ip)
  add('correlationId', filters.correlationId)
  add('from', filters.from)
  add('to', filters.to)
  if (beforeSeq) params.set('beforeSeq', String(beforeSeq))
  params.set('limit', String(limit))
  return params.toString()
}

/**
 * The admin screen's API (SEG-2). The gateway lets these requests through only for the single
 * admin account; for anyone else they answer 403. Each call is itself recorded in the audit log.
 */
export const adminApi = {
  /**
   * Whether the signed-in user is the admin. Asked to the gateway (`GET /api/me`), which answers 200
   * to anyone signed in: probing `/api/admin/**` would record a 403 for every regular user who opens
   * the home page, as if they had tried to open the admin screen.
   */
  session: () => httpClient.get<{ admin: boolean }>('/api/me'),
  records: (filters: AuditFilters, beforeSeq?: number | null, signal?: AbortSignal) =>
    httpClient.get<RecordsPage>(`/api/admin/audit/records?${recordsQuery(filters, beforeSeq)}`, { signal }),
  overview: (hours = 24, signal?: AbortSignal) =>
    httpClient.get<AuditOverview>(`/api/admin/audit/summary?hours=${hours}`, { signal }),
  verify: () => httpClient.post<ChainVerification>('/api/admin/audit/verify'),
  alerts: (signal?: AbortSignal) => httpClient.get<AlertsView>('/api/admin/alerts', { signal }),
}
