import { Link, Outlet } from 'react-router'
import { Logo } from '../../shared/ui/atoms/Logo'

export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-800 bg-slate-950/80 px-6 py-3 backdrop-blur">
        <Link to="/" className="flex items-center gap-2">
          <Logo className="h-8" />
        </Link>
      </header>
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  )
}