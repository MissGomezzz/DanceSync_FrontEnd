import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Player, Room } from '../../../shared/types'
import { usePeerStore } from '../store/peerStore'
import type { WebRtcSignal } from '../types'
import { createPeerSession, type PeerSession } from './peerSession'

type Handler = (payload: unknown) => void

const { fakeSocket } = vi.hoisted(() => {
  const handlers = new Map<string, Set<(payload: unknown) => void>>()
  return {
    fakeSocket: {
      handlers,
      on: vi.fn((event: string, handler: (payload: unknown) => void) => {
        if (!handlers.has(event)) handlers.set(event, new Set())
        handlers.get(event)?.add(handler)
      }),
      off: vi.fn((event: string, handler: (payload: unknown) => void) => {
        handlers.get(event)?.delete(handler)
      }),
      emit: vi.fn(),
    },
  }
})

vi.mock('../../../shared/lib/socket', () => ({ connectSocket: () => fakeSocket }))

const { fakeEnv } = vi.hoisted(() => ({ fakeEnv: { turnUrls: '', turnUsername: '', turnCredential: '' } }))

vi.mock('../../../shared/lib/env', () => ({ env: fakeEnv }))

/** Minimal stand-in for RTCPeerConnection: records calls and lets tests drive its events. */
class FakePeerConnection {
  static instances: FakePeerConnection[] = []

  connectionState: RTCPeerConnectionState = 'new'
  signalingState: RTCSignalingState = 'stable'
  localDescription: RTCSessionDescriptionInit | null = null
  remoteDescription: RTCSessionDescriptionInit | null = null
  onicecandidate: ((event: { candidate: { toJSON: () => RTCIceCandidateInit } | null }) => void) | null = null
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
  })
  setRemoteDescription = vi.fn(async (description: RTCSessionDescriptionInit) => {
    this.remoteDescription = description
    this.signalingState = description.type === 'offer' ? 'have-remote-offer' : 'stable'
  })

  constructor(config: RTCConfiguration) {
    this.config = config
    FakePeerConnection.instances.push(this)
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

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function fire(event: string, payload?: unknown) {
  for (const handler of fakeSocket.handlers.get(event) ?? []) (handler as Handler)(payload)
}

/** Signals this client sent through webrtc:signal. */
function sentSignals(): WebRtcSignal[] {
  return fakeSocket.emit.mock.calls.filter(([event]) => event === 'webrtc:signal').map(([, signal]) => signal)
}

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
  FakePeerConnection.instances = []
  fakeSocket.handlers.clear()
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

  it('applies the answer, then the candidates that follow it', async () => {
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

  it('relays its ICE candidates with the negotiation id', async () => {
    const { pc, negotiationId } = await offeringTo('fan')
    fakeSocket.emit.mockClear()
    pc.onicecandidate?.({ candidate: { toJSON: () => ({ candidate: 'local-1' }) } })
    pc.onicecandidate?.({ candidate: null })
    expect(sentSignals()).toEqual([
      { roomCode: 'ROOM01', from: 'a', to: 'fan', negotiationId, candidate: { candidate: 'local-1' } },
    ])
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
    expect(fakeSocket.off).toHaveBeenCalledTimes(3)
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
