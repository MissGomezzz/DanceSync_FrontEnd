/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_WS_URL?: string
  readonly VITE_AZURE_CLIENT_ID?: string
  readonly VITE_AZURE_TENANT_ID?: string
}

interface Window {
  onYouTubeIframeAPIReady?: () => void
}
