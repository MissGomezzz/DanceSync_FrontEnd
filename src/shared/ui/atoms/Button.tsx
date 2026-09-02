import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

const baseClasses =
  'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-50'

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-fuchsia-600 text-white hover:bg-fuchsia-500',
  secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700',
  ghost: 'bg-transparent text-slate-200 hover:bg-slate-800/60',
}

export function Button({ variant = 'primary', className = '', type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...rest} />
}
