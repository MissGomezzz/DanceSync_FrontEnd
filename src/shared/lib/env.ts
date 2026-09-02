/**
 * Typed access to Vite environment variables.
 * Values are read at build time from `.env` files (see `.env.example`).
 */
export const env = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:8080',
  wsUrl: import.meta.env.VITE_WS_URL ?? 'http://localhost:8080',
  azureClientId: import.meta.env.VITE_AZURE_CLIENT_ID ?? '',
  azureTenantId: import.meta.env.VITE_AZURE_TENANT_ID ?? '',
} as const

export type Env = typeof env
