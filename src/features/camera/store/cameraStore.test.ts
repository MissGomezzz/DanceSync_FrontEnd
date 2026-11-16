import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCameraStore } from './cameraStore'

/** A fake video track whose `ended` listeners the test can fire. */
function fakeTrack() {
  const listeners: Array<() => void> = []
  return {
    stop: vi.fn(),
    addEventListener: vi.fn((event: string, listener: () => void) => {
      if (event === 'ended') listeners.push(listener)
    }),
    end: () => listeners.forEach((listener) => listener()),
  }
}

function fakeStream() {
  const track = fakeTrack()
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream
  return { stream, track }
}

const getUserMedia = vi.fn()
const queryPermission = vi.fn()

function setBrowser({ secure = true, mediaDevices = true, permissions = true } = {}) {
  vi.stubGlobal('isSecureContext', secure)
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: mediaDevices ? { getUserMedia } : undefined,
  })
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: permissions ? { query: queryPermission } : undefined,
  })
}

const domError = (name: string) => new DOMException('camera', name)

beforeEach(() => {
  getUserMedia.mockReset()
  queryPermission.mockReset()
  setBrowser()
  // stopCamera also invalidates any pending request from a previous test.
  useCameraStore.getState().stopCamera()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('requestCamera', () => {
  it('opens the camera with video only and keeps the stream', async () => {
    const { stream } = fakeStream()
    getUserMedia.mockResolvedValue(stream)

    await useCameraStore.getState().requestCamera()

    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: false, video: expect.any(Object) }))
    expect(useCameraStore.getState()).toMatchObject({ status: 'granted', localStream: stream, errorMessage: null })
  })

  it('does not open the camera twice', async () => {
    const { stream } = fakeStream()
    getUserMedia.mockResolvedValue(stream)
    await useCameraStore.getState().requestCamera()
    await useCameraStore.getState().requestCamera()
    expect(getUserMedia).toHaveBeenCalledTimes(1)
  })

  it('reports an insecure context without asking the browser', async () => {
    setBrowser({ secure: false })
    await useCameraStore.getState().requestCamera()
    expect(getUserMedia).not.toHaveBeenCalled()
    expect(useCameraStore.getState().status).toBe('unavailable')
    expect(useCameraStore.getState().errorMessage).toMatch(/secure connection/)
  })

  it.each([
    ['NotAllowedError', 'denied', /blocked/],
    ['SecurityError', 'denied', /blocked/],
    ['NotFoundError', 'unavailable', /No camera was found/],
    ['OverconstrainedError', 'unavailable', /No camera was found/],
    ['NotReadableError', 'error', /another application/],
    ['AbortError', 'error', /could not be started/],
  ])('maps %s to the %s state', async (name, status, message) => {
    getUserMedia.mockRejectedValue(domError(name))
    await useCameraStore.getState().requestCamera()
    expect(useCameraStore.getState().status).toBe(status)
    expect(useCameraStore.getState().errorMessage).toMatch(message)
    expect(useCameraStore.getState().localStream).toBeNull()
  })

  it('treats a non-error rejection as a generic failure', async () => {
    getUserMedia.mockRejectedValue('weird')
    await useCameraStore.getState().requestCamera()
    expect(useCameraStore.getState().status).toBe('error')
  })

  it('stops a stream that arrives after the camera was released', async () => {
    const { stream, track } = fakeStream()
    let resolve: (value: MediaStream) => void = () => {}
    getUserMedia.mockReturnValue(new Promise((r) => (resolve = r)))

    const pending = useCameraStore.getState().requestCamera()
    useCameraStore.getState().stopCamera()
    resolve(stream)
    await pending

    expect(track.stop).toHaveBeenCalled()
    expect(useCameraStore.getState()).toMatchObject({ status: 'idle', localStream: null })
  })

  it('ignores an error that arrives after the camera was released', async () => {
    let reject: (error: unknown) => void = () => {}
    getUserMedia.mockReturnValue(new Promise((_, r) => (reject = r)))

    const pending = useCameraStore.getState().requestCamera()
    useCameraStore.getState().stopCamera()
    reject(domError('NotAllowedError'))
    await pending

    expect(useCameraStore.getState().status).toBe('idle')
  })

  it('reports a camera that stops sending video', async () => {
    const { stream, track } = fakeStream()
    getUserMedia.mockResolvedValue(stream)
    await useCameraStore.getState().requestCamera()

    track.end()

    expect(useCameraStore.getState()).toMatchObject({ status: 'error', localStream: null })
    expect(useCameraStore.getState().errorMessage).toMatch(/stopped sending video/)
  })

  it('ignores the end of a track from a stream it no longer holds', async () => {
    const { stream, track } = fakeStream()
    getUserMedia.mockResolvedValue(stream)
    await useCameraStore.getState().requestCamera()
    useCameraStore.getState().stopCamera()

    track.end()

    expect(useCameraStore.getState().status).toBe('idle')
  })
})

describe('stopCamera', () => {
  it('stops every local track and returns to idle', async () => {
    const { stream, track } = fakeStream()
    getUserMedia.mockResolvedValue(stream)
    await useCameraStore.getState().requestCamera()

    useCameraStore.getState().stopCamera()

    expect(track.stop).toHaveBeenCalled()
    expect(useCameraStore.getState()).toMatchObject({ status: 'idle', localStream: null, errorMessage: null })
  })
})

describe('checkPermission', () => {
  it('starts the camera directly when the permission was already granted', async () => {
    const { stream } = fakeStream()
    queryPermission.mockResolvedValue({ state: 'granted' })
    getUserMedia.mockResolvedValue(stream)

    await useCameraStore.getState().checkPermission()

    expect(queryPermission).toHaveBeenCalledWith({ name: 'camera' })
    expect(useCameraStore.getState().status).toBe('granted')
  })

  it('shows the explanation first when the browser would prompt', async () => {
    queryPermission.mockResolvedValue({ state: 'prompt' })
    await useCameraStore.getState().checkPermission()
    expect(getUserMedia).not.toHaveBeenCalled()
    expect(useCameraStore.getState().status).toBe('prompt')
  })

  it('reports a blocked permission', async () => {
    queryPermission.mockResolvedValue({ state: 'denied' })
    await useCameraStore.getState().checkPermission()
    expect(useCameraStore.getState()).toMatchObject({ status: 'denied', errorMessage: 'Camera access was blocked.' })
  })

  it('falls back to the explanation when the permission cannot be read', async () => {
    queryPermission.mockRejectedValue(new TypeError('camera is not a valid permission name'))
    await useCameraStore.getState().checkPermission()
    expect(useCameraStore.getState().status).toBe('prompt')
  })

  it('falls back to the explanation without the Permissions API', async () => {
    setBrowser({ permissions: false })
    await useCameraStore.getState().checkPermission()
    expect(useCameraStore.getState().status).toBe('prompt')
  })

  it('reports an unsupported browser', async () => {
    setBrowser({ mediaDevices: false })
    await useCameraStore.getState().checkPermission()
    expect(useCameraStore.getState().status).toBe('unavailable')
  })

  it('does nothing while a request is running or the camera is on', async () => {
    useCameraStore.setState({ status: 'requesting' })
    await useCameraStore.getState().checkPermission()
    useCameraStore.setState({ status: 'granted' })
    await useCameraStore.getState().checkPermission()
    expect(queryPermission).not.toHaveBeenCalled()
  })

  it('discards a permission answer that arrives after the camera was released', async () => {
    let resolve: (value: { state: PermissionState }) => void = () => {}
    queryPermission.mockReturnValue(new Promise((r) => (resolve = r)))

    const pending = useCameraStore.getState().checkPermission()
    useCameraStore.getState().stopCamera()
    resolve({ state: 'denied' })
    await pending

    expect(useCameraStore.getState().status).toBe('idle')
  })
})
