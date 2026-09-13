import { createBrowserRouter } from 'react-router'
import { BattlePage } from '../features/battle/pages/BattlePage'
import { RoomPage } from '../features/rooms/pages/RoomPage'
import { HomePage } from '../pages/HomePage'

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/rooms/:roomCode', element: <RoomPage /> },
  { path: '/battle/:roomCode', element: <BattlePage /> },
])
