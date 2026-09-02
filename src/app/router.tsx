import { createBrowserRouter } from 'react-router'
import { BattlePage } from '../features/battle/pages/BattlePage'
import { RoomPage } from '../features/rooms/pages/RoomPage'
import { HomePage } from '../pages/HomePage'

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/rooms/:roomId', element: <RoomPage /> },
  { path: '/battle/:roomId', element: <BattlePage /> },
])
