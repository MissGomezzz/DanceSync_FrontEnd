import type { AuditOutcome } from '../api/adminApi'
import { OUTCOME_CLASSES, OUTCOME_LABELS } from '../lib/format'

export function OutcomeBadge({ outcome }: { outcome: AuditOutcome }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${OUTCOME_CLASSES[outcome] ?? OUTCOME_CLASSES.failed}`}
    >
      {OUTCOME_LABELS[outcome] ?? outcome}
    </span>
  )
}

const SEVERITY: Record<string, { label: string; icon: string; classes: string }> = {
  critical: { label: 'Critical', icon: '⛔', classes: 'bg-rose-100 text-rose-800 ring-rose-200' },
  warning: { label: 'Warning', icon: '⚠', classes: 'bg-sun-soft text-sun-strong ring-amber-200' },
  info: { label: 'Info', icon: 'ℹ', classes: 'bg-secondary-soft text-secondary-strong ring-violet-200' },
}

/** Status is never color alone: icon + label on every severity. */
export function SeverityBadge({ severity }: { severity: string }) {
  const style = SEVERITY[severity] ?? SEVERITY.info
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${style.classes}`}>
      <span aria-hidden="true">{style.icon}</span>
      {style.label}
    </span>
  )
}
