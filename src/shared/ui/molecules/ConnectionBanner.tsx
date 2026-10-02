import type { ConnectionStatus } from '../../lib/connectionStatus'

interface ConnectionBannerProps {
  status: ConnectionStatus
}

const messages: Record<Exclude<ConnectionStatus, 'connected'>, string> = {
  connecting: 'Connecting to the server...',
  disconnected: 'Reconnecting to the server...',
}

/** Non-blocking notice shown while the real-time connection is not up. */
export function ConnectionBanner({ status }: ConnectionBannerProps) {
  if (status === 'connected') return null
  return (
    <p
      role="status"
      className="rounded-lg border border-amber-900 bg-amber-950/40 px-4 py-2 text-sm text-amber-200"
    >
      {messages[status]}
    </p>
  )
}
