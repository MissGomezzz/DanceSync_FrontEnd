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
        // 16 px on phones: iOS zooms the page when a smaller field takes the focus.
        className={`rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-soft focus:border-primary focus:ring-2 focus:ring-primary/25 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:min-h-11 sm:text-sm ${className}`}
        {...rest}
      />
    </label>
  )
}
