/**
 * WebRTC signaling wire shapes. They mirror `WebRtc*Payload` in
 * battle-service `src/infrastructure/ws/events.ts`.
 */

export interface SignalDescription {
  type: RTCSdpType
  sdp?: string
}

export interface WebRtcSignal {
  roomCode: string
  from: string
  to: string
  /** Created by the offerer per peer connection; answers and candidates echo it. */
  negotiationId: string
  description?: SignalDescription
  candidate?: RTCIceCandidateInit
}

export interface WebRtcReady {
  roomCode: string
  playerId: string
}

export interface WebRtcPeerReady {
  playerId: string
}

export type CameraStatus = 'idle' | 'prompt' | 'requesting' | 'granted' | 'denied' | 'unavailable' | 'error'
