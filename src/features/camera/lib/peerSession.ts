import { connectSocket } from '../../../shared/lib/socket'
import type { Room } from '../../../shared/types'
import { usePeerStore } from '../store/peerStore'
import type { WebRtcPeerReady, WebRtcReady, WebRtcSignal } from '../types'

/** STUN only for the MVP: peers behind symmetric NATs need a TURN relay to connect. */
const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }]

export interface PeerSessionOptions {
  roomCode: string
  myId: string
  isDancer: boolean
  /** Current room snapshot; read lazily so decisions always use the latest state. */
  getRoom: () => Room | null
  /** Local camera; required for dancers, null for spectators. */
  localStream: MediaStream | null
}

export interface PeerSession {
  dispose: () => void
}

interface PeerEntry {
  pc: RTCPeerConnection
  negotiationId: string
  isOfferer: boolean
  remoteDescriptionSet: boolean
  /** ICE candidates received before the remote description was applied. */
  pendingCandidates: RTCIceCandidateInit[]
  /** True when this connection is already the single retry after a failure. */
  isRetry: boolean
}

/** Swallows server rejections (for example a target whose socket is reconnecting). */
const ignoreAck = () => {}

/**
 * Owns the WebRTC mesh for one battle: dancers publish their camera, everyone
 * receives. Socket.IO carries the signaling. Offerer rules for a pair:
 * dancer -> spectator: the dancer offers; dancer <-> dancer: the smaller player
 * id offers and the answerer attaches its own track, so one connection carries
 * video both ways; spectator <-> spectator: no connection.
 */
export function createPeerSession(options: PeerSessionOptions): PeerSession {
  const { roomCode, myId, isDancer, getRoom, localStream } = options
  const socket = connectSocket()
  const peers = new Map<string, PeerEntry>()
  let disposed = false

  const currentRoom = (): Room | null => {
    const room = getRoom()
    return room?.code === roomCode ? room : null
  }

  const isDancerId = (room: Room, playerId: string) => room.dancers?.some((d) => d.id === playerId) ?? false

  /** Whether a connection with `otherId` belongs in the mesh at all. */
  const shouldConnect = (otherId: string): boolean => {
    const room = currentRoom()
    if (!room || otherId === myId || !room.players.some((p) => p.id === otherId)) return false
    return isDancer || isDancerId(room, otherId)
  }

  const isOffererFor = (otherId: string): boolean => {
    if (!isDancer || !shouldConnect(otherId)) return false
    const room = currentRoom()
    if (!room) return false
    return isDancerId(room, otherId) ? myId < otherId : true
  }

  const isCurrent = (otherId: string, entry: PeerEntry) => !disposed && peers.get(otherId) === entry

  const sendSignal = (to: string, negotiationId: string, body: Pick<WebRtcSignal, 'description' | 'candidate'>) => {
    const signal: WebRtcSignal = { roomCode, from: myId, to, negotiationId, ...body }
    socket.emit('webrtc:signal', signal, ignoreAck)
  }

  const closePeer = (otherId: string) => {
    const entry = peers.get(otherId)
    if (entry) {
      peers.delete(otherId)
      entry.pc.onicecandidate = null
      entry.pc.ontrack = null
      entry.pc.onconnectionstatechange = null
      entry.pc.close()
    }
    usePeerStore.getState().setRemoteStream(otherId, null)
    usePeerStore.getState().setConnectionState(otherId, null)
  }

  const attachLocalTracks = (pc: RTCPeerConnection) => {
    if (!isDancer || !localStream) return
    localStream.getVideoTracks().forEach((track) => pc.addTrack(track, localStream))
  }

  const createPeer = (otherId: string, negotiationId: string, isOfferer: boolean, isRetry: boolean): PeerEntry => {
    closePeer(otherId)
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    const entry: PeerEntry = {
      pc,
      negotiationId,
      isOfferer,
      remoteDescriptionSet: false,
      pendingCandidates: [],
      isRetry,
    }
    peers.set(otherId, entry)
    usePeerStore.getState().setConnectionState(otherId, pc.connectionState)

    pc.onicecandidate = (event) => {
      if (event.candidate && isCurrent(otherId, entry)) {
        sendSignal(otherId, negotiationId, { candidate: event.candidate.toJSON() })
      }
    }
    pc.ontrack = (event) => {
      if (!isCurrent(otherId, entry)) return
      const stream = event.streams[0] ?? new MediaStream([event.track])
      usePeerStore.getState().setRemoteStream(otherId, stream)
    }
    pc.onconnectionstatechange = () => {
      if (!isCurrent(otherId, entry)) return
      usePeerStore.getState().setConnectionState(otherId, pc.connectionState)
      if (pc.connectionState === 'failed') {
        closePeer(otherId)
        if (entry.isOfferer && !entry.isRetry && isOffererFor(otherId)) void offer(otherId, true)
        else usePeerStore.getState().setConnectionState(otherId, 'failed')
      }
    }
    return entry
  }

  const applyRemoteDescription = async (otherId: string, entry: PeerEntry, description: RTCSessionDescriptionInit) => {
    await entry.pc.setRemoteDescription(description)
    if (!isCurrent(otherId, entry)) return false
    entry.remoteDescriptionSet = true
    const queued = entry.pendingCandidates.splice(0)
    for (const candidate of queued) {
      await entry.pc.addIceCandidate(candidate).catch(() => {})
    }
    return isCurrent(otherId, entry)
  }

  async function offer(otherId: string, isRetry = false): Promise<void> {
    const entry = createPeer(otherId, crypto.randomUUID(), true, isRetry)
    attachLocalTracks(entry.pc)
    try {
      await entry.pc.setLocalDescription(await entry.pc.createOffer())
      if (!isCurrent(otherId, entry) || !entry.pc.localDescription) return
      const { type, sdp } = entry.pc.localDescription
      sendSignal(otherId, entry.negotiationId, { description: { type, sdp } })
    } catch (error) {
      if (isCurrent(otherId, entry)) console.warn('WebRTC offer failed', error)
    }
  }

  const answer = async (signal: WebRtcSignal, description: RTCSessionDescriptionInit) => {
    const otherId = signal.from
    const entry = createPeer(otherId, signal.negotiationId, false, false)
    try {
      if (!(await applyRemoteDescription(otherId, entry, description))) return
      // Tracks are attached after the remote offer so addTrack reuses the offered
      // video transceiver (making it sendrecv). Adding them earlier would create a
      // second transceiver that an answer cannot negotiate.
      attachLocalTracks(entry.pc)
      await entry.pc.setLocalDescription(await entry.pc.createAnswer())
      if (!isCurrent(otherId, entry) || !entry.pc.localDescription) return
      const { type, sdp } = entry.pc.localDescription
      sendSignal(otherId, entry.negotiationId, { description: { type, sdp } })
    } catch (error) {
      if (isCurrent(otherId, entry)) console.warn('WebRTC answer failed', error)
    }
  }

  const handleSignal = async (signal: WebRtcSignal) => {
    if (disposed || signal.to !== myId || signal.roomCode !== roomCode) return
    const otherId = signal.from
    const { description, candidate } = signal

    if (description?.type === 'offer') {
      // Only the designated offerer of a pair may open a connection with us.
      if (!shouldConnect(otherId) || isOffererFor(otherId)) return
      await answer(signal, description)
      return
    }

    const entry = peers.get(otherId)
    // Messages from a replaced connection carry an old negotiation id: drop them.
    if (!entry || entry.negotiationId !== signal.negotiationId) return

    try {
      if (description?.type === 'answer') {
        if (!entry.isOfferer || entry.pc.signalingState !== 'have-local-offer') return
        await applyRemoteDescription(otherId, entry, description)
      } else if (candidate) {
        if (entry.remoteDescriptionSet) await entry.pc.addIceCandidate(candidate)
        else entry.pendingCandidates.push(candidate)
      }
    } catch (error) {
      if (isCurrent(otherId, entry)) console.warn('WebRTC signal could not be applied', error)
    }
  }

  /** Aligns connections with the room: drop departed players, offer to new ones. */
  const syncWithRoom = () => {
    if (disposed) return
    for (const otherId of [...peers.keys()]) {
      if (!shouldConnect(otherId)) closePeer(otherId)
    }
    // Remote streams can outlive a connection only for players that left.
    const room = currentRoom()
    const present = new Set(room?.players.map((p) => p.id) ?? [])
    for (const playerId of Object.keys(usePeerStore.getState().remoteStreams)) {
      if (!present.has(playerId)) usePeerStore.getState().setRemoteStream(playerId, null)
    }
    for (const player of room?.players ?? []) {
      if (!peers.has(player.id) && isOffererFor(player.id)) void offer(player.id)
    }
  }

  const onSignal = (signal: WebRtcSignal) => void handleSignal(signal)

  const onPeerReady = ({ playerId }: WebRtcPeerReady) => {
    if (disposed || playerId === myId) return
    // The peer (re)started its session: any previous connection is dead on its side.
    if (isOffererFor(playerId)) void offer(playerId)
  }

  const onRoomUpdated = () => syncWithRoom()

  socket.on('webrtc:signal', onSignal)
  socket.on('webrtc:peer-ready', onPeerReady)
  socket.on('room:updated', onRoomUpdated)

  const ready: WebRtcReady = { roomCode, playerId: myId }
  socket.emit('webrtc:ready', ready, ignoreAck)
  syncWithRoom()

  return {
    dispose: () => {
      if (disposed) return
      disposed = true
      socket.off('webrtc:signal', onSignal)
      socket.off('webrtc:peer-ready', onPeerReady)
      socket.off('room:updated', onRoomUpdated)
      for (const entry of peers.values()) {
        entry.pc.onicecandidate = null
        entry.pc.ontrack = null
        entry.pc.onconnectionstatechange = null
        entry.pc.close()
      }
      peers.clear()
      usePeerStore.getState().reset()
    },
  }
}
