import { useCountdown } from '../../hooks/useCountdown'
import { useConnectionStore, type ConnectionStatus } from '../../lib/connectionStatus'

interface ConnectionBannerProps {
  status: ConnectionStatus
}

const messages: Record<'connecting' | 'disconnected', string> = {
  connecting: 'Connecting to the server...',
  disconnected: 'Reconnecting to the server...',
}

const noticeClass = 'rounded-lg border px-4 py-2 text-sm font-medium'
const warning = `${noticeClass} border-amber-200 bg-amber-50 text-amber-700`
const blocked = `${noticeClass} border-red-200 bg-red-50 text-red-700`

/**
 * Non-blocking notice shown while the real-time connection is not up, and the
 * early feedback of SEG-3: a "slow down" notice when the server dropped some of
 * this client's events, and a countdown while the server refuses it.
 */
export function ConnectionBanner({ status }: ConnectionBannerProps) {
  const blockedUntil = useConnectionStore((state) => state.blockedUntil)
  const slowDownUntil = useConnectionStore((state) => state.slowDownUntil)
  const blockedLeftMs = useCountdown(status === 'blocked' ? blockedUntil : null)
  const slowDownLeftMs = useCountdown(status === 'connected' ? slowDownUntil : null)

  if (status === 'blocked') {
    const seconds = Math.ceil(blockedLeftMs / 1000)
    return (
      <p role="status" className={blocked}>
        {seconds > 0
          ? `You sent too many actions too fast. You can continue in ${seconds} s.`
          : messages.disconnected}
      </p>
    )
  }
  if (status === 'connected') {
    if (slowDownLeftMs <= 0) return null
    return (
      <p role="status" className={warning}>
        You are going too fast: some of your actions were not sent. Slow down a little.
      </p>
    )
  }
  return (
    <p role="status" className={warning}>
      {messages[status]}
    </p>
  )
}
