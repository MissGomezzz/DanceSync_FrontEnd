import { useEffect, useRef, type ReactNode } from 'react'

interface VideoTileProps {
  stream: MediaStream | null
  label: string
  /** Mirror horizontally; used for the local preview only. */
  mirrored?: boolean
  placeholder: string
  /** Optional header content next to the label (badges). */
  badges?: ReactNode
  /** Replaces the video area, e.g. with the camera permission prompt. */
  overlay?: ReactNode
}

export function VideoTile({ stream, label, mirrored = false, placeholder, badges, overlay }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (video.srcObject !== stream) video.srcObject = stream
    // autoPlay covers most cases; play() recovers when the stream is swapped in later.
    if (stream) void video.play().catch(() => {})
  }, [stream])

  const showVideo = !overlay && stream !== null

  return (
    <figure className="flex flex-col overflow-hidden rounded-xl border border-fuchsia-900/60 bg-slate-900">
      <figcaption className="flex items-center justify-between gap-2 px-4 py-3">
        <span className="truncate text-lg font-semibold text-slate-100">{label}</span>
        <span className="flex shrink-0 gap-2">{badges}</span>
      </figcaption>
      <div className="relative aspect-video bg-slate-950">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          aria-label={`${label} camera`}
          className={`h-full w-full object-cover ${mirrored ? '-scale-x-100' : ''} ${showVideo ? '' : 'hidden'}`}
        />
        {overlay ??
          (!showVideo && (
            <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-slate-500">
              {placeholder}
            </div>
          ))}
      </div>
    </figure>
  )
}
