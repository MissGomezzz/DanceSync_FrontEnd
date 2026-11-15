import { useState } from 'react'
import type { TimelineBucket } from '../api/adminApi'
import { niceMax } from '../lib/chart'
import { formatCount } from '../lib/format'

/** Validated pair (dataviz validator, light surface): violet for requests, amber for incidents. */
const REQUESTS_COLOR = '#7c3aed'
const INCIDENTS_COLOR = '#d97706'

function hourLabel(iso: string, withDay: boolean): string {
  const date = new Date(iso)
  const hour = `${String(date.getUTCHours()).padStart(2, '0')}:00`
  return withDay ? `${date.toISOString().slice(5, 10)} ${hour}` : hour
}

/**
 * Audited requests per hour (UTC), as stacked columns: security incidents (rejected, rate limited,
 * blocked) at the baseline, the rest above. One axis, a legend, a tooltip per column and a table
 * for screen readers.
 */
export function TimelineChart({ buckets }: { buckets: TimelineBucket[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const max = niceMax(Math.max(0, ...buckets.map((b) => b.total)))
  const multiDay = buckets.length > 30
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 8))
  const active = hovered === null ? null : buckets[hovered]

  return (
    <figure className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4 text-xs text-ink-muted" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: REQUESTS_COLOR }} /> Requests
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: INCIDENTS_COLOR }} /> Security incidents
        </span>
      </div>
      <div className="relative flex gap-2">
        <div className="flex h-44 flex-col justify-between text-right text-[11px] leading-none tabular-nums text-ink-soft" aria-hidden="true">
          <span>{formatCount(max)}</span>
          <span>{formatCount(max / 2)}</span>
          <span>0</span>
        </div>
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 flex h-44 flex-col justify-between" aria-hidden="true">
            <span className="h-px bg-line" />
            <span className="h-px bg-line" />
            <span className="h-px bg-line/0" />
          </div>
          <div
            className="relative flex h-44 items-end gap-0.5 border-b border-line pb-0"
            onMouseLeave={() => setHovered(null)}
            aria-hidden="true"
          >
            {buckets.map((bucket, index) => {
              const incidentsHeight = (bucket.incidents / max) * 100
              const restHeight = ((bucket.total - bucket.incidents) / max) * 100
              return (
                <div
                  key={bucket.hour}
                  className="flex h-full min-w-0 flex-1 cursor-default flex-col items-center justify-end"
                  onMouseEnter={() => setHovered(index)}
                  data-testid="timeline-column"
                >
                  <div className={`flex h-full w-full max-w-6 flex-col justify-end ${hovered === index ? 'opacity-100' : hovered === null ? 'opacity-100' : 'opacity-60'}`}>
                    {restHeight > 0 && (
                      <div className="w-full rounded-t-[4px]" style={{ height: `${restHeight}%`, background: REQUESTS_COLOR }} />
                    )}
                    {incidentsHeight > 0 && (
                      <div
                        className={`w-full ${restHeight > 0 ? 'mt-0.5' : 'rounded-t-[4px]'}`}
                        style={{ height: `${incidentsHeight}%`, background: INCIDENTS_COLOR }}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex h-5 gap-0.5 pt-1 text-[11px] text-ink-soft" aria-hidden="true">
            {buckets.map((bucket, index) => (
              <span key={bucket.hour} className="min-w-0 flex-1 overflow-visible whitespace-nowrap">
                {index % labelEvery === 0 ? hourLabel(bucket.hour, multiDay) : ''}
              </span>
            ))}
          </div>
          {active && hovered !== null && (
            <div
              role="tooltip"
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-soft"
              style={{ left: `${((hovered + 0.5) / buckets.length) * 100}%` }}
            >
              <p className="font-semibold text-ink">{hourLabel(active.hour, true)} UTC</p>
              <p className="text-ink-muted">
                <span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: REQUESTS_COLOR }} />
                {formatCount(active.total)} requests
              </p>
              <p className="text-ink-muted">
                <span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: INCIDENTS_COLOR }} />
                {formatCount(active.incidents)} incidents
              </p>
            </div>
          )}
        </div>
      </div>
      <figcaption className="sr-only">Audited requests per hour, UTC</figcaption>
      <table className="sr-only">
        <thead>
          <tr>
            <th>Hour (UTC)</th>
            <th>Requests</th>
            <th>Security incidents</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((bucket) => (
            <tr key={bucket.hour}>
              <td>{hourLabel(bucket.hour, true)}</td>
              <td>{bucket.total}</td>
              <td>{bucket.incidents}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
