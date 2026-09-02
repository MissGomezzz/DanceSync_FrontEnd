import { io, type Socket } from 'socket.io-client'
import { env } from './env'

/**
 * Singleton Socket.IO client shared by all real-time features.
 * The connection is not opened automatically; call `socket.connect()`
 * once the user has joined a room.
 */
export const socket: Socket = io(env.wsUrl, {
  path: '/socket.io',
  autoConnect: false,
  transports: ['websocket'],
})
