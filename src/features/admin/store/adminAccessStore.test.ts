import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError } from '../../../shared/api/httpClient'
import { useAdminAccessStore } from './adminAccessStore'

const api = vi.hoisted(() => ({ session: vi.fn() }))
vi.mock('../api/adminApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/adminApi')>()),
  adminApi: api,
}))

/** A session() call the test answers when it wants. */
function pendingSession() {
  let answer: (value: { admin: boolean }) => void = () => {}
  let fail: (error: unknown) => void = () => {}
  api.session.mockReturnValueOnce(
    new Promise<{ admin: boolean }>((resolve, reject) => {
      answer = resolve
      fail = reject
    }),
  )
  return { answer: (value: { admin: boolean }) => answer(value), fail: (error: unknown) => fail(error) }
}

beforeEach(() => {
  api.session.mockReset()
  useAdminAccessStore.getState().reset()
})

describe('adminAccessStore', () => {
  it('records what the backend answers', async () => {
    api.session.mockResolvedValueOnce({ admin: true })
    await useAdminAccessStore.getState().check()
    expect(useAdminAccessStore.getState().access).toBe('admin')

    api.session.mockRejectedValueOnce(new HttpError(403, 'Forbidden'))
    await useAdminAccessStore.getState().check()
    expect(useAdminAccessStore.getState().access).toBe('denied')

    api.session.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await useAdminAccessStore.getState().check()
    expect(useAdminAccessStore.getState().access).toBe('error')
  })

  it('shares one request between concurrent checks', async () => {
    const session = pendingSession()
    const first = useAdminAccessStore.getState().check()
    const second = useAdminAccessStore.getState().check()
    expect(useAdminAccessStore.getState().access).toBe('checking')

    session.answer({ admin: false })
    await Promise.all([first, second])
    expect(api.session).toHaveBeenCalledTimes(1)
    expect(useAdminAccessStore.getState().access).toBe('denied')
  })

  it('ignores the answer of a check started before a reset', async () => {
    const old = pendingSession()
    const stale = useAdminAccessStore.getState().check()

    useAdminAccessStore.getState().reset()
    old.answer({ admin: true })
    await stale

    expect(useAdminAccessStore.getState().access).toBe('unknown')
  })

  it('ignores the failure of a check started before a reset', async () => {
    const old = pendingSession()
    const stale = useAdminAccessStore.getState().check()

    useAdminAccessStore.getState().reset()
    old.fail(new TypeError('Failed to fetch'))
    await stale

    expect(useAdminAccessStore.getState().access).toBe('unknown')
  })

  it('asks again for the next account instead of reusing the old request', async () => {
    const old = pendingSession()
    const stale = useAdminAccessStore.getState().check()
    useAdminAccessStore.getState().reset()

    const next = pendingSession()
    const fresh = useAdminAccessStore.getState().check()
    expect(api.session).toHaveBeenCalledTimes(2)

    // The old answer arrives late and must not overwrite the new account's check.
    old.answer({ admin: true })
    await stale
    expect(useAdminAccessStore.getState().access).toBe('checking')

    next.answer({ admin: false })
    await fresh
    expect(useAdminAccessStore.getState().access).toBe('denied')
  })
})
