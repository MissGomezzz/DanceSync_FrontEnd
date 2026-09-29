import { useState } from 'react'
import { useNavigate } from 'react-router'
import { defaultGuestName, useAuthStore } from '../features/auth/store/authStore'
import { LoginPageView } from './LoginPageView'

export function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)
  const setDisplayName = useAuthStore((state) => state.setDisplayName)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [guestName, setGuestName] = useState(() => defaultGuestName())
  const [joinCode, setJoinCode] = useState('')

  const handleLogin = () => {
    if (username.trim().length === 0 || password.trim().length === 0) {
      setLoginError('Enter a username and password.')
      return
    }
    setSubmitting(true)
    setLoginError(null)
    login(username)
    navigate('/home')
  }

  const handleGuestJoin = () => {
    const code = joinCode.trim().toUpperCase()
    if (code.length === 0) return
    setDisplayName(guestName)
    navigate(`/rooms/${code}`)
  }

  return (
    <LoginPageView
      username={username}
      onUsernameChange={setUsername}
      password={password}
      onPasswordChange={setPassword}
      loginError={loginError}
      submitting={submitting}
      onLogin={handleLogin}
      guestName={guestName}
      onGuestNameChange={setGuestName}
      joinCode={joinCode}
      onJoinCodeChange={setJoinCode}
      onGuestJoin={handleGuestJoin}
    />
  )
}