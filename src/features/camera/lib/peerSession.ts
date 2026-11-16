import { env } from '../../../shared/lib/env'
import { connectSocket } from '../../../shared/lib/socket'
import type { Room } from '../../../shared/types'
import { usePeerStore } from '../store/peerStore'
import type { WebRtcPeerReady, WebRtcReady, WebRtcSignal } from '../types'
import { buildIceServers, DEFAULT_ICE_SERVERS } from './iceServers'
import { createSignalingQueue } from './signalingQueue'

/**
 * Longest wait for the ICE candidates before a description is sent. Gathering
 * normally completes well within it; an unreachable STUN or TURN server would
 * otherwise hold the description back for many seconds.
 */
export const ICE_GATHERING_CAP_MS = 2000

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
  /** The local description left with its candidates inside; later ones travel on their own. */
  descriptionSent: boolean
  /** True when this connection is already the single retry after a failure. */
  isRetry: boolean
}

/** Resolves once the ICE candidates are gathered, or after `ICE_GATHERING_CAP_MS`. */
function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve()
      return
    }
    const finish = () => {
      clearTimeout(cap)
      pc.onicegatheringstatechange = null
      resolve()
    }
    const cap = setTimeout(finish, ICE_GATHERING_CAP_MS)
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete') finish()
    }
  })
}

function closeConnection(pc: RTCPeerConnection) {
  pc.onicecandidate = null
  pc.onicegatheringstatechange = null
  pc.ontrack = null
  pc.onconnectionstatechange = null
  pc.close()
}

/**
 * Owns the WebRTC mesh for one battle: dancers publish their camera, everyone
 * receives. Socket.IO carries the signaling. Offerer rules for a pair:
 * dancer -> spectator: the dancer offers; dancer <-> dancer: the smaller player
 * id offers and the answerer attaches its own track, so one connection carries
 * video both ways; spectator <-> spectator: no connection.
 *
 * Signaling is kept small, because battle-service rate limits every socket and
 * drops what goes over: ICE candidates are not trickled. Each side waits for
 * the gathering to finish and sends one description with the candidates inside,
 * through a queue that paces the events and sends the dropped ones again.
 * Candidates trickled by a peer are still accepted.
 */
export function createPeerSession(options: PeerSessionOptions): PeerSession {
  const { roomCode, myId, isDancer, getRoom, localStream } = options
  const socket = connectSocket()
  const signaling = createSignalingQueue(socket)
  const iceServers = buildIceServers(env)
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
    signaling.send('webrtc:signal', signal)
  }

  const closePeer = (otherId: string) => {
    const entry = peers.get(otherId)
    if (entry) {
      peers.delete(otherId)
      closeConnection(entry.pc)
    }
    usePeerStore.getState().setRemoteStream(otherId, null)
    usePeerStore.getState().setConnectionState(otherId, null)
  }

  const attachLocalTracks = (pc: RTCPeerConnection) => {
    if (!isDancer || !localStream) return
    localStream.getVideoTracks().forEach((track) => pc.addTrack(track, localStream))
  }

  /** A TURN value the browser rejects must not take the camera down: fall back to STUN. */
  const openConnection = (): RTCPeerConnection => {
    try {
      return new RTCPeerConnection({ iceServers })
    } catch (error) {
      console.warn('The configured ICE servers were rejected; using the default STUN server', error)
      return new RTCPeerConnection({ iceServers: DEFAULT_ICE_SERVERS })
    }
  }

  const createPeer = (otherId: string, negotiationId: string, isOfferer: boolean, isRetry: boolean): PeerEntry => {
    closePeer(otherId)
    const pc = openConnection()
    const entry: PeerEntry = {
      pc,
      negotiationId,
      isOfferer,
      remoteDescriptionSet: false,
      pendingCandidates: [],
      descriptionSent: false,
      isRetry,
    }
    peers.set(otherId, entry)
    usePeerStore.getState().setConnectionState(otherId, pc.connectionState)

    pc.onicecandidate = (event) => {
      // Candidates gathered before the description is sent are already inside it.
      if (event.candidate && entry.descriptionSent && isCurrent(otherId, entry)) {
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

  /** Sends the local description once, with the ICE candidates gathered so far inside its SDP. */
  const sendLocalDescription = async (otherId: string, entry: PeerEntry) => {
    await waitForIceGathering(entry.pc)
    if (!isCurrent(otherId, entry) || !entry.pc.localDescription) return
    const { type, sdp } = entry.pc.localDescription
    entry.descriptionSent = true
    sendSignal(otherId, entry.negotiationId, { description: { type, sdp } })
  }

  async function offer(otherId: string, isRetry = false): Promise<void> {
    const entry = createPeer(otherId, crypto.randomUUID(), true, isRetry)
    attachLocalTracks(entry.pc)
    try {
      await entry.pc.setLocalDescription(await entry.pc.createOffer())
      await sendLocalDescription(otherId, entry)
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
      await sendLocalDescription(otherId, entry)
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

  /** Signaling is held while the socket is down. */
  const onConnect = () => signaling.resume()

  socket.on('webrtc:signal', onSignal)
  socket.on('webrtc:peer-ready', onPeerReady)
  socket.on('room:updated', onRoomUpdated)
  socket.on('connect', onConnect)

  // The server refuses the announcement until the socket (re)joined the room, so that refusal is retried.
  const ready: WebRtcReady = { roomCode, playerId: myId }
  signaling.send('webrtc:ready', ready, { retryRejected: true })
  syncWithRoom()

  return {
    dispose: () => {
      if (disposed) return
      disposed = true
      socket.off('webrtc:signal', onSignal)
      socket.off('webrtc:peer-ready', onPeerReady)
      socket.off('room:updated', onRoomUpdated)
      socket.off('connect', onConnect)
      signaling.dispose()
      for (const entry of peers.values()) closeConnection(entry.pc)
      peers.clear()
      usePeerStore.getState().reset()
    },
  }
}
