import type { AuditRecord } from '../features/admin/api/adminApi'

/** One audit record as the admin API serves it, for the admin screen tests. */
export const sampleRecord: AuditRecord = {
  seq: 42,
  eventId: '0f8b6c1e-0000-4000-8000-000000000042',
  occurredAt: '2026-11-15T12:00:00.123Z',
  recordedAt: '2026-11-15T12:00:01.000Z',
  source: 'battle-service@battle-1',
  channel: 'socket.io',
  action: 'vote:cast',
  resource: 'ABC123',
  outcome: 'ok',
  status: null,
  code: null,
  userId: 'oid-ana',
  userKind: 'user',
  userName: 'Ana',
  ip: '203.0.113.7',
  region: 'Bogotá, Colombia (CO)',
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
  correlationId: 'corr-1',
  detail: 'dancerId=oid-beto',
  prevHash: 'a'.repeat(64),
  hash: 'b'.repeat(64),
}
