import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../features/auth/store/authStore'
import { HttpError } from '../shared/api/httpClient'
import { LoginPage } from './LoginPage'

function renderLogin(path = '/') {
  const router = createMemoryRouter(
    [
      { path: '/', element: <LoginPage /> },
      { path: '/home', element: <p>home page</p> },
      { path: '/rooms/:roomCode', element: <p>room page</p> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

const initial = useAuthStore.getState()

beforeEach(() => {
  useAuthStore.setState({ identity: null, session: null, canSignIn: true })
})

afterEach(() => {
  useAuthStore.setState(initial, true)
})

describe('LoginPage (SEG-1)', () => {
  it('has no password form: signing in happens on the Microsoft page', async () => {
    const signIn = vi.fn().mockResolvedValue(undefined)
    useAuthStore.setState({ signIn })
    renderLogin()

    expect(screen.queryByLabelText(/password/i)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in with Microsoft' }))

    expect(signIn).toHaveBeenCalledTimes(1)
  })

  it('disables Microsoft sign-in, and says why, when the application is not configured', () => {
    useAuthStore.setState({ canSignIn: false })
    renderLogin()

    expect(screen.getByRole('button', { name: 'Sign in with Microsoft' })).toHaveProperty('disabled', true)
    expect(screen.getByText(/Microsoft sign-in is not configured/)).toBeTruthy()
  })

  it('a guest gets a token for the room from the server before entering it', async () => {
    const joinAsGuest = vi.fn().mockResolvedValue({ id: 'guest-1', displayName: 'Lucía' })
    useAuthStore.setState({ joinAsGuest })
    const router = renderLogin()

    await userEvent.clear(screen.getByLabelText('Display name'))
    await userEvent.type(screen.getByLabelText('Display name'), 'Lucía')
    await userEvent.type(screen.getByLabelText('Room code'), 'room01')
    await userEvent.click(screen.getByRole('button', { name: 'Join room' }))

    expect(joinAsGuest).toHaveBeenCalledWith('ROOM01', 'Lucía')
    await waitFor(() => expect(router.state.location.pathname).toBe('/rooms/ROOM01'))
  })

  it('stays on the page and explains it when the room does not exist', async () => {
    useAuthStore.setState({ joinAsGuest: vi.fn().mockRejectedValue(new HttpError(404, 'not found')) })
    const router = renderLogin()

    await userEvent.type(screen.getByLabelText('Room code'), 'NOPE00')
    await userEvent.click(screen.getByRole('button', { name: 'Join room' }))

    expect((await screen.findByRole('alert')).textContent).toBe('That room does not exist. Check the code.')
    expect(router.state.location.pathname).toBe('/')
  })

  it('fills in the code of the room a shared link pointed at', () => {
    renderLogin('/?join=room01')
    expect(screen.getByLabelText('Room code')).toHaveProperty('value', 'ROOM01')
  })

  it('a signed-in user skips the login page, going to the room they were sent to if any', () => {
    useAuthStore.setState({ identity: { id: 'me', displayName: 'Me' }, session: { kind: 'user' } })
    expect(renderLogin('/').state.location.pathname).toBe('/home')
  })

  it('a user who signed in from a shared room link lands in that room', () => {
    useAuthStore.setState({ identity: { id: 'me', displayName: 'Me' }, session: { kind: 'user' } })
    expect(renderLogin('/?join=room01').state.location.pathname).toBe('/rooms/ROOM01')
  })
})
