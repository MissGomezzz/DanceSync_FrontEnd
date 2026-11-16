import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Player, Room } from '../../../shared/types'
import { usePeerStore } from '../store/peerStore'
import type { WebRtcSignal } from '../types'
import { createPeerSession, ICE_GATHERING_CAP_MS, type PeerSession } from './peerSession'
import {
  MAX_RATE_LIMIT_RETRIES,
  MAX_REJECTED_RETRIES,
  RATE_LIMIT_MIN_DELAY_MS,
  REJECTED_RETRY_DELAY_MS,
  SIGNAL_ACK_TIMEOUT_MS,
  SIGNAL_GAP_MS,
} from './signalingQueue'

type Handler = (payload: unknown) => void
type Ack = (response: unknown) => void

const ACCEPTED = { ok: true, data: null }
const RATE_LIMITED = { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many events' } }
const NOT_IN_ROOM = { ok: false, error: { code: 'PLAYER_NOT_IN_ROOM', message: 'Not in this room' } }

const { fakeSocket } = vi.hoisted(() => {
  const handlers = new Map<string, Set<(payload: unknown) => void>>()
  const socket = {
    handlers,
    connected: true,
    /** The server's acknowledgement of an event; undefined leaves it unanswered. */
    respond: (_event: string, _payload: unknown): unknown => ({ ok: true, data: null }),
    on: vi.fn((event: string, handler: (payload: unknown) => void) => {
      if (!handlers.has(event)) handlers.set(event, new Set())
      handlers.get(event)?.add(handler)
    }),
    off: vi.fn((event: string, handler: (payload: unknown) => void) => {
      handlers.get(event)?.delete(handler)
    }),
    emit: vi.fn((event: string, payload: unknown, ack?: (response: unknown) => void) => {
      const response = socket.respond(event, payload)
      if (response !== undefined) ack?.(response)
    }),
  }
  return { fakeSocket: socket }
})

vi.mock('../../../shared/lib/socket', () => ({ connectSocket: () => fakeSocket }))

const { fakeEnv } = vi.hoisted(() => ({ fakeEnv: { turnUrls: '', turnUsername: '', turnCredential: '' } }))

vi.mock('../../../shared/lib/env', () => ({ env: fakeEnv }))

/** Minimal stand-in for RTCPeerConnection: records calls and lets tests drive its events. */
class FakePeerConnection {
  static instances: FakePeerConnection[] = []
  /** When true, ICE gathering stays open until the test completes it. */
  static slowGathering = false

  connectionState: RTCPeerConnectionState = 'new'
  signalingState: RTCSignalingState = 'stable'
  iceGatheringState: RTCIceGatheringState = 'new'
  localDescription: RTCSessionDescriptionInit | null = null
  remoteDescription: RTCSessionDescriptionInit | null = null
  onicecandidate: ((event: { candidate: { toJSON: () => RTCIceCandidateInit } | null }) => void) | null = null
  onicegatheringstatechange: (() => void) | null = null
  ontrack: ((event: { streams: MediaStream[]; track: MediaStreamTrack }) => void) | null = null
  onconnectionstatechange: (() => void) | null = null
  readonly config: RTCConfiguration

  addTrack = vi.fn()
  close = vi.fn()
  addIceCandidate = vi.fn(async (_candidate: RTCIceCandidateInit) => {})
  createOffer = vi.fn(async (): Promise<RTCSessionDescriptionInit> => ({ type: 'offer', sdp: 'offer-sdp' }))
  createAnswer = vi.fn(async (): Promise<RTCSessionDescriptionInit> => ({ type: 'answer', sdp: 'answer-sdp' }))
  setLocalDescription = vi.fn(async (description: RTCSessionDescriptionInit) => {
    this.localDescription = description
    if (description.type === 'offer') this.signalingState = 'have-local-offer'
    else this.signalingState = 'stable'
    this.iceGatheringState = FakePeerConnection.slowGathering ? 'gathering' : 'complete'
  })
  setRemoteDescription = vi.fn(async (description: RTCSessionDescriptionInit) => {
    this.remoteDescription = description
    this.signalingState = description.type === 'offer' ? 'have-remote-offer' : 'stable'
  })

  constructor(config: RTCConfiguration) {
    this.config = config
    FakePeerConnection.instances.push(this)
  }

  /** A gathered candidate: the browser adds it to the local description and reports it. */
  gatherCandidate(candidate: string) {
    if (this.localDescription) {
      this.localDescription = { ...this.localDescription, sdp: `${this.localDescription.sdp}+${candidate}` }
    }
    this.onicecandidate?.({ candidate: { toJSON: () => ({ candidate }) } })
  }

  completeGathering() {
    this.iceGatheringState = 'complete'
    this.onicegatheringstatechange?.()
    this.onicecandidate?.({ candidate: null })
  }

  failConnection() {
    this.connectionState = 'failed'
    this.onconnectionstatechange?.()
  }
}

class FakeMediaStream {
  readonly tracks: MediaStreamTrack[]
  constructor(tracks: MediaStreamTrack[] = []) {
    this.tracks = tracks
  }
  getVideoTracks() {
    return this.tracks
  }
}

const NOW = '2026-01-01T00:00:00.000Z'
const player = (id: string, role: Player['role']): Player => ({ id, displayName: id.toUpperCase(), role })

/** Battle with dancers a and b and the spectators fan and fan2. */
function battleRoom(playerIds = ['a', 'b', 'fan', 'fan2']): Room {
  const dancers = playerIds.filter((id) => !id.startsWith('fan')).map((id) => player(id, 'dancer'))
  const spectators = playerIds.filter((id) => id.startsWith('fan')).map((id) => player(id, 'spectator'))
  return {
    code: 'ROOM01',
    hostId: 'a',
    players: [...dancers, ...spectators],
    dancers,
    spectators,
    status: 'battling',
    battle: {
      id: 'battle',
      roomCode: 'ROOM01',
      dancerIds: dancers.map((d) => d.id),
      song: null,
      startedAt: NOW,
      finishedAt: null,
      result: null,
    },
    songSelection: null,
    selectedSong: null,
    createdAt: NOW,
  }
}

/** Lets pending promises settle and the signaling queue drain (timers are faked). */
const flush = (ms = 500) => vi.advanceTimersByTimeAsync(ms)

function fire(event: string, payload?: unknown) {
  for (const handler of fakeSocket.handlers.get(event) ?? []) (handler as Handler)(payload)
}

/** Signals this client sent through webrtc:signal. */
function sentSignals(): WebRtcSignal[] {
  return fakeSocket.emit.mock.calls.filter(([event]) => event === 'webrtc:signal').map(([, signal]) => signal as WebRtcSignal)
}

/** Events this client sent, by name and in order. */
const sentEvents = () => fakeSocket.emit.mock.calls.map(([event]) => event)

const track = { kind: 'video' } as MediaStreamTrack

let room: Room | null
let session: PeerSession | null
let warn: ReturnType<typeof vi.spyOn>

function start(myId: string, isDancer: boolean, localStream: MediaStream | null = null) {
  session = createPeerSession({ roomCode: 'ROOM01', myId, isDancer, getRoom: () => room, localStream })
  return session
}

function pcsFor() {
  return FakePeerConnection.instances
}

beforeEach(() => {
  vi.useFakeTimers()
  FakePeerConnection.instances = []
  FakePeerConnection.slowGathering = false
  fakeSocket.handlers.clear()
  fakeSocket.connected = true
  fakeSocket.respond = () => ACCEPTED
  fakeSocket.on.mockClear()
  fakeSocket.off.mockClear()
  fakeSocket.emit.mockClear()
  Object.assign(fakeEnv, { turnUrls: '', turnUsername: '', turnCredential: '' })
  usePeerStore.getState().reset()
  vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
  vi.stubGlobal('MediaStream', FakeMediaStream)
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  room = battleRoom()
  session = null
})

afterEach(() => {
  session?.dispose()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  warn.mockRestore()
})

describe('createPeerSession: start-up', () => {
  it('announces itself and offers to every peer it is the designated offerer for', async () => {
    const localStream = new FakeMediaStream([track]) as unknown as MediaStream
    start('a', true, localStream)
    await flush()

    expect(fakeSocket.emit).toHaveBeenCalledWith('webrtc:ready', { roomCode: 'ROOM01', playerId: 'a' }, expect.any(Function))
    // Dancer a offers to dancer b (smaller id) and to both spectators.
    const offers = sentSignals()
    expect(offers.map((s) => s.to).sort()).toEqual(['b', 'fan', 'fan2'])
    for (const signal of offers) {
      expect(signal).toMatchObject({ roomCode: 'ROOM01', from: 'a', description: { type: 'offer', sdp: 'offer-sdp' } })
      expect(signal.negotiationId).toEqual(expect.any(String))
    }
    // The camera is published on each connection and STUN is configured.
    for (const pc of pcsFor()) {
      expect(pc.addTrack).toHaveBeenCalledWith(track, localStream)
      expect(pc.config.iceServers?.[0].urls).toContain('stun:')
    }
    expect(usePeerStore.getState().connectionStates).toEqual({ b: 'new', fan: 'new', fan2: 'new' })
  })

  it('leaves the offer to the dancer with the smaller id', async () => {
    start('b', true, new FakeMediaStream([track]) as unknown as MediaStream)
    await flush()
    expect(sentSignals().map((s) => s.to).sort()).toEqual(['fan', 'fan2'])
  })

  it('never offers as a spectator', async () => {
    start('fan', false)
    await flush()
    expect(sentSignals()).toEqual([])
    expect(pcsFor()).toHaveLength(0)
  })

  it('ignores a room snapshot of another room', async () => {
    room = { ...battleRoom(), code: 'OTHER1' }
    start('a', true)
    await flush()
    expect(pcsFor()).toHaveLength(0)
  })

  it('does not publish tracks without a local stream', async () => {
    start('a', true, null)
    await flush()
    expect(pcsFor()[0].addTrack).not.toHaveBeenCalled()
  })

  it('warns when an offer cannot be created and sends nothing', async () => {
    room = battleRoom(['a', 'fan'])
    const createOffer = vi.fn(async () => {
      throw new Error('boom')
    })
    class FailingPc extends FakePeerConnection {
      createOffer = createOffer
    }
    vi.stubGlobal('RTCPeerConnection', FailingPc)
    start('a', true)
    await flush()
    expect(createOffer).toHaveBeenCalled()
    expect(sentSignals()).toEqual([])
    expect(warn).toHaveBeenCalledWith('WebRTC offer failed', expect.any(Error))
  })
})

describe('createPeerSession: ICE servers', () => {
  const stun = { urls: 'stun:stun.l.google.com:19302' }
  const turn = { turnUrls: 'turn:relay.example.com:3478', turnUsername: 'dancer', turnCredential: 'secret' }

  beforeEach(() => {
    room = battleRoom(['a', 'fan'])
  })

  it('uses only the default STUN server when no TURN relay is configured', async () => {
    start('a', true)
    await flush()
    expect(pcsFor()[0].config.iceServers).toEqual([stun])
  })

  it('adds the TURN relay configured through the environment', async () => {
    Object.assign(fakeEnv, turn)
    start('a', true)
    await flush()
    expect(pcsFor()[0].config.iceServers).toEqual([
      stun,
      { urls: ['turn:relay.example.com:3478'], username: 'dancer', credential: 'secret' },
    ])
  })

  it('falls back to STUN when the browser rejects the configured servers', async () => {
    Object.assign(fakeEnv, turn)
    class PickyPc extends FakePeerConnection {
      constructor(config: RTCConfiguration) {
        if ((config.iceServers?.length ?? 0) > 1) throw new SyntaxError('bad ICE server')
        super(config)
      }
    }
    vi.stubGlobal('RTCPeerConnection', PickyPc)
    start('a', true)
    await flush()
    expect(pcsFor()[0].config.iceServers).toEqual([stun])
    expect(sentSignals()).toHaveLength(1)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ICE servers were rejected'), expect.any(SyntaxError))
  })
})

describe('createPeerSession: signaling volume', () => {
  it('sends one description per peer, candidates inside, and no event per candidate', async () => {
    FakePeerConnection.slowGathering = true
    start('a', true)
    await flush()
    // Nothing leaves while the candidates are being gathered.
    expect(sentSignals()).toEqual([])

    for (const pc of pcsFor()) {
      for (let i = 0; i < 10; i += 1) pc.gatherCandidate(`cand-${i}`)
      pc.completeGathering()
    }
    await flush()

    const signals = sentSignals()
    expect(signals.map((s) => s.to).sort()).toEqual(['b', 'fan', 'fan2'])
    for (const signal of signals) {
      expect(signal.candidate).toBeUndefined()
      expect(signal.description?.sdp).toContain('offer-sdp+cand-0')
      expect(signal.description?.sdp).toContain('+cand-9')
    }
    // The announcement and one offer per peer: 4 events instead of 34.
    expect(sentEvents()).toEqual(['webrtc:ready', 'webrtc:signal', 'webrtc:signal', 'webrtc:signal'])
  })

  it('answers with a single description too', async () => {
    FakePeerConnection.slowGathering = true
    start('fan', false)
    fire('webrtc:signal', {
      roomCode: 'ROOM01',
      from: 'a',
      to: 'fan',
      negotiationId: 'neg-1',
      description: { type: 'offer', sdp: 'remote-offer' },
    })
    await flush()
    const [pc] = pcsFor()
    pc.gatherCandidate('cand-0')
    pc.gatherCandidate('cand-1')
    expect(sentSignals()).toEqual([])

    pc.completeGathering()
    await flush()
    expect(sentSignals()).toEqual([
      {
        roomCode: 'ROOM01',
        from: 'fan',
        to: 'a',
        negotiationId: 'neg-1',
        description: { type: 'answer', sdp: 'answer-sdp+cand-0+cand-1' },
      },
    ])
  })

  it('stops waiting for candidates after the cap and sends what it has', async () => {
    room = battleRoom(['a', 'fan'])
    FakePeerConnection.slowGathering = true
    start('a', true)
    await flush(0)
    const [pc] = pcsFor()
    pc.gatherCandidate('cand-0')
    // A state change that is not the end of the gathering changes nothing.
    pc.onicegatheringstatechange?.()

    await flush(ICE_GATHERING_CAP_MS - 1)
    expect(sentSignals()).toEqual([])
    await flush(1)
    expect(sentSignals().map((s) => s.description?.sdp)).toEqual(['offer-sdp+cand-0'])
  })

  it('sends a candidate found after the description on its own', async () => {
    room = battleRoom(['a', 'fan'])
    FakePeerConnection.slowGathering = true
    start('a', true)
    await flush(ICE_GATHERING_CAP_MS)
    const [pc] = pcsFor()
    const [offer] = sentSignals()

    pc.gatherCandidate('late')
    pc.completeGathering()
    await flush()
    expect(sentSignals().slice(1)).toEqual([
      { roomCode: 'ROOM01', from: 'a', to: 'fan', negotiationId: offer.negotiationId, candidate: { candidate: 'late' } },
    ])
  })

  it('spaces the events instead of sending them at once', async () => {
    start('a', true)
    await flush(0)
    expect(sentEvents()).toEqual(['webrtc:ready'])
    await flush(SIGNAL_GAP_MS - 1)
    expect(sentEvents()).toHaveLength(1)
    await flush(1)
    expect(sentEvents()).toHaveLength(2)
    await flush(SIGNAL_GAP_MS)
    expect(sentEvents()).toHaveLength(3)
    await flush(SIGNAL_GAP_MS)
    expect(sentEvents()).toHaveLength(4)
  })
})

describe('createPeerSession: signaling delivery', () => {
  beforeEach(() => {
    room = battleRoom(['a', 'fan'])
  })

  /** Refuses the first `times` signals with `response`, then accepts. */
  function refuseSignals(times: number, response: unknown) {
    let left = times
    fakeSocket.respond = (event) => {
      if (event !== 'webrtc:signal' || left <= 0) return ACCEPTED
      left -= 1
      return response
    }
  }

  it('sends a rate-limited description again after the retryAfterMs of the notice', async () => {
    refuseSignals(1, RATE_LIMITED)
    start('a', true)
    await flush(SIGNAL_GAP_MS)
    expect(sentSignals()).toHaveLength(1)

    // The server acknowledges the dropped event first and then tells when to come back.
    fire('rate:limited', { code: 'RATE_LIMITED', dropped: 1, retryAfterMs: 700 })
    await flush(699)
    expect(sentSignals()).toHaveLength(1)
    await flush(1)
    expect(sentSignals()).toHaveLength(2)
    expect(sentSignals()[1]).toEqual(sentSignals()[0])

    // Delivered: it is not sent a third time.
    await flush(5000)
    expect(sentSignals()).toHaveLength(2)
  })

  it('remembers the retryAfterMs of an earlier notice', async () => {
    refuseSignals(1, RATE_LIMITED)
    start('a', true)
    fire('rate:limited', { code: 'RATE_LIMITED', dropped: 3, retryAfterMs: 400 })
    await flush(SIGNAL_GAP_MS)
    expect(sentSignals()).toHaveLength(1)
    await flush(399)
    expect(sentSignals()).toHaveLength(1)
    await flush(1)
    expect(sentSignals()).toHaveLength(2)
  })

  it('waits longer on every refusal when the server gives no usable delay', async () => {
    refuseSignals(2, RATE_LIMITED)
    start('a', true)
    fire('rate:limited')
    fire('rate:limited', { retryAfterMs: -5 })
    fire('rate:limited', { retryAfterMs: 'soon' })
    await flush(SIGNAL_GAP_MS)
    expect(sentSignals()).toHaveLength(1)

    await flush(RATE_LIMIT_MIN_DELAY_MS)
    expect(sentSignals()).toHaveLength(2)
    await flush(RATE_LIMIT_MIN_DELAY_MS * 2 - 1)
    expect(sentSignals()).toHaveLength(2)
    await flush(1)
    expect(sentSignals()).toHaveLength(3)
  })

  it('gives up a description that keeps being rate limited, without flooding', async () => {
    refuseSignals(Number.POSITIVE_INFINITY, RATE_LIMITED)
    start('a', true)
    await flush(60_000)
    expect(sentSignals()).toHaveLength(1 + MAX_RATE_LIMIT_RETRIES)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('kept being rate limited'))
  })

  it('does not resend a signal refused for another reason', async () => {
    refuseSignals(1, NOT_IN_ROOM)
    start('a', true)
    await flush(60_000)
    expect(sentSignals()).toHaveLength(1)
  })

  it('announces again while the server refuses it, up to a limit', async () => {
    fakeSocket.respond = (event) => (event === 'webrtc:ready' ? NOT_IN_ROOM : ACCEPTED)
    start('a', true)
    await flush(0)
    expect(sentEvents()).toEqual(['webrtc:ready'])
    await flush(REJECTED_RETRY_DELAY_MS)
    expect(sentEvents()).toEqual(['webrtc:ready', 'webrtc:ready'])

    await flush(60_000)
    const events = sentEvents()
    expect(events.filter((event) => event === 'webrtc:ready')).toHaveLength(1 + MAX_REJECTED_RETRIES)
    // The queue moves on to the offer afterwards.
    expect(events.at(-1)).toBe('webrtc:signal')
  })

  it('holds the signaling while the socket is down', async () => {
    fakeSocket.connected = false
    start('a', true)
    await flush()
    expect(fakeSocket.emit).not.toHaveBeenCalled()

    fakeSocket.connected = true
    fire('connect')
    await flush()
    expect(sentEvents()).toEqual(['webrtc:ready', 'webrtc:signal'])
  })

  it('moves on when an event is never acknowledged and ignores a late acknowledgement', async () => {
    const acks: Ack[] = []
    fakeSocket.emit.mockImplementationOnce((_event: string, _payload: unknown, ack?: Ack) => {
      if (ack) acks.push(ack)
    })
    start('a', true)
    await flush(SIGNAL_ACK_TIMEOUT_MS - 1)
    expect(sentEvents()).toEqual(['webrtc:ready'])
    await flush(1 + SIGNAL_GAP_MS)
    expect(sentEvents()).toEqual(['webrtc:ready', 'webrtc:signal'])

    acks[0](RATE_LIMITED)
    await flush(60_000)
    expect(sentEvents()).toEqual(['webrtc:ready', 'webrtc:signal'])
  })
})

describe('createPeerSession: answering', () => {
  const offerFrom = (from: string, negotiationId = 'neg-1', to = 'fan'): WebRtcSignal => ({
    roomCode: 'ROOM01',
    from,
    to,
    negotiationId,
    description: { type: 'offer', sdp: 'remote-offer' },
  })

  it('answers an offer from a dancer and echoes its negotiation id', async () => {
    start('fan', false)
    fire('webrtc:signal', offerFrom('a'))
    await flush()

    const [pc] = pcsFor()
    expect(pc.setRemoteDescription).toHaveBeenCalledWith({ type: 'offer', sdp: 'remote-offer' })
    expect(sentSignals()).toEqual([
      { roomCode: 'ROOM01', from: 'fan', to: 'a', negotiationId: 'neg-1', description: { type: 'answer', sdp: 'answer-sdp' } },
    ])
    // A spectator has no camera to attach.
    expect(pc.addTrack).not.toHaveBeenCalled()
  })

  it('attaches its own camera when answering another dancer', async () => {
    const localStream = new FakeMediaStream([track]) as unknown as MediaStream
    room = battleRoom(['a', 'b'])
    start('b', true, localStream)
    fire('webrtc:signal', offerFrom('a', 'neg-1', 'b'))
    await flush()

    const [pc] = pcsFor()
    expect(pc.addTrack).toHaveBeenCalledWith(track, localStream)
    expect(sentSignals()[0].description?.type).toBe('answer')
  })

  it('ignores offers that do not belong in the mesh or are not addressed to it', async () => {
    start('fan', false)
    fire('webrtc:signal', offerFrom('fan2')) // spectator to spectator
    fire('webrtc:signal', offerFrom('stranger')) // not in the room
    fire('webrtc:signal', offerFrom('a', 'neg-1', 'fan2')) // for someone else
    fire('webrtc:signal', { ...offerFrom('a'), roomCode: 'OTHER1' })
    await flush()
    expect(pcsFor()).toHaveLength(0)
  })

  it('refuses an offer from a peer it should be offering to itself', async () => {
    room = battleRoom(['a', 'b'])
    start('a', true)
    await flush()
    const before = pcsFor().length
    fire('webrtc:signal', offerFrom('b', 'neg-x', 'a'))
    await flush()
    expect(pcsFor()).toHaveLength(before)
  })

  it('warns when the answer cannot be produced', async () => {
    class FailingPc extends FakePeerConnection {
      createAnswer = vi.fn(async (): Promise<RTCSessionDescriptionInit> => {
        throw new Error('no answer')
      })
    }
    vi.stubGlobal('RTCPeerConnection', FailingPc)
    start('fan', false)
    fire('webrtc:signal', offerFrom('a'))
    await flush()
    expect(warn).toHaveBeenCalledWith('WebRTC answer failed', expect.any(Error))
    expect(sentSignals()).toEqual([])
  })

  it('queues ICE candidates that arrive before the remote offer is applied', async () => {
    let releaseRemote: () => void = () => {}
    class SlowPc extends FakePeerConnection {
      setRemoteDescription = vi.fn(
        (description: RTCSessionDescriptionInit) =>
          new Promise<void>((resolve) => {
            releaseRemote = () => {
              this.remoteDescription = description
              resolve()
            }
          }),
      )
    }
    vi.stubGlobal('RTCPeerConnection', SlowPc)
    start('fan', false)
    fire('webrtc:signal', offerFrom('a'))
    await flush()
    const candidate = { candidate: 'cand-1', sdpMid: '0' }
    fire('webrtc:signal', { roomCode: 'ROOM01', from: 'a', to: 'fan', negotiationId: 'neg-1', candidate })
    await flush()
    const [pc] = pcsFor()
    expect(pc.addIceCandidate).not.toHaveBeenCalled()

    releaseRemote()
    await flush()
    expect(pc.addIceCandidate).toHaveBeenCalledWith(candidate)
    expect(sentSignals()[0].description?.type).toBe('answer')
  })
})

describe('createPeerSession: as the offerer', () => {
  async function offeringTo(target: string) {
    room = battleRoom(['a', target])
    start('a', true)
    await flush()
    const [pc] = pcsFor()
    const [offer] = sentSignals()
    return { pc, negotiationId: offer.negotiationId }
  }

  const answerSignal = (negotiationId: string, from = 'fan'): WebRtcSignal => ({
    roomCode: 'ROOM01',
    from,
    to: 'a',
    negotiationId,
    description: { type: 'answer', sdp: 'remote-answer' },
  })

  it('applies the answer, then the candidates a peer still trickles', async () => {
    const { pc, negotiationId } = await offeringTo('fan')
    fire('webrtc:signal', answerSignal(negotiationId))
    await flush()
    expect(pc.setRemoteDescription).toHaveBeenCalledWith({ type: 'answer', sdp: 'remote-answer' })

    const candidate = { candidate: 'cand-2' }
    fire('webrtc:signal', { roomCode: 'ROOM01', from: 'fan', to: 'a', negotiationId, candidate })
    await flush()
    expect(pc.addIceCandidate).toHaveBeenCalledWith(candidate)
  })

  it('drops messages of a replaced negotiation and unexpected answers', async () => {
    const { pc, negotiationId } = await offeringTo('fan')
    fire('webrtc:signal', answerSignal('stale-negotiation'))
    fire('webrtc:signal', { roomCode: 'ROOM01', from: 'nobody', to: 'a', negotiationId, candidate: { candidate: 'x' } })
    await flush()
    expect(pc.setRemoteDescription).not.toHaveBeenCalled()

    pc.signalingState = 'stable'
    fire('webrtc:signal', answerSignal(negotiationId))
    await flush()
    expect(pc.setRemoteDescription).not.toHaveBeenCalled()
  })

  it('warns when a candidate cannot be applied', async () => {
    const { pc, negotiationId } = await offeringTo('fan')
    fire('webrtc:signal', answerSignal(negotiationId))
    await flush()
    pc.addIceCandidate.mockRejectedValueOnce(new Error('bad candidate'))
    fire('webrtc:signal', { roomCode: 'ROOM01', from: 'fan', to: 'a', negotiationId, candidate: { candidate: 'bad' } })
    await flush()
    expect(warn).toHaveBeenCalledWith('WebRTC signal could not be applied', expect.any(Error))
  })

  it('publishes the remote stream, building one from the track when none is given', async () => {
    const { pc } = await offeringTo('b')
    const remote = { id: 'remote' } as unknown as MediaStream
    pc.ontrack?.({ streams: [remote], track })
    expect(usePeerStore.getState().remoteStreams.b).toBe(remote)

    pc.ontrack?.({ streams: [], track })
    const built = usePeerStore.getState().remoteStreams.b as unknown as FakeMediaStream
    expect(built).toBeInstanceOf(FakeMediaStream)
    expect(built.tracks).toEqual([track])
  })

  it('retries a failed connection once, then reports the failure', async () => {
    const { pc } = await offeringTo('fan')
    pc.failConnection()
    await flush()

    expect(pc.close).toHaveBeenCalled()
    expect(pcsFor()).toHaveLength(2)
    const retry = pcsFor()[1]
    expect(sentSignals()).toHaveLength(2)

    retry.failConnection()
    await flush()
    expect(pcsFor()).toHaveLength(2)
    expect(usePeerStore.getState().connectionStates.fan).toBe('failed')
  })

  it('mirrors connection state changes of the current connection only', async () => {
    const { pc } = await offeringTo('fan')
    pc.connectionState = 'connected'
    pc.onconnectionstatechange?.()
    expect(usePeerStore.getState().connectionStates.fan).toBe('connected')
  })

  it('reports a failed answered connection without retrying', async () => {
    start('fan', false)
    fire('webrtc:signal', {
      roomCode: 'ROOM01',
      from: 'a',
      to: 'fan',
      negotiationId: 'neg-1',
      description: { type: 'offer', sdp: 'remote-offer' },
    })
    await flush()
    pcsFor()[0].failConnection()
    await flush()
    expect(pcsFor()).toHaveLength(1)
    expect(usePeerStore.getState().connectionStates.a).toBe('failed')
  })
})

describe('createPeerSession: room changes', () => {
  it('closes connections with departed players and offers to newcomers', async () => {
    room = battleRoom(['a', 'fan'])
    start('a', true)
    await flush()
    const [fanPc] = pcsFor()
    usePeerStore.getState().setRemoteStream('fan', { id: 'fan-stream' } as unknown as MediaStream)
    usePeerStore.getState().setRemoteStream('ghost', { id: 'ghost-stream' } as unknown as MediaStream)

    room = battleRoom(['a', 'fan2'])
    fire('room:updated')
    await flush()

    expect(fanPc.close).toHaveBeenCalled()
    expect(fanPc.onicecandidate).toBeNull()
    expect(usePeerStore.getState().remoteStreams).toEqual({})
    expect(usePeerStore.getState().connectionStates).toEqual({ fan2: 'new' })
    expect(sentSignals().map((s) => s.to)).toEqual(['fan', 'fan2'])
  })

  it('offers again when a peer restarts its session', async () => {
    room = battleRoom(['a', 'fan'])
    start('a', true)
    await flush()
    fire('webrtc:peer-ready', { playerId: 'fan' })
    fire('webrtc:peer-ready', { playerId: 'a' })
    await flush()
    expect(pcsFor()).toHaveLength(2)
    expect(pcsFor()[0].close).toHaveBeenCalled()
  })

  it('ignores a peer-ready from a peer that offers itself', async () => {
    start('fan', false)
    fire('webrtc:peer-ready', { playerId: 'a' })
    await flush()
    expect(pcsFor()).toHaveLength(0)
  })
})

describe('createPeerSession: dispose', () => {
  it('stops listening, closes every connection and clears the peer store once', async () => {
    room = battleRoom(['a', 'fan'])
    const current = start('a', true)
    await flush()
    usePeerStore.getState().setRemoteStream('fan', { id: 's' } as unknown as MediaStream)
    const [pc] = pcsFor()

    current.dispose()
    current.dispose()
    session = null

    expect(pc.close).toHaveBeenCalledTimes(1)
    expect(fakeSocket.off.mock.calls.map(([event]) => event).sort()).toEqual(
      fakeSocket.on.mock.calls.map(([event]) => event).sort(),
    )
    expect([...fakeSocket.handlers.values()].every((handlers) => handlers.size === 0)).toBe(true)
    expect(usePeerStore.getState().remoteStreams).toEqual({})

    // Late events are ignored.
    fire('webrtc:signal', {
      roomCode: 'ROOM01',
      from: 'b',
      to: 'a',
      negotiationId: 'n',
      description: { type: 'offer', sdp: 'x' },
    })
    await flush()
    expect(pcsFor()).toHaveLength(1)
  })

  it('sends nothing that was still queued when the session was disposed', async () => {
    const current = start('a', true)
    await flush(0)
    current.dispose()
    session = null
    await flush(60_000)
    expect(sentEvents()).toEqual(['webrtc:ready'])
  })

  it('discards an offer that resolves after the session was disposed', async () => {
    let release: (d: RTCSessionDescriptionInit) => void = () => {}
    class SlowPc extends FakePeerConnection {
      createOffer = vi.fn(() => new Promise<RTCSessionDescriptionInit>((resolve) => (release = resolve)))
    }
    vi.stubGlobal('RTCPeerConnection', SlowPc)
    room = battleRoom(['a', 'fan'])
    const current = start('a', true)
    current.dispose()
    session = null
    release({ type: 'offer', sdp: 'late' })
    await flush()
    expect(sentSignals()).toEqual([])
  })
})
