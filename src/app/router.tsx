import { createBrowserRouter } from 'react-router'
import { AppLayout } from './layouts/AppLayout'
import { BattlePage } from '../features/battle/pages/BattlePage'
import { RoomPage } from '../features/rooms/pages/RoomPage'
import { HomePage } from '../pages/HomePage'
import { LoginPage } from '../pages/LoginPage'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <LoginPage /> },
      { path: '/home', element: <HomePage /> },
      { path: '/rooms/:roomCode', element: <RoomPage /> },
      { path: '/battle/:roomCode', element: <BattlePage /> },
    ],
  },
])