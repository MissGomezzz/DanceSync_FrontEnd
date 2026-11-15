import { createBrowserRouter, Navigate } from 'react-router'
import { AppLayout } from './layouts/AppLayout'
import { RequireRoomAccess, RequireUser } from '../features/auth/components/RouteGuards'
import { RequireAdmin } from '../features/admin/components/RequireAdmin'
import { AdminPage } from '../features/admin/pages/AdminPage'
import { BattlePage } from '../features/battle/pages/BattlePage'
import { RoomPage } from '../features/rooms/pages/RoomPage'
import { HomePage } from '../pages/HomePage'
import { LoginPage } from '../pages/LoginPage'
import { RouteErrorPage } from '../pages/RouteErrorPage'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/', element: <LoginPage /> },
      // Creating rooms is for users signed in with Microsoft Entra ID.
      {
        path: '/home',
        element: (
          <RequireUser>
            <HomePage />
          </RequireUser>
        ),
      },
      // A room is open to signed-in users and to the guests holding a token for it.
      {
        path: '/rooms/:roomCode',
        element: (
          <RequireRoomAccess>
            <RoomPage />
          </RequireRoomAccess>
        ),
      },
      {
        path: '/battle/:roomCode',
        element: (
          <RequireRoomAccess>
            <BattlePage />
          </RequireRoomAccess>
        ),
      },
      // SEG-2: the audit log and the alerts, for the single admin account.
      {
        path: '/admin',
        element: (
          <RequireAdmin>
            <AdminPage />
          </RequireAdmin>
        ),
      },
      { path: '*', element: <Navigate to="/home" replace /> },
    ],
  },
])
