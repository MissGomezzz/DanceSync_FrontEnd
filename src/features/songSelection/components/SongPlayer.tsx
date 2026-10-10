import { useEffect, useRef, useState } from 'react'
import { Button } from '../../../shared/ui/atoms/Button'

/** `onError` code used when the YouTube IFrame API itself could not be loaded. */
export const YOUTUBE_API_UNAVAILABLE = -1

const YOUTUBE_API_URL = 'https://www.youtube.com/iframe_api'
const API_LOAD_TIMEOUT_MS = 10_000
/** How long after playVideo() the video must be playing before autoplay counts as blocked. */
export const AUTOPLAY_CHECK_MS = 2_000
/** Gap between the video and the battle clock that is corrected with a seek. */
const DRIFT_TOLERANCE_S = 1.5

// YT.PlayerState values; the enum object only exists once the API script has loaded.
const UNSTARTED = -1
const ENDED = 0
const PLAYING = 1
const PAUSED = 2
const BUFFERING = 3
const CUED = 5
/** Pauses this close to the clip end are the planned stop, not something to undo. */
const END_MARGIN_MS = 500

let apiPromise: Promise<void> | null = null

function loadYouTubeApi(): Promise<void> {
  if (typeof YT !== 'undefined' && YT.Player) return Promise.resolve()
  if (apiPromise) return apiPromise
  const pending = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    const fail = () => {
      window.clearTimeout(timer)
      script.remove()
      reject(new Error('The YouTube player could not be loaded.'))
    }
    const timer = window.setTimeout(fail, API_LOAD_TIMEOUT_MS)
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timer)
      previous?.()
      resolve()
    }
    script.onerror = fail
    script.src = YOUTUBE_API_URL
    document.head.appendChild(script)
  })
  apiPromise = pending
  // A failed load is not cached: the next player (the next battle) tries again.
  pending.catch(() => {
    if (apiPromise === pending) apiPromise = null
  })
  return pending
}

function isPlaying(player: YT.Player): boolean {
  const state = player.getPlayerState()
  return state === PLAYING || state === BUFFERING
}

/** Seeks to the battle's elapsed time when the video drifted, then makes sure it plays. */
function syncTo(player: YT.Player, startAt: number): void {
  const elapsed = Math.max(0, (performance.now() - startAt) / 1000)
  if (Math.abs(player.getCurrentTime() - elapsed) > DRIFT_TOLERANCE_S) player.seekTo(elapsed, true)
  if (!isPlaying(player)) player.playVideo()
}

interface SongPlayerProps {
  videoId: string
  /**
   * performance.now() timestamp when the clip starts (in the past once the battle
   * is running); null waits without playing.
   */
  startAt: number | null
  /** Length of the battle clip in seconds; playback stops there. */
  durationSeconds: number
  /** YouTube player error code, or YOUTUBE_API_UNAVAILABLE when the player could not be loaded. */
  onError?: (code: number) => void
}

export function SongPlayer({ videoId, startAt, durationSeconds, onError }: SongPlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YT.Player | null>(null)
  const [ready, setReady] = useState(false)
  // The browser refused to start the music without a user gesture.
  const [blocked, setBlocked] = useState(false)
  // A black curtain hides YouTube's own screens (thumbnail, title, logo, end
  // screen) whenever the video is not actually playing: players only see the dance.
  const [showVideo, setShowVideo] = useState(false)
  const onErrorRef = useRef(onError)
  // Read by the player's event handlers, which are created once per video.
  const clipRef = useRef({ startAt, durationSeconds })

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    clipRef.current = { startAt, durationSeconds }
  }, [startAt, durationSeconds])

  useEffect(() => {
    let cancelled = false
    const target = document.createElement('div')
    hostRef.current?.appendChild(target)

    loadYouTubeApi().then(
      () => {
        if (cancelled) return
        playerRef.current = new YT.Player(target, {
          host: 'https://www.youtube-nocookie.com',
          videoId,
          // No controls, keyboard, fullscreen, annotations or related videos:
          // the battle clock drives playback and players can only watch.
          playerVars: {
            controls: 0,
            disablekb: 1,
            rel: 0,
            playsinline: 1,
            fs: 0,
            iv_load_policy: 3,
            start: 0,
            end: durationSeconds,
          },
          events: {
            onReady: () => setReady(true),
            onStateChange: (event: YT.OnStateChangeEvent) => {
              if (event.data === PLAYING) {
                setBlocked(false)
                setShowVideo(true)
              } else if (event.data === PAUSED || event.data === ENDED || event.data === UNSTARTED || event.data === CUED) {
                setShowVideo(false)
              }
              // Nobody may pause the dance: a pause during the clip (media keys,
              // OS media controls) is undone by resyncing to the battle clock.
              const { startAt: clipStart, durationSeconds: clipSeconds } = clipRef.current
              const player = playerRef.current
              if (event.data === PAUSED && player && clipStart !== null) {
                const now = performance.now()
                if (now >= clipStart && now < clipStart + clipSeconds * 1000 - END_MARGIN_MS) syncTo(player, clipStart)
              }
            },
            onAutoplayBlocked: () => setBlocked(true),
            onError: (event: YT.OnErrorEvent) => onErrorRef.current?.(event.data),
          },
        })
      },
      () => {
        if (!cancelled) onErrorRef.current?.(YOUTUBE_API_UNAVAILABLE)
      },
    )

    return () => {
      cancelled = true
      setReady(false)
      setBlocked(false)
      setShowVideo(false)
      playerRef.current?.destroy()
      playerRef.current = null
      target.remove()
    }
  }, [videoId, durationSeconds])

  useEffect(() => {
    const player = playerRef.current
    if (!ready || !player || startAt === null) return

    const timers: number[] = []
    const now = performance.now()
    const endsIn = startAt + durationSeconds * 1000 - now

    if (endsIn <= 0) {
      player.pauseVideo()
      return
    }
    const play = () => {
      // Rerun on every room update: only a real drift seeks, so the music does not skip.
      syncTo(player, startAt)
      // Not every browser fires onAutoplayBlocked; a video that is still not
      // playing shortly after playVideo() was blocked too.
      timers.push(
        window.setTimeout(() => {
          if (!isPlaying(player)) setBlocked(true)
        }, AUTOPLAY_CHECK_MS),
      )
    }
    const delay = startAt - now
    if (delay > 0) timers.push(window.setTimeout(play, delay))
    else play()
    timers.push(
      window.setTimeout(() => {
        player.pauseVideo()
        setBlocked(false)
      }, endsIn),
    )

    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [ready, startAt, durationSeconds])

  const handleStartMusic = () => {
    const player = playerRef.current
    // A click is a user gesture, so the browser lets this playVideo() through.
    if (player && startAt !== null) syncTo(player, startAt)
  }

  return (
    <div className="relative aspect-video w-full bg-black">
      {/* The video is not interactive: no clicks, hover overlays or fullscreen reach YouTube. */}
      <div ref={hostRef} className="pointer-events-none absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full" />
      {!showVideo && (
        <div data-testid="song-curtain" aria-hidden="true" className="absolute inset-0 bg-black" />
      )}
      {blocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-4">
          <Button onClick={handleStartMusic}>Tap to start the music</Button>
        </div>
      )}
    </div>
  )
}
