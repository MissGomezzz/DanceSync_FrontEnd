import { useEffect } from 'react'
import type { Player } from '../../../shared/types'
import { useAuthStore } from '../../auth/store/authStore'
import { useRoom, useRoomStore } from '../../rooms/store/roomStore'
import { createPeerSession } from '../lib/peerSession'
import { useCameraStatus, useCameraStore, useLocalStream } from '../store/cameraStore'
import { usePeerConnectionStates, useRemoteStreams } from '../store/peerStore'

export interface DancerVideo {
  dancer: Player
  isMe: boolean
  stream: MediaStream | null
  placeholder: string
}

export interface BattleVideo {
  /** One entry per dancer, in room order; empty until the battle starts. */
  dancerVideos: DancerVideo[]
  /** True when the local dancer must go through the camera permission prompt. */
  needsCameraPrompt: boolean
}

function remotePlaceholder(name: string, state: RTCPeerConnectionState | null, waitingForMyCamera: boolean): string {
  if (waitingForMyCamera) return `${name}'s camera will appear once yours is on.`
  if (state === 'failed') return `Could not connect to ${name}'s camera.`
  if (state === 'new' || state === 'connecting') return `Connecting to ${name}'s camera...`
  return `Waiting for ${name}'s camera...`
}

/**
 * Container hook for the battle stage video. Dancers open their camera and
 * publish it; spectators only receive. The WebRTC session runs while the room
 * is battling or finished and is torn down on unmount.
 */
export function useBattleVideo(roomCode: string): BattleVideo {
  const room = useRoom()
  const myId = useAuthStore((state) => state.identity?.id)
  const cameraStatus = useCameraStatus()
  const localStream = useLocalStream()

  const inRoom = room?.code === roomCode && myId !== undefined && room.players.some((p) => p.id === myId)
  const active = inRoom && (room.status === 'battling' || room.status === 'finished')
  const dancers = active ? room.dancers : null
  const isDancer = dancers?.some((d) => d.id === myId) ?? false

  // Dancers: check the permission (the explanation is shown before any browser
  // prompt) and release the camera when leaving the stage.
  useEffect(() => {
    if (!isDancer) return
    void useCameraStore.getState().checkPermission()
    return () => useCameraStore.getState().stopCamera()
  }, [isDancer])

  const publishedStream = isDancer ? localStream : null
  useEffect(() => {
    if (!active || !myId) return
    if (isDancer && !publishedStream) return
    const session = createPeerSession({
      roomCode,
      myId,
      isDancer,
      getRoom: () => useRoomStore.getState().room,
      localStream: publishedStream,
    })
    return () => session.dispose()
  }, [active, isDancer, myId, roomCode, publishedStream])

  // The server allows any number of dancers (at least two), and the peer session
  // already meshes every dancer pair, so there is one tile per dancer.
  const dancerList = dancers ?? []
  const dancerIds = dancerList.map((d) => d.id)
  const remoteStreams = useRemoteStreams(dancerIds)
  const connectionStates = usePeerConnectionStates(dancerIds)

  const waitingForMyCamera = isDancer && !publishedStream
  const toVideo = (dancer: Player, index: number): DancerVideo => {
    const isMe = dancer.id === myId
    return {
      dancer,
      isMe,
      stream: isMe ? publishedStream : remoteStreams[index],
      placeholder: isMe
        ? 'Starting your camera...'
        : remotePlaceholder(dancer.displayName, connectionStates[index], waitingForMyCamera),
    }
  }

  const dancerVideos = dancerList.map(toVideo)

  // Asking for the camera only makes sense while there is still dancing to do;
  // a finished battle keeps showing the streams but never prompts again.
  const battling = room?.status === 'battling'
  return {
    dancerVideos,
    needsCameraPrompt: battling && (waitingForMyCamera || (isDancer && cameraStatus !== 'granted')),
  }
}
