import { useEffect, useRef, useState } from 'react'

const CLIP_SECONDS = 90

let apiPromise: Promise<void> | null = null

function loadYouTubeApi(): Promise<void> {
  if (typeof YT !== 'undefined' && YT.Player) return Promise.resolve()
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      resolve()
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(script)
  })
  return apiPromise
}

interface SongPlayerProps {
  videoId: string
  /** Epoch ms when the clip should start; null waits without playing. */
  startAt: number | null
  onError?: (code: number) => void
}

export function SongPlayer({ videoId, startAt, onError }: SongPlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YT.Player | null>(null)
  const [ready, setReady] = useState(false)
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  useEffect(() => {
    let cancelled = false
    const target = document.createElement('div')
    hostRef.current?.appendChild(target)

    void loadYouTubeApi().then(() => {
      if (cancelled) return
      playerRef.current = new YT.Player(target, {
        videoId,
        playerVars: { controls: 0, disablekb: 1, rel: 0, modestbranding: 1, playsinline: 1, fs: 0, start: 0, end: CLIP_SECONDS },
        events: {
          onReady: (_event: YT.PlayerEvent) => setReady(true),
          onError: (event: YT.OnErrorEvent) => onErrorRef.current?.(event.data),
        },
      })
    })

    return () => {
      cancelled = true
      setReady(false)
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [videoId])

  useEffect(() => {
    const player = playerRef.current
    if (!ready || !player || startAt === null) return

    const timers: number[] = []
    const delay = startAt - Date.now()
    const endsIn = startAt + CLIP_SECONDS * 1000 - Date.now()

    if (endsIn <= 0) {
      player.pauseVideo()
      return
    }
    const play = () => {
      const elapsed = Math.max(0, (Date.now() - startAt) / 1000)
      if (elapsed > 1) player.seekTo(elapsed, true)
      player.playVideo()
    }
    if (delay > 0) timers.push(window.setTimeout(play, delay))
    else play()
    timers.push(window.setTimeout(() => player.pauseVideo(), endsIn))

    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [ready, startAt])

  return (
    <div
      ref={hostRef}
      className="pointer-events-none aspect-video w-full overflow-hidden rounded-xl border border-slate-800 bg-black [&_iframe]:h-full [&_iframe]:w-full"
    />
  )
}