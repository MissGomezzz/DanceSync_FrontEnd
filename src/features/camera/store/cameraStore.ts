import { create } from 'zustand'
import type { CameraStatus } from '../types'

const VIDEO_CONSTRAINTS: MediaStreamConstraints = {
  // 16:9 matches the battle tiles; cameras that cannot do it are letterboxed, never cropped.
  video: { width: { ideal: 1280 }, height: { ideal: 720 }, aspectRatio: { ideal: 16 / 9 }, facingMode: 'user' },
  // Audio stays off on purpose: the battle music would echo through every peer.
  audio: false,
}

const INSECURE_CONTEXT_MESSAGE =
  'Camera access requires a secure connection. Open DanceSync over https or from localhost.'

interface CameraState {
  status: CameraStatus
  localStream: MediaStream | null
  errorMessage: string | null
  /**
   * Reads the current permission without prompting. An already granted permission
   * starts the camera directly; otherwise the explanation is shown first.
   */
  checkPermission: () => Promise<void>
  /** Opens the camera; this is what triggers the browser permission prompt. */
  requestCamera: () => Promise<void>
  /** Stops every local track and returns to the idle state. */
  stopCamera: () => void
}

/**
 * Incremented by stopCamera so that pending permission checks or getUserMedia
 * calls started before a teardown (for example the StrictMode double mount)
 * are discarded when they resolve.
 */
let generation = 0

function cameraSupported(): boolean {
  return window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === 'function'
}

function stopTracks(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop())
}

function describeError(error: unknown): Pick<CameraState, 'status' | 'errorMessage'> {
  const name = error instanceof DOMException || error instanceof Error ? error.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return { status: 'denied', errorMessage: 'Camera access was blocked.' }
    case 'NotFoundError':
    case 'OverconstrainedError':
      return { status: 'unavailable', errorMessage: 'No camera was found. Connect a camera and try again.' }
    case 'NotReadableError':
      return {
        status: 'error',
        errorMessage: 'The camera is being used by another application. Close it and try again.',
      }
    default:
      return { status: 'error', errorMessage: 'The camera could not be started. Try again.' }
  }
}

export const useCameraStore = create<CameraState>((set, get) => ({
  status: 'idle',
  localStream: null,
  errorMessage: null,

  checkPermission: async () => {
    const { status } = get()
    if (status === 'granted' || status === 'requesting') return
    if (!cameraSupported()) {
      set({ status: 'unavailable', errorMessage: INSECURE_CONTEXT_MESSAGE })
      return
    }
    const token = generation
    let state: PermissionState | 'unknown' = 'unknown'
    try {
      const permission = await navigator.permissions?.query({ name: 'camera' as PermissionName })
      if (permission) state = permission.state
    } catch {
      // Some browsers do not expose the camera permission; fall back to the explanation.
    }
    if (token !== generation) return
    if (state === 'granted') {
      await get().requestCamera()
    } else if (state === 'denied') {
      set({ status: 'denied', errorMessage: 'Camera access was blocked.' })
    } else {
      set({ status: 'prompt', errorMessage: null })
    }
  },

  requestCamera: async () => {
    if (get().status === 'requesting' || get().localStream) return
    if (!cameraSupported()) {
      set({ status: 'unavailable', errorMessage: INSECURE_CONTEXT_MESSAGE })
      return
    }
    const token = generation
    set({ status: 'requesting', errorMessage: null })
    try {
      const stream = await navigator.mediaDevices.getUserMedia(VIDEO_CONSTRAINTS)
      if (token !== generation) {
        // The camera was released while the prompt was open.
        stopTracks(stream)
        return
      }
      stream.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', () => {
          if (get().localStream !== stream) return
          set({
            status: 'error',
            localStream: null,
            errorMessage: 'The camera stopped sending video. Check that it is connected and try again.',
          })
        })
      })
      set({ status: 'granted', localStream: stream, errorMessage: null })
    } catch (error) {
      if (token !== generation) return
      set({ localStream: null, ...describeError(error) })
    }
  },

  stopCamera: () => {
    generation += 1
    stopTracks(get().localStream)
    set({ status: 'idle', localStream: null, errorMessage: null })
  },
}))

export const useCameraStatus = () => useCameraStore((state) => state.status)
export const useCameraError = () => useCameraStore((state) => state.errorMessage)
export const useLocalStream = () => useCameraStore((state) => state.localStream)
