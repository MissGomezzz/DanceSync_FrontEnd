import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

const baseClasses =
  'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50'

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white shadow-sm hover:bg-primary-strong',
  secondary: 'bg-secondary-soft text-secondary-strong hover:bg-secondary/20',
  ghost: 'bg-transparent text-ink-muted hover:bg-surface-muted hover:text-ink',
  success: 'bg-accent-strong text-white shadow-sm hover:bg-teal-800',
  danger: 'bg-rose-600 text-white shadow-sm hover:bg-rose-700',
}

export function Button({ variant = 'primary', className = '', type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...rest} />
}
