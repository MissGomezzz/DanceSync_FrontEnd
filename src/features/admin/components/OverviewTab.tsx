import { useState } from 'react'
import { Button } from '../../../shared/ui/atoms/Button'
import { adminApi, AUDIT_OUTCOMES, type AuditOverview, type ChainVerification, type CountEntry } from '../api/adminApi'
import { formatCount, formatUtc, OUTCOME_LABELS, timeAgo } from '../lib/format'
import { usePolling } from '../lib/usePolling'
import { OutcomeBadge } from './Badges'
import { TimelineChart } from './TimelineChart'

const PROBLEM_TEXT: Record<string, string> = {
  MISSING_RECORD: 'a record is missing (deleted)',
  BROKEN_LINK: 'a record does not link to the one before it (deleted, inserted or reordered)',
  ALTERED_RECORD: 'a record was modified after it was written',
  TRUNCATED: 'the newest records were removed',
}

function Tile({ label, value, hint, tone = 'default' }: { label: string; value: string; hint?: string; tone?: 'default' | 'bad' | 'good' }) {
  const valueClass = tone === 'bad' ? 'text-rose-700' : tone === 'good' ? 'text-accent-strong' : 'text-ink'
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4 shadow-soft">
      <span className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{label}</span>
      <span className={`text-3xl font-extrabold tabular-nums ${valueClass}`}>{value}</span>
      {hint && <span className="text-xs text-ink-muted">{hint}</span>}
    </div>
  )
}

function TopList({ title, entries, empty, onPick }: { title: string; entries: CountEntry[]; empty: string; onPick?: (key: string) => void }) {
  const max = Math.max(1, ...entries.map((e) => e.count))
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-ink-soft">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li key={entry.key} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                {onPick ? (
                  <button
                    type="button"
                    className="min-w-0 truncate text-left font-medium text-ink hover:text-primary-strong hover:underline"
                    onClick={() => onPick(entry.key)}
                    title={`Show the records of ${entry.key}`}
                  >
                    {entry.label ? `${entry.label}` : entry.key}
                    {entry.label && <span className="ml-1 font-mono text-xs text-ink-soft">{entry.key}</span>}
                  </button>
                ) : (
                  <span className="min-w-0 truncate font-medium text-ink">{entry.key}</span>
                )}
                <span className="tabular-nums text-ink-muted">{formatCount(entry.count)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-muted" aria-hidden="true">
                <div className="h-1.5 rounded-full bg-secondary" style={{ width: `${(entry.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function IntegrityCard({ overview, onVerified }: { overview: AuditOverview; onVerified: () => void }) {
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState<ChainVerification | null>(null)
  const [error, setError] = useState<string | null>(null)
  const verification = result ?? overview.lastVerification

  const verify = async () => {
    setVerifying(true)
    setError(null)
    try {
      setResult(await adminApi.verify())
      onVerified()
    } catch {
      setError('The verification could not be completed. Try again.')
    } finally {
      setVerifying(false)
    }
  }

  const broken = verification && !verification.valid
  return (
    <section
      aria-labelledby="integrity-title"
      className={`flex flex-col gap-3 rounded-2xl border p-5 shadow-soft ${broken ? 'border-rose-300 bg-rose-50' : 'border-line bg-surface'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="integrity-title" className="text-base font-bold text-ink">
            Audit chain integrity
          </h3>
          <p className="text-sm text-ink-muted">
            Every record is chained to the previous one with {overview.integrity.keyedChain ? 'HMAC-SHA256' : 'SHA-256'}.
            Verifying walks the whole log and names the first record that was deleted, inserted or modified.
          </p>
        </div>
        <Button onClick={() => void verify()} disabled={verifying}>
          {verifying ? 'Verifying…' : 'Verify now'}
        </Button>
      </div>
      {verification ? (
        <div role="status" className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className={`inline-flex items-center gap-1.5 font-semibold ${broken ? 'text-rose-800' : 'text-accent-strong'}`}>
            <span aria-hidden="true">{broken ? '⛔' : '✔'}</span>
            {broken
              ? `Broken at record #${verification.firstBrokenSeq}: ${PROBLEM_TEXT[verification.problem ?? ''] ?? verification.problem}`
              : `Intact: ${formatCount(verification.checked)} records verified`}
          </span>
          <span className="text-ink-muted">
            Verified {timeAgo(verification.verifiedAt)} · {verification.durationMs} ms
          </span>
          <span className="font-mono text-xs text-ink-soft" title={verification.headHash}>
            head #{verification.headSeq} · {verification.headHash.slice(0, 16)}…
          </span>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Not verified yet by this instance (it runs every {Math.round(overview.integrity.verifyIntervalSeconds / 60)} min).</p>
      )}
      {error && <p className="text-sm font-medium text-rose-700">{error}</p>}
      <ul className="flex flex-wrap gap-2 text-xs">
        <li className="rounded-full bg-surface-muted px-2.5 py-1 text-ink-muted">Append-only table (UPDATE / DELETE refused)</li>
        <li className="rounded-full bg-surface-muted px-2.5 py-1 text-ink-muted">
          {overview.integrity.keyedChain ? 'Keyed chain (AUDIT_CHAIN_KEY)' : 'Unkeyed chain: set AUDIT_CHAIN_KEY'}
        </li>
        <li className="rounded-full bg-surface-muted px-2.5 py-1 text-ink-muted">
          {overview.integrity.geoipLoaded ? 'GeoIP database loaded' : 'No GeoIP database: public regions are "unknown"'}
        </li>
      </ul>
    </section>
  )
}

export function OverviewTab({ onShowRecords }: { onShowRecords: (filter: { user?: string; ip?: string; action?: string }) => void }) {
  const [hours, setHours] = useState(24)
  const { data: overview, error, refresh, updatedAt } = usePolling((signal) => adminApi.overview(hours, signal), 15_000, String(hours))

  if (!overview) {
    return <p className="p-6 text-sm text-ink-muted">{error ? `Could not load the overview: ${error}` : 'Loading…'}</p>
  }
  const { summary } = overview
  const incidents = (summary.byOutcome.rejected ?? 0) + (summary.byOutcome.rate_limited ?? 0) + (summary.byOutcome.blocked ?? 0)
  const chainBroken = overview.lastVerification ? !overview.lastVerification.valid : false

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-line bg-surface p-0.5" role="group" aria-label="Time window">
          {[
            [24, 'Last 24 h'],
            [168, 'Last 7 days'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={hours === value}
              onClick={() => setHours(value as number)}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${hours === value ? 'bg-primary text-white' : 'text-ink-muted hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-ink-soft">
          Last record {timeAgo(summary.lastRecordedAt)} · refreshed {updatedAt ? timeAgo(new Date(updatedAt).toISOString()) : '—'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Requests audited" value={formatCount(summary.total)} hint={`HTTP ${formatCount(summary.byChannel.http ?? 0)} · Socket.IO ${formatCount(summary.byChannel['socket.io'] ?? 0)}`} />
        <Tile label="Distinct users" value={formatCount(summary.distinctUsers)} hint={`${formatCount(summary.distinctIps)} client addresses`} />
        <Tile label="Security incidents" value={formatCount(incidents)} hint="Rejected, rate limited or blocked" tone={incidents > 0 ? 'bad' : 'default'} />
        <Tile
          label="Records in the chain"
          value={formatCount(summary.headSeq)}
          hint={overview.lastVerification ? (chainBroken ? 'Chain broken' : 'Chain intact') : 'Not verified yet'}
          tone={chainBroken ? 'bad' : overview.lastVerification ? 'good' : 'default'}
        />
      </div>

      <IntegrityCard overview={overview} onVerified={() => void refresh()} />

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
        <h3 className="mb-1 text-base font-bold text-ink">Activity per hour</h3>
        <p className="mb-4 text-sm text-ink-muted">Every request to the backend, by the hour it happened (UTC).</p>
        <TimelineChart buckets={summary.timeline} />
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
        <h3 className="mb-3 text-base font-bold text-ink">Outcomes</h3>
        <ul className="flex flex-wrap gap-3">
          {AUDIT_OUTCOMES.map((outcome) => (
            <li key={outcome} className="flex items-center gap-2 rounded-xl bg-surface-muted px-3 py-2">
              <OutcomeBadge outcome={outcome} />
              <span className="text-sm font-semibold tabular-nums text-ink" aria-label={`${OUTCOME_LABELS[outcome]}: ${summary.byOutcome[outcome] ?? 0}`}>
                {formatCount(summary.byOutcome[outcome] ?? 0)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <TopList title="Most frequent actions" entries={summary.topActions} empty="No requests in this window." onPick={(action) => onShowRecords({ action })} />
        <TopList title="Most active users" entries={summary.topUsers} empty="No authenticated requests." onPick={(user) => onShowRecords({ user })} />
        <TopList title="Addresses with security incidents" entries={summary.topIps} empty="No incidents. 🎉" onPick={(ip) => onShowRecords({ ip })} />
        <TopList title="Regions" entries={summary.topRegions} empty="No requests in this window." />
      </div>
      <p className="text-xs text-ink-soft">Window since {formatUtc(summary.since)}.</p>
    </div>
  )
}
