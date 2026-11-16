/**
 * Typed access to Vite environment variables.
 * Values are read at build time from `.env` files (see `.env.example`).
 */
export const env = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:8080',
  wsUrl: import.meta.env.VITE_WS_URL ?? 'http://localhost:8080',
  azureClientId: import.meta.env.VITE_AZURE_CLIENT_ID ?? '',
  azureTenantId: import.meta.env.VITE_AZURE_TENANT_ID ?? '',
  /** Scope of the DanceSync API; defaults to api://<client id>/access_as_user. */
  azureApiScope: import.meta.env.VITE_AZURE_API_SCOPE ?? '',
  /** Comma separated TURN relay URLs (`turn:` / `turns:`) for the camera; empty means STUN only. */
  turnUrls: import.meta.env.VITE_TURN_URLS ?? '',
  turnUsername: import.meta.env.VITE_TURN_USERNAME ?? '',
  turnCredential: import.meta.env.VITE_TURN_CREDENTIAL ?? '',
} as const

export type Env = typeof env
