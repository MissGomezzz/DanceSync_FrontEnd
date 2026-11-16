import { env } from '../../../shared/lib/env'
import { connectSocket } from '../../../shared/lib/socket'
import type { Room } from '../../../shared/types'
import { usePeerStore } from '../store/peerStore'
import type { PeerConnectionStatus, WebRtcPeerReady, WebRtcReady, WebRtcSignal } from '../types'
import { buildIceServers, DEFAULT_ICE_SERVERS } from './iceServers'
import { createSignalingQueue } from './signalingQueue'

/**
 * Longest wait for the ICE candidates before a description is sent. Gathering
 * normally completes well within it; an unreachable STUN or TURN server would
 * otherwise hold the description back for many seconds.
 */
export const ICE_GATHERING_CAP_MS = 2000
/** Waits before each new attempt with a peer whose connection failed; `failed` is final after the last one. */
export const RETRY_DELAYS_MS = [1000, 3000, 6000]
/** A connection that has not connected by then (lost signaling, no route) counts as failed. */
export const CONNECT_TIMEOUT_MS = 15_000
/** A connection that stays `disconnected` this long (frozen video) counts as failed. */
export const DISCONNECTED_GRACE_MS = 5000
/** Time a new offer needs to reach the answerer: the offerer's ICE gathering and the delivery. */
export const OFFER_WAIT_MS = 4000

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
  /** Fires when the connection does not connect in time or stays disconnected. */
  watchdog: ReturnType<typeof setTimeout> | undefined
}

/** Attempts used to get a connection with a peer back; forgotten once it connects. */
interface Recovery {
  attempts: number
  timer: ReturnType<typeof setTimeout> | undefined
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
 *
 * Recovery: a connection that fails, does not connect in time or stays
 * disconnected is replaced, at most `RETRY_DELAYS_MS.length` times per peer and
 * with a growing wait. The offerer offers again. The answerer cannot offer, so
 * it announces itself again (`webrtc:ready`), which makes its offerers offer;
 * because that also renews its healthy connections, it first gives the offerer,
 * which normally saw the same failure, time to come back on its own. After the
 * socket reconnects the session announces itself and starts over.
 */
export function createPeerSession(options: PeerSessionOptions): PeerSession {
  const { roomCode, myId, isDancer, getRoom, localStream } = options
  const socket = connectSocket()
  const signaling = createSignalingQueue(socket)
  const iceServers = buildIceServers(env)
  const peers = new Map<string, PeerEntry>()
  const recoveries = new Map<string, Recovery>()
  let disposed = false
  /** The socket dropped: signaling sent or expected meanwhile is lost. */
  let wasOffline = false

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

  const setStatus = (otherId: string, status: PeerConnectionStatus | null) =>
    usePeerStore.getState().setConnectionState(otherId, status)

  // The server refuses the announcement until the socket (re)joined the room, so that refusal is retried.
  const ready: WebRtcReady = { roomCode, playerId: myId }
  const announce = () => {
    if (!signaling.has('webrtc:ready')) signaling.send('webrtc:ready', ready, { retryRejected: true })
  }

  const closePeer = (otherId: string) => {
    const entry = peers.get(otherId)
    if (entry) {
      peers.delete(otherId)
      clearTimeout(entry.watchdog)
      closeConnection(entry.pc)
    }
    usePeerStore.getState().setRemoteStream(otherId, null)
    setStatus(otherId, null)
  }

  /** A later failure with this peer starts again with every attempt. */
  const forgetRecovery = (otherId: string) => {
    clearTimeout(recoveries.get(otherId)?.timer)
    recoveries.delete(otherId)
  }

  /** One more attempt with a peer whose connection was given up for now. */
  const retry = (otherId: string, recovery: Recovery) => {
    recovery.timer = undefined
    if (!shouldConnect(otherId)) {
      forgetRecovery(otherId)
      setStatus(otherId, null)
    } else if (isOffererFor(otherId)) {
      void offer(otherId)
    } else {
      // Only the peer can offer: ask for it. No offer in time is one more failure.
      announce()
      recovery.timer = setTimeout(() => recover(otherId), OFFER_WAIT_MS)
    }
  }

  /**
   * Gives up the current connection with `otherId` and schedules the next
   * attempt, `headStartMs` later than usual; reports `failed` once they ran out.
   */
  function recover(otherId: string, headStartMs = 0) {
    closePeer(otherId)
    const recovery = recoveries.get(otherId) ?? { attempts: 0, timer: undefined }
    recoveries.set(otherId, recovery)
    clearTimeout(recovery.timer)
    recovery.timer = undefined
    if (recovery.attempts >= RETRY_DELAYS_MS.length) {
      setStatus(otherId, 'failed')
      return
    }
    const delay = RETRY_DELAYS_MS[recovery.attempts] + headStartMs
    recovery.attempts += 1
    setStatus(otherId, 'retrying')
    recovery.timer = setTimeout(() => retry(otherId, recovery), delay)
  }

  /** Treats the connection as failed unless it is connected again within `ms`. */
  const watch = (otherId: string, entry: PeerEntry, ms: number) => {
    clearTimeout(entry.watchdog)
    // The offerer of a pair normally sees the same failure and offers again by itself.
    entry.watchdog = setTimeout(() => recover(otherId, entry.isOfferer ? 0 : OFFER_WAIT_MS), ms)
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

  const createPeer = (otherId: string, negotiationId: string, isOfferer: boolean): PeerEntry => {
    closePeer(otherId)
    // A new connection supersedes the pending attempt, not the attempts already used.
    clearTimeout(recoveries.get(otherId)?.timer)
    const pc = openConnection()
    const entry: PeerEntry = {
      pc,
      negotiationId,
      isOfferer,
      remoteDescriptionSet: false,
      pendingCandidates: [],
      descriptionSent: false,
      watchdog: undefined,
    }
    peers.set(otherId, entry)
    setStatus(otherId, pc.connectionState)
    watch(otherId, entry, CONNECT_TIMEOUT_MS)

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
      const state = pc.connectionState
      setStatus(otherId, state)
      if (state === 'connected') {
        clearTimeout(entry.watchdog)
        forgetRecovery(otherId)
      } else if (state === 'failed') {
        recover(otherId, entry.isOfferer ? 0 : OFFER_WAIT_MS)
      } else if (state === 'disconnected') {
        // Usually a short network drop that heals by itself; a frozen video does not.
        watch(otherId, entry, DISCONNECTED_GRACE_MS)
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

  async function offer(otherId: string): Promise<void> {
    const entry = createPeer(otherId, crypto.randomUUID(), true)
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
    const entry = createPeer(otherId, signal.negotiationId, false)
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
    for (const otherId of new Set([...peers.keys(), ...recoveries.keys()])) {
      if (shouldConnect(otherId)) continue
      forgetRecovery(otherId)
      closePeer(otherId)
    }
    // Remote streams can outlive a connection only for players that left.
    const room = currentRoom()
    const present = new Set(room?.players.map((p) => p.id) ?? [])
    for (const playerId of Object.keys(usePeerStore.getState().remoteStreams)) {
      if (!present.has(playerId)) usePeerStore.getState().setRemoteStream(playerId, null)
    }
    for (const player of room?.players ?? []) {
      // A peer being retried or given up is not offered to on every room update
      // (battles send many): its attempts are spaced and bounded.
      if (!peers.has(player.id) && !recoveries.has(player.id) && isOffererFor(player.id)) void offer(player.id)
    }
  }

  const onSignal = (signal: WebRtcSignal) => void handleSignal(signal)

  const onPeerReady = ({ playerId }: WebRtcPeerReady) => {
    if (disposed || playerId === myId) return
    // The peer (re)started its session, or asks for a new offer: any previous
    // connection is dead on its side, and it gets every attempt again.
    if (!isOffererFor(playerId)) return
    forgetRecovery(playerId)
    void offer(playerId)
  }

  const onRoomUpdated = () => syncWithRoom()

  const onDisconnect = () => {
    wasOffline = true
  }

  /** Signaling is held while the socket is down; after a reconnection the session starts over. */
  const onConnect = () => {
    if (wasOffline) {
      wasOffline = false
      signaling.clear()
      for (const otherId of [...recoveries.keys()]) {
        forgetRecovery(otherId)
        if (!peers.has(otherId)) setStatus(otherId, null)
      }
      // Our offerers offer again; our own offers that were still in the air are sent again.
      announce()
      for (const [otherId, entry] of [...peers]) {
        if (entry.isOfferer && entry.pc.connectionState !== 'connected') void offer(otherId)
      }
      syncWithRoom()
    }
    signaling.resume()
  }

  socket.on('webrtc:signal', onSignal)
  socket.on('webrtc:peer-ready', onPeerReady)
  socket.on('room:updated', onRoomUpdated)
  socket.on('connect', onConnect)
  socket.on('disconnect', onDisconnect)

  announce()
  syncWithRoom()

  return {
    dispose: () => {
      if (disposed) return
      disposed = true
      socket.off('webrtc:signal', onSignal)
      socket.off('webrtc:peer-ready', onPeerReady)
      socket.off('room:updated', onRoomUpdated)
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      signaling.dispose()
      for (const entry of peers.values()) {
        clearTimeout(entry.watchdog)
        closeConnection(entry.pc)
      }
      peers.clear()
      for (const recovery of recoveries.values()) clearTimeout(recovery.timer)
      recoveries.clear()
      usePeerStore.getState().reset()
    },
  }
}
