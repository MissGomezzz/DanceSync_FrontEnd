import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore, type AuthSession } from '../store/authStore'
import { RequireRoomAccess, RequireUser } from './RouteGuards'

function LoginProbe() {
  const location = useLocation()
  return <p>login page {location.search}</p>
}

/** Renders the guarded routes of the app with stand-in pages and returns after navigating to `path`. */
function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <LoginProbe /> },
      { path: '/home', element: <RequireUser><p>create a room</p></RequireUser> },
      { path: '/rooms/:roomCode', element: <RequireRoomAccess><p>room lobby</p></RequireRoomAccess> },
      { path: '/battle/:roomCode', element: <RequireRoomAccess><p>battle stage</p></RequireRoomAccess> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
}

function signedInAs(session: AuthSession | null): void {
  useAuthStore.setState({ identity: session ? { id: 'me', displayName: 'Me' } : null, session })
}

const inAnHour = () => new Date(Date.now() + 60 * 60_000).toISOString()

beforeEach(() => signedInAs(null))

describe('route guards (SEG-1)', () => {
  it('without a session, creating rooms and room pages lead to the login page', () => {
    renderAt('/home')
    expect(screen.getByText(/login page/)).toBeTruthy()
    expect(screen.queryByText('create a room')).toBeNull()
  })

  it('a shared room link opened without a session asks to sign in or join that room as a guest', () => {
    renderAt('/rooms/room01')
    expect(screen.getByText('login page ?join=ROOM01')).toBeTruthy()
    expect(screen.queryByText('room lobby')).toBeNull()
  })

  it('a signed-in user reaches the home page and any room', () => {
    signedInAs({ kind: 'user' })
    renderAt('/home')
    expect(screen.getByText('create a room')).toBeTruthy()
  })

  it('a signed-in user enters any room and its battle', () => {
    signedInAs({ kind: 'user' })
    renderAt('/battle/ROOM01')
    expect(screen.getByText('battle stage')).toBeTruthy()
  })

  it('a guest enters the room of their token, whatever the case of the code', () => {
    signedInAs({ kind: 'guest', roomCode: 'ROOM01', expiresAt: inAnHour() })
    renderAt('/rooms/room01')
    expect(screen.getByText('room lobby')).toBeTruthy()
  })

  it('a guest cannot open another room: they are asked to join it with its own code', () => {
    signedInAs({ kind: 'guest', roomCode: 'ROOM01', expiresAt: inAnHour() })
    renderAt('/rooms/OTHER1')
    expect(screen.getByText('login page ?join=OTHER1')).toBeTruthy()
    expect(screen.queryByText('room lobby')).toBeNull()
  })

  it('a guest cannot reach the page that creates rooms', () => {
    signedInAs({ kind: 'guest', roomCode: 'ROOM01', expiresAt: inAnHour() })
    renderAt('/home')
    expect(screen.getByText(/login page/)).toBeTruthy()
  })

  it('a guest whose token expired is sent back to join again', () => {
    signedInAs({ kind: 'guest', roomCode: 'ROOM01', expiresAt: new Date(Date.now() - 1000).toISOString() })
    renderAt('/rooms/ROOM01')
    expect(screen.getByText('login page ?join=ROOM01')).toBeTruthy()
  })
})
