import type { ReactNode } from 'react'

type BadgeTone = 'neutral' | 'accent' | 'success'

interface BadgeProps {
  children: ReactNode
  tone?: BadgeTone
}

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-slate-800 text-slate-200',
  accent: 'bg-fuchsia-600/20 text-fuchsia-300',
  success: 'bg-emerald-600/20 text-emerald-300',
}

export function Badge({ children, tone = 'neutral' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClasses[tone]}`}>
      {children}
    </span>
  )
}
