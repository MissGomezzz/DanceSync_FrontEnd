import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from './authStore'

beforeEach(() => {
  sessionStorage.clear()
  useAuthStore.setState({ identity: null })
})

describe('login', () => {
  it('keeps the existing player id and only updates the display name', () => {
    useAuthStore.setState({ identity: { id: 'player-1', displayName: 'Guest-1234' } })
    const identity = useAuthStore.getState().login('  Beto  ')
    expect(identity).toEqual({ id: 'player-1', displayName: 'Beto' })
    expect(useAuthStore.getState().identity).toEqual(identity)
  })

  it('creates an identity when there is none yet', () => {
    const identity = useAuthStore.getState().login('Beto')
    expect(identity.displayName).toBe('Beto')
    expect(identity.id).toMatch(/.+/)
  })
})
