import { Link } from 'react-router'

/** Router error boundary: shown instead of a blank screen when a page throws. */
export function RouteErrorPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold text-ink">Something went wrong</h1>
      <p className="text-sm text-ink-muted">The page failed to load. You can go back home and try again.</p>
      <Link
        to="/home"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Back to home
      </Link>
    </main>
  )
}
