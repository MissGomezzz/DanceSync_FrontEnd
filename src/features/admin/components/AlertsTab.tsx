import { adminApi, type AdminAlert } from '../api/adminApi'
import { formatUtc, timeAgo } from '../lib/format'
import { usePolling } from '../lib/usePolling'
import { SeverityBadge } from './Badges'

const PROMETHEUS_STATUS: Record<string, string> = {
  not_configured: 'Prometheus is not configured (PROMETHEUS_URL): only the security alerts of the audit log are shown.',
  unavailable: 'Prometheus could not be reached: the operational alerts are unknown right now.',
}

function AlertCard({ alert }: { alert: AdminAlert }) {
  const labels = Object.entries(alert.labels).filter(([name]) => name !== 'lastAt')
  return (
    <li
      className={`flex flex-col gap-2 rounded-2xl border bg-surface p-4 shadow-soft ${alert.severity === 'critical' ? 'border-rose-300' : 'border-line'}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={alert.severity} />
        <span className="font-mono text-sm font-semibold text-ink">{alert.name}</span>
        {alert.state === 'pending' && <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink-muted">pending</span>}
        <span className="flex-1" />
        {alert.since && (
          <span className="text-xs text-ink-soft" title={formatUtc(alert.since)}>
            since {timeAgo(alert.since)}
          </span>
        )}
      </div>
      <p className="text-sm font-medium text-ink">{alert.summary}</p>
      {alert.description && <p className="text-sm text-ink-muted">{alert.description}</p>}
      {labels.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {labels.map(([name, value]) => (
            <li key={name} className="rounded-md bg-surface-muted px-2 py-0.5 font-mono text-[11px] text-ink-muted">
              {name}={value}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function AlertList({ title, description, alerts, empty }: { title: string; description: string; alerts: AdminAlert[]; empty: string }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="text-base font-bold text-ink">
          {title} <span className="ml-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink-muted">{alerts.length}</span>
        </h3>
        <p className="text-sm text-ink-muted">{description}</p>
      </div>
      {alerts.length === 0 ? (
        <p className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-4 text-sm text-accent-strong">
          <span aria-hidden="true">✔</span> {empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </ul>
      )}
    </section>
  )
}

/** Active alerts: security ones from the audit log, operational ones from the OBS-1 Prometheus rules. */
export function AlertsTab() {
  const { data, error, updatedAt } = usePolling((signal) => adminApi.alerts(signal), 15_000)
  if (!data) return <p className="p-6 text-sm text-ink-muted">{error ? `Could not load the alerts: ${error}` : 'Loading…'}</p>
  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-ink-soft">Refreshed every 15 s · last {updatedAt ? timeAgo(new Date(updatedAt).toISOString()) : '—'}</p>
      <AlertList
        title="Security"
        description="Derived from the audit log: repeated authentication failures from one address, clients blocked for flooding, a broken audit chain."
        alerts={data.security}
        empty="No security alerts."
      />
      {PROMETHEUS_STATUS[data.prometheusStatus] && (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {PROMETHEUS_STATUS[data.prometheusStatus]}
        </p>
      )}
      <AlertList
        title="Operations"
        description="Prometheus rules (OBS-1): replicas or services down, high latency, errors, audit records lost or a chain that went back."
        alerts={data.operational}
        empty={data.prometheusStatus === 'ok' ? 'All systems normal.' : 'Nothing to show.'}
      />
    </div>
  )
}
