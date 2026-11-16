import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEV_ADMIN_OID } from '../lib/devLogin'
import { useAuthStore } from '../store/authStore'
import { LocalTestLogin } from './LocalTestLogin'

const signInForLocalTest = vi.fn()

beforeEach(() => {
  signInForLocalTest.mockReset()
  useAuthStore.setState({ signInForLocalTest })
  vi.stubEnv('DEV', true)
  vi.stubEnv('VITE_DEV_LOGIN_URL', 'http://localhost:9999')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('LocalTestLogin', () => {
  it('renders nothing when the local test login is disabled', () => {
    vi.stubEnv('VITE_DEV_LOGIN_URL', '')
    const { container } = render(<LocalTestLogin />)
    expect(container.innerHTML).toBe('')
  })

  it('signs in as the admin test account', async () => {
    signInForLocalTest.mockResolvedValue(undefined)
    render(<LocalTestLogin />)

    await userEvent.click(screen.getByRole('button', { name: 'Sign in as the admin' }))

    expect(signInForLocalTest).toHaveBeenCalledWith(DEV_ADMIN_OID, 'Admin')
  })

  it('signs in as a test player derived from the typed name', async () => {
    signInForLocalTest.mockResolvedValue(undefined)
    render(<LocalTestLogin />)

    const name = screen.getByLabelText('Test player')
    await userEvent.clear(name)
    await userEvent.type(name, ' Beto ')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(signInForLocalTest).toHaveBeenCalledWith('dev-beto', 'Beto')
  })

  it('cannot sign in a player without a name', async () => {
    render(<LocalTestLogin />)
    await userEvent.clear(screen.getByLabelText('Test player'))
    expect((screen.getByRole('button', { name: 'Sign in' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('explains the failure and lets the user try again', async () => {
    signInForLocalTest.mockRejectedValue(new Error('down'))
    render(<LocalTestLogin />)

    await userEvent.click(screen.getByRole('button', { name: 'Sign in as the admin' }))

    expect((await screen.findByRole('alert')).textContent).toMatch(/did not answer/)
    expect((screen.getByRole('button', { name: 'Sign in as the admin' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
