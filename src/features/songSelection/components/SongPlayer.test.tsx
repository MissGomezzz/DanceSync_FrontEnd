import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTOPLAY_CHECK_MS, SongPlayer, YOUTUBE_API_UNAVAILABLE } from './SongPlayer'

const PLAYING = 1
const UNSTARTED = -1

/** Minimal stand-in for YT.Player; `autoplayAllowed` decides whether playVideo() works. */
class FakePlayer {
  static instances: FakePlayer[] = []
  static autoplayAllowed = true

  state = UNSTARTED
  currentTime = 0
  readonly options: YT.PlayerOptions
  readonly playVideo = vi.fn(() => {
    if (FakePlayer.autoplayAllowed) this.changeState(PLAYING)
  })
  readonly pauseVideo = vi.fn()
  readonly seekTo = vi.fn((seconds: number) => {
    this.currentTime = seconds
  })
  readonly destroy = vi.fn()

  constructor(_target: HTMLElement, options: YT.PlayerOptions) {
    this.options = options
    FakePlayer.instances.push(this)
  }

  getPlayerState = () => this.state
  getCurrentTime = () => this.currentTime

  ready() {
    act(() => this.options.events?.onReady?.({ target: this } as unknown as YT.PlayerEvent))
  }

  changeState(state: number) {
    this.state = state
    this.options.events?.onStateChange?.({ target: this, data: state } as unknown as YT.OnStateChangeEvent)
  }
}

/** Renders the player and waits for the (stubbed) API to create it. */
async function renderPlayer(startAt: number | null, extra: { durationSeconds?: number; onError?: (code: number) => void } = {}) {
  const view = render(
    <SongPlayer videoId="abc" startAt={startAt} durationSeconds={extra.durationSeconds ?? 90} onError={extra.onError} />,
  )
  await act(async () => {})
  const player = FakePlayer.instances.at(-1)
  if (!player) throw new Error('the player was not created')
  return { ...view, player }
}

beforeEach(() => {
  FakePlayer.instances = []
  FakePlayer.autoplayAllowed = true
  vi.stubGlobal('YT', { Player: FakePlayer })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('SongPlayer timing', () => {
  it('joins a running battle at its elapsed time from the local monotonic clock, ignoring a skewed wall clock', async () => {
    vi.useFakeTimers()
    // This device's wall clock runs 90 s ahead of the server; it must not matter.
    vi.setSystemTime(Date.now() + 90_000)
    const { player } = await renderPlayer(performance.now() - 30_000)

    player.ready()

    expect(player.seekTo).toHaveBeenCalledTimes(1)
    expect(player.seekTo.mock.calls[0][0]).toBeCloseTo(30, 0)
    expect(player.playVideo).toHaveBeenCalled()
  })

  it('waits for a start in the future and does not seek when on time', async () => {
    vi.useFakeTimers()
    const { player } = await renderPlayer(performance.now() + 3_000)
    player.ready()
    expect(player.playVideo).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(3_000))

    expect(player.playVideo).toHaveBeenCalledTimes(1)
    expect(player.seekTo).not.toHaveBeenCalled()
  })

  it('does not seek again on a room update that only moves the start by network jitter', async () => {
    vi.useFakeTimers()
    const startAt = performance.now() - 10_000
    const { player, rerender } = await renderPlayer(startAt)
    player.ready()
    expect(player.seekTo).toHaveBeenCalledTimes(1)

    rerender(<SongPlayer videoId="abc" startAt={startAt + 200} durationSeconds={90} />)

    expect(player.seekTo).toHaveBeenCalledTimes(1)
    expect(player.playVideo).toHaveBeenCalledTimes(1)
  })

  it('plays the song for its own duration, not a fixed clip length', async () => {
    vi.useFakeTimers()
    const { player } = await renderPlayer(performance.now(), { durationSeconds: 45 })
    expect(player.options.playerVars?.end).toBe(45)
    expect(player.options.host).toBe('https://www.youtube-nocookie.com')
    player.ready()

    act(() => vi.advanceTimersByTime(44_000))
    expect(player.pauseVideo).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1_000))
    expect(player.pauseVideo).toHaveBeenCalled()
  })
})

describe('SongPlayer when the browser blocks autoplay', () => {
  it('offers a button that starts the music at the current elapsed time when playback never starts', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    FakePlayer.autoplayAllowed = false
    const startAt = performance.now() - 5_000
    const { player } = await renderPlayer(startAt)
    player.ready()
    expect(screen.queryByRole('button', { name: 'Tap to start the music' })).toBeNull()

    act(() => vi.advanceTimersByTime(AUTOPLAY_CHECK_MS))
    const button = screen.getByRole('button', { name: 'Tap to start the music' })

    // The click is a user gesture, so the browser now lets the video play.
    FakePlayer.autoplayAllowed = true
    player.seekTo.mockClear()
    player.currentTime = 0
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(button)

    expect(player.seekTo.mock.calls[0][0]).toBeGreaterThan(6.9)
    expect(player.playVideo).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('button', { name: 'Tap to start the music' })).toBeNull()
  })

  it('shows the button as soon as YouTube reports that autoplay was blocked', async () => {
    FakePlayer.autoplayAllowed = false
    const { player } = await renderPlayer(performance.now())
    player.ready()

    act(() => player.options.events?.onAutoplayBlocked?.({ target: player } as unknown as YT.PlayerEvent))

    expect(screen.getByRole('button', { name: 'Tap to start the music' })).toBeTruthy()
  })
})

describe('SongPlayer when the YouTube API cannot be loaded', () => {
  beforeEach(() => {
    vi.stubGlobal('YT', undefined)
  })

  const apiScripts = () => document.head.querySelectorAll('script[src="https://www.youtube.com/iframe_api"]')

  it('reports a script error and retries with a fresh script on the next player', async () => {
    const onError = vi.fn()
    const first = render(<SongPlayer videoId="abc" startAt={null} durationSeconds={90} onError={onError} />)
    const script = apiScripts()[0]
    expect(script).toBeTruthy()

    await act(async () => script.dispatchEvent(new Event('error')))

    expect(onError).toHaveBeenCalledWith(YOUTUBE_API_UNAVAILABLE)
    expect(apiScripts()).toHaveLength(0)
    first.unmount()

    render(<SongPlayer videoId="abc" startAt={null} durationSeconds={90} onError={onError} />)
    expect(apiScripts()).toHaveLength(1)
    // Settle the retry so the next test starts from a clean cache.
    await act(async () => apiScripts()[0].dispatchEvent(new Event('error')))
  })

  it('gives up after 10 seconds without an answer', async () => {
    vi.useFakeTimers()
    const onError = vi.fn()
    render(<SongPlayer videoId="abc" startAt={null} durationSeconds={90} onError={onError} />)

    await act(async () => vi.advanceTimersByTime(9_999))
    expect(onError).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTime(1))

    expect(onError).toHaveBeenCalledWith(YOUTUBE_API_UNAVAILABLE)
    expect(apiScripts()).toHaveLength(0)
  })
})
