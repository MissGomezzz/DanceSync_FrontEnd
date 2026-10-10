import { Link, Outlet } from 'react-router'
import { useLeaveBeacon } from '../../features/rooms/hooks/useLeaveBeacon'
import { Logo } from '../../shared/ui/atoms/Logo'

export function AppLayout() {
  // Mounted once for every page: the seat is released on tab close wherever the player is.
  useLeaveBeacon()
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-(--layer-header) flex items-center gap-3 border-b border-slate-800 bg-slate-950/80 px-6 py-3 backdrop-blur">
        <Link to="/home" aria-label="DanceSync home" className="flex items-center gap-2">
          <Logo className="h-8" />
        </Link>
      </header>
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  )
}