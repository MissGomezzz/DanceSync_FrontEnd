import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { defaultGuestName, useAuthStore } from '../features/auth/store/authStore'
import { HttpError } from '../shared/api/httpClient'
import { LoginPageView } from './LoginPageView'

/** Plain-words reason a guest could not get a token for the room. */
function guestJoinError(error: unknown): string {
  if (error instanceof HttpError && error.status === 404) return 'That room does not exist. Check the code.'
  if (error instanceof HttpError && error.status === 400) return 'Enter a display name of up to 32 characters.'
  return 'Could not join the room. Try again.'
}

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isUser = useAuthStore((state) => state.session?.kind === 'user')
  const canSignIn = useAuthStore((state) => state.canSignIn)
  const signIn = useAuthStore((state) => state.signIn)
  const joinAsGuest = useAuthStore((state) => state.joinAsGuest)

  const [loginError, setLoginError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [guestName, setGuestName] = useState(() => defaultGuestName())
  // A shared room link opened without a session lands here with the code filled in.
  const [joinCode, setJoinCode] = useState(() => (searchParams.get('join') ?? '').toUpperCase())
  const [guestError, setGuestError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  const pendingRoom = (searchParams.get('join') ?? '').trim().toUpperCase()
  if (isUser) return <Navigate to={pendingRoom ? `/rooms/${pendingRoom}` : '/home'} replace />

  const handleLogin = async () => {
    setSubmitting(true)
    setLoginError(null)
    try {
      // Leaves the page for the Microsoft sign-in; the app restarts when it comes back.
      await signIn()
    } catch {
      setLoginError('Could not start the Microsoft sign-in. Try again.')
      setSubmitting(false)
    }
  }

  const handleGuestJoin = async () => {
    const code = joinCode.trim().toUpperCase()
    if (code.length === 0 || joining) return
    setJoining(true)
    setGuestError(null)
    try {
      // The server checks the room and answers with a token valid only for it.
      await joinAsGuest(code, guestName)
      navigate(`/rooms/${code}`)
    } catch (error) {
      setGuestError(guestJoinError(error))
    } finally {
      setJoining(false)
    }
  }

  return (
    <LoginPageView
      canSignIn={canSignIn}
      loginError={loginError}
      submitting={submitting}
      onLogin={handleLogin}
      guestName={guestName}
      onGuestNameChange={setGuestName}
      joinCode={joinCode}
      onJoinCodeChange={setJoinCode}
      guestError={guestError}
      joining={joining}
      onGuestJoin={handleGuestJoin}
    />
  )
}
