import { Outlet } from 'react-router'
import { useLeaveBeacon } from '../../features/rooms/hooks/useLeaveBeacon'

export function AppLayout() {
  // Mounted once for every page: the seat is released on tab close wherever the player is.
  useLeaveBeacon()
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  )
}
