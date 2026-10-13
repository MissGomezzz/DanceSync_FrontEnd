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
      className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700"
    >
      {messages[status]}
    </p>
  )
}
