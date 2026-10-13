import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, id, className = '', ...rest }: InputProps) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-ink-muted" htmlFor={id}>
      {label && <span>{label}</span>}
      <input
        id={id}
        className={`rounded-lg border border-line bg-surface px-3 py-2 text-ink placeholder:text-ink-soft/70 focus:border-primary focus:ring-2 focus:ring-primary/25 focus:outline-none ${className}`}
        {...rest}
      />
    </label>
  )
}
