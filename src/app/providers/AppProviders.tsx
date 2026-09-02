import type { ReactNode } from 'react'

interface AppProvidersProps {
  children: ReactNode
}

/**
 * Composition point for application-wide providers
 * (authentication, theming, query clients, etc.).
 * Currently a pass-through wrapper; providers will be added as features land.
 */
export function AppProviders({ children }: AppProvidersProps) {
  return <>{children}</>
}
