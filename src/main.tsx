import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './app/App'
import { useAuthStore } from './features/auth/store/authStore'

// The session is restored before the first render (a Microsoft sign-in that
// redirected back here, or this tab's guest token), so the route guards decide
// with the real session instead of flashing the login page.
void useAuthStore
  .getState()
  .initialize()
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
