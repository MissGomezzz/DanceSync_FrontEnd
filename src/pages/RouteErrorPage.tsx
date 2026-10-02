import { Link } from 'react-router'

/** Router error boundary: shown instead of a blank screen when a page throws. */
export function RouteErrorPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-sm text-slate-400">The page failed to load. You can go back home and try again.</p>
      <Link
        to="/home"
        className="rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-light"
      >
        Back to home
      </Link>
    </main>
  )
}
