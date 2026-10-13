import type { ReactNode } from 'react'

type BadgeTone = 'neutral' | 'accent' | 'success' | 'teal' | 'sun'

interface BadgeProps {
  children: ReactNode
  tone?: BadgeTone
}

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-ink-soft',
  accent: 'bg-secondary-soft text-secondary-strong',
  success: 'bg-accent text-ink',
  teal: 'bg-accent-soft text-accent-strong',
  sun: 'bg-sun-soft text-sun-strong',
}

export function Badge({ children, tone = 'neutral' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${toneClasses[tone]}`}>
      {children}
    </span>
  )
}
