import type { ReactNode } from 'react'
import { Navigate, useParams } from 'react-router'
import { joinPath } from '../lib/joinPath'
import { useAuthStore } from '../store/authStore'

/**
 * Pages for registered users (creating rooms): anyone else goes to the login
 * page. This is only navigation; the backend is what refuses the request.
 */
export function RequireUser({ children }: { children: ReactNode }) {
  const kind = useAuthStore((state) => state.session?.kind ?? null)
  if (kind !== 'user') return <Navigate to="/" replace />
  return <>{children}</>
}

/**
 * Pages of a room: a signed-in user enters any room, a guest only the room
 * their token was issued for. Anyone else (a shared link opened without a
 * session, a guest token for another room or expired) is sent to the login
 * page to sign in or to ask for a guest token for this room.
 */
export function RequireRoomAccess({ children }: { children: ReactNode }) {
  const { roomCode } = useParams<{ roomCode: string }>()
  // Subscribed, so the page reacts when the session ends (sign-out, expired guest token).
  const session = useAuthStore((state) => state.session)
  const canEnterRoom = useAuthStore((state) => state.canEnterRoom)
  if (!roomCode) return <Navigate to="/" replace />
  if (!session || !canEnterRoom(roomCode)) return <Navigate to={joinPath(roomCode)} replace />
  return <>{children}</>
}
