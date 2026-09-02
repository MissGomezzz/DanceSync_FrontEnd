import { create } from 'zustand'

export interface AuthUser {
  id: string
  displayName: string
  email: string
}

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  /** Placeholder: will delegate to Azure Entra ID (MSAL) once configured. */
  login: () => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  login: async () => {
    // Temporary local stub until Azure Entra ID integration is implemented.
    set({
      user: { id: 'local-user', displayName: 'Guest', email: '' },
      isAuthenticated: true,
    })
  },
  logout: () => set({ user: null, isAuthenticated: false }),
}))
