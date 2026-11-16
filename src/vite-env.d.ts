/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_WS_URL?: string
  readonly VITE_AZURE_CLIENT_ID?: string
  readonly VITE_AZURE_TENANT_ID?: string
  readonly VITE_AZURE_API_SCOPE?: string
  /** Camera (WebRTC): TURN relay for peers that cannot connect directly. */
  readonly VITE_TURN_URLS?: string
  readonly VITE_TURN_USERNAME?: string
  readonly VITE_TURN_CREDENTIAL?: string
  /** Local testing only (vite dev): the fake Entra ID of docker-compose.observability.yml. */
  readonly VITE_DEV_LOGIN_URL?: string
  readonly VITE_DEV_ADMIN_OID?: string
}

interface Window {
  onYouTubeIframeAPIReady?: () => void
}
