import { Button } from '../shared/ui/atoms/Button'
import { Input } from '../shared/ui/atoms/Input'
import { Logo } from '../shared/ui/atoms/Logo'

interface LoginPageViewProps {
  username: string
  onUsernameChange: (value: string) => void
  password: string
  onPasswordChange: (value: string) => void
  loginError: string | null
  submitting: boolean
  onLogin: () => void
  guestName: string
  onGuestNameChange: (value: string) => void
  joinCode: string
  onJoinCodeChange: (value: string) => void
  onGuestJoin: () => void
}

export function LoginPageView({
  username,
  onUsernameChange,
  password,
  onPasswordChange,
  loginError,
  submitting,
  onLogin,
  guestName,
  onGuestNameChange,
  joinCode,
  onJoinCodeChange,
  onGuestJoin,
}: LoginPageViewProps) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
      <header className="flex flex-col items-center text-center">
        <Logo className="h-32 mb-4" />
        <h1 className="text-4xl font-extrabold tracking-tight text-brand-red">Sign in</h1>
        <p className="mt-3 max-w-md text-slate-400">
            Sign in to create rooms and compete, or jump straight into a room with a code.
        </p>
      </header>

      <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <Input
          id="username"
          label="Username"
          placeholder="Your username"
          value={username}
          onChange={(event) => onUsernameChange(event.target.value)}
        />
        <Input
          id="password"
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
        />
        {loginError && <p className="text-sm text-rose-400">{loginError}</p>}
        <Button onClick={onLogin} disabled={submitting}>
          {submitting ? 'Signing in...' : 'Sign in'}
        </Button>
        <p className="text-center text-xs text-slate-500">
            Demo credentials — any non-empty username &amp; password work for this MVP.
            <br />
        Try: <span className="text-slate-300">demo</span> / <span className="text-slate-300">demo123</span>
        </p>
      </div>

      <div className="flex w-full max-w-sm items-center gap-3 text-xs uppercase tracking-wide text-slate-500">
        <span className="h-px flex-1 bg-slate-800" />
        or join as a guest
        <span className="h-px flex-1 bg-slate-800" />
      </div>

      <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
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
        <Button
          variant="secondary"
          onClick={onGuestJoin}
          disabled={joinCode.trim().length === 0 || guestName.trim().length === 0}
        >
          Join room
        </Button>
      </div>
    </main>
  )
}