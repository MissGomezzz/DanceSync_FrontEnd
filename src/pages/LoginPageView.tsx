import { Button } from '../shared/ui/atoms/Button'
import { Input } from '../shared/ui/atoms/Input'
import { Logo } from '../shared/ui/atoms/Logo'

interface LoginPageViewProps {
  /** False when the Entra ID application is not configured in this build. */
  canSignIn: boolean
  loginError: string | null
  submitting: boolean
  onLogin: () => void
  guestName: string
  onGuestNameChange: (value: string) => void
  joinCode: string
  onJoinCodeChange: (value: string) => void
  guestError: string | null
  joining: boolean
  onGuestJoin: () => void
}

export function LoginPageView({
  canSignIn,
  loginError,
  submitting,
  onLogin,
  guestName,
  onGuestNameChange,
  joinCode,
  onJoinCodeChange,
  guestError,
  joining,
  onGuestJoin,
}: LoginPageViewProps) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
      <header className="flex flex-col items-center text-center">
        <Logo className="h-32 mb-4" />
        <h1 className="text-gradient-brand text-4xl font-extrabold tracking-tight">Sign in</h1>
        <p className="mt-3 max-w-md text-ink-muted">
          Sign in to create rooms and compete, or jump straight into a room with a code.
        </p>
      </header>

      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-line bg-surface p-6 shadow-soft">
        <Button onClick={onLogin} disabled={submitting || !canSignIn}>
          {submitting ? 'Opening Microsoft sign-in...' : 'Sign in with Microsoft'}
        </Button>
        {loginError && (
          <p role="alert" className="text-sm font-medium text-rose-700">
            {loginError}
          </p>
        )}
        <p className="text-center text-xs text-ink-soft">
          {canSignIn
            ? 'You sign in on the Microsoft page with your organization account. DanceSync never sees your password.'
            : 'Microsoft sign-in is not configured for this site. You can still join a room as a guest.'}
        </p>
      </div>

      <div className="flex w-full max-w-sm items-center gap-3 text-xs uppercase tracking-wide text-ink-soft">
        <span className="h-px flex-1 bg-line" />
        or join as a guest
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-line bg-surface p-6 shadow-soft">
        <Input
          id="guest-name"
          label="Display name"
          placeholder="Your name"
          value={guestName}
          onChange={(event) => onGuestNameChange(event.target.value)}
        />
        <Input
          id="join-code"
          label="Room code"
          placeholder="ABC123"
          value={joinCode}
          onChange={(event) => onJoinCodeChange(event.target.value.toUpperCase())}
        />
        {guestError && (
          <p role="alert" className="text-sm font-medium text-rose-700">
            {guestError}
          </p>
        )}
        <Button
          variant="secondary"
          onClick={onGuestJoin}
          disabled={joining || joinCode.trim().length === 0 || guestName.trim().length === 0}
        >
          {joining ? 'Joining...' : 'Join room'}
        </Button>
        <p className="text-center text-xs text-ink-soft">
          Guests can dance, vote and chat in that room. Creating rooms needs an account.
        </p>
      </div>
    </main>
  )
}
