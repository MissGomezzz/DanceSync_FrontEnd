import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, id, className = '', ...rest }: InputProps) {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-300" htmlFor={id}>
      {label && <span>{label}</span>}
      <input
        id={id}
        className={`rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-brand-red focus:outline-none ${className}`}
        {...rest}
      />
    </label>
  )
}
