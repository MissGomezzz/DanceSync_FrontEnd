import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuthStore } from '../../auth/store/authStore'
import { Logo } from '../../../shared/ui/atoms/Logo'
import type { AuditFilters } from '../api/adminApi'
import { AlertsTab } from '../components/AlertsTab'
import { AuditLogTab } from '../components/AuditLogTab'
import { OverviewTab } from '../components/OverviewTab'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'audit', label: 'Audit log' },
  { id: 'alerts', label: 'Alerts' },
] as const

type TabId = (typeof TABS)[number]['id']

function isTab(value: string | null): value is TabId {
  return TABS.some((tab) => tab.id === value)
}

/**
 * The admin console (SEG-2): the non-repudiation audit log, its integrity and the alerts. Only the
 * single admin account reaches it (RequireAdmin here, ROLE_ADMIN at the gateway).
 */
export function AdminPage() {
  const identity = useAuthStore((state) => state.identity)
  const [params, setParams] = useSearchParams()
  const tab: TabId = isTab(params.get('tab')) ? (params.get('tab') as TabId) : 'overview'
  const [auditFilters, setAuditFilters] = useState<AuditFilters>({})

  const select = (id: TabId) => setParams(id === 'overview' ? {} : { tab: id }, { replace: true })

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Logo className="h-9" />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink">Admin console</h1>
            <p className="text-sm text-ink-muted">Audit log, integrity and alerts of DanceSync</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-full bg-secondary-soft px-3 py-1 font-semibold text-secondary-strong">
            Admin · {identity?.displayName ?? 'unknown'}
          </span>
          <Link to="/home" className="font-semibold text-ink-muted hover:text-ink">
            ← Back to the game
          </Link>
        </div>
      </header>

      <nav role="tablist" aria-label="Admin sections" className="flex gap-1 border-b border-line">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            id={`tab-${id}`}
            role="tab"
            type="button"
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => select(id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${tab === id ? 'border-primary text-primary-strong' : 'border-transparent text-ink-muted hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
      </nav>

      <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'overview' && (
          <OverviewTab
            onShowRecords={(filter) => {
              setAuditFilters(filter)
              select('audit')
            }}
          />
        )}
        {tab === 'audit' && <AuditLogTab key={JSON.stringify(auditFilters)} initialFilters={auditFilters} />}
        {tab === 'alerts' && <AlertsTab />}
      </section>
    </div>
  )
}
