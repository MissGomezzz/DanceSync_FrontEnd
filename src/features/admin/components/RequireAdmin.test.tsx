import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError } from '../../../shared/api/httpClient'
import { useAuthStore } from '../../auth/store/authStore'
import { useAdminAccessStore } from '../store/adminAccessStore'
import { RequireAdmin } from './RequireAdmin'

const api = vi.hoisted(() => ({ session: vi.fn() }))
vi.mock('../api/adminApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/adminApi')>()),
  adminApi: api,
}))

function renderGuarded() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/" element={<p>login page</p>} />
        <Route path="/home" element={<p>home page</p>} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <p>admin console</p>
            </RequireAdmin>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  api.session.mockReset()
  useAdminAccessStore.setState({ access: 'unknown' })
})

describe('RequireAdmin', () => {
  it('sends anyone who is not signed in to the login page', () => {
    useAuthStore.setState({ identity: null, session: null })
    renderGuarded()
    expect(screen.getByText('login page')).toBeTruthy()
    expect(api.session).not.toHaveBeenCalled()
  })

  it('sends a guest to the login page without asking the backend', () => {
    useAuthStore.setState({ identity: { id: 'g', displayName: 'G' }, session: { kind: 'guest', roomCode: 'A', expiresAt: '2099-01-01T00:00:00Z' } })
    renderGuarded()
    expect(screen.getByText('login page')).toBeTruthy()
  })

  it('opens the console when the backend confirms the admin', async () => {
    useAuthStore.setState({ identity: { id: 'oid-admin', displayName: 'Admin' }, session: { kind: 'user' } })
    api.session.mockResolvedValue({ admin: true })
    renderGuarded()
    expect(screen.getByText('Checking admin access…')).toBeTruthy()
    expect(await screen.findByText('admin console')).toBeTruthy()
  })

  it('sends any other signed-in user back home when the backend answers 403', async () => {
    useAuthStore.setState({ identity: { id: 'oid-ana', displayName: 'Ana' }, session: { kind: 'user' } })
    api.session.mockRejectedValue(new HttpError(403, 'Forbidden'))
    renderGuarded()
    expect(await screen.findByText('home page')).toBeTruthy()
  })

  describe('when the backend cannot be reached', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      useAuthStore.setState({ identity: { id: 'oid-admin', displayName: 'Admin' }, session: { kind: 'user' } })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    /** Lets pending promises settle and moves the clock forward by `ms`. */
    const advance = (ms: number) =>
      act(async () => {
        await vi.advanceTimersByTimeAsync(ms)
      })

    it('keeps waiting and retries after a delay, never at once', async () => {
      api.session.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue({ admin: true })
      renderGuarded()
      await advance(0)

      expect(screen.getByText('Could not reach the server. Retrying…')).toBeTruthy()
      expect(api.session).toHaveBeenCalledTimes(1)
      await advance(1_999)
      expect(api.session).toHaveBeenCalledTimes(1)

      await advance(1)
      expect(api.session).toHaveBeenCalledTimes(2)
      expect(screen.getByText('admin console')).toBeTruthy()
    })

    it('doubles the delay after each failure, up to 30 s', async () => {
      api.session.mockRejectedValue(new TypeError('Failed to fetch'))
      renderGuarded()
      await advance(0)

      // Retries at 2, 4, 8, 16, 30 and again 30 seconds after each failure.
      const expectedCalls: Array<[number, number]> = [
        [2_000, 2],
        [4_000, 3],
        [8_000, 4],
        [16_000, 5],
        [30_000, 6],
        [30_000, 7],
      ]
      for (const [delay, calls] of expectedCalls) {
        await advance(delay - 1)
        expect(api.session).toHaveBeenCalledTimes(calls - 1)
        await advance(1)
        expect(api.session).toHaveBeenCalledTimes(calls)
      }
    })

    it('stops retrying once the guard is gone', async () => {
      api.session.mockRejectedValue(new TypeError('Failed to fetch'))
      const { unmount } = renderGuarded()
      await advance(0)
      unmount()

      await advance(60_000)
      expect(api.session).toHaveBeenCalledTimes(1)
    })
  })
})
