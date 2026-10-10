import { useEffect, useRef, type ReactNode } from 'react'

interface VideoTileProps {
  stream: MediaStream | null
  label: string
  /** Mirror horizontally; used for the local preview only. */
  mirrored?: boolean
  placeholder: string
  /** Optional content next to the name label (badges). */
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
      {/* object-contain keeps the whole dancer in frame whatever the camera's aspect ratio. */}
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          aria-label={`${label} camera`}
          className={`h-full w-full object-contain ${mirrored ? '-scale-x-100' : ''} ${showVideo ? '' : 'hidden'}`}
        />
        {overlay ??
          (!showVideo && (
            <div className="absolute inset-0 flex items-center justify-center p-4 pb-14 text-center text-sm text-slate-500">
              {placeholder}
            </div>
          ))}
        {/* Drawn over the video: a dark pill and a text shadow keep the name readable on any picture.
            It lets clicks through, so the camera prompt underneath stays usable. */}
        <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 z-(--layer-tile-tags) flex items-end justify-between gap-2 bg-linear-to-t from-black/70 to-transparent p-3">
          <span className="truncate rounded-md bg-black/60 px-2 py-0.5 text-lg font-semibold text-white backdrop-blur-sm [text-shadow:0_1px_3px_rgb(0_0_0/0.9)]">
            {label}
          </span>
          <span className="flex shrink-0 gap-2">{badges}</span>
        </figcaption>
      </div>
    </figure>
  )
}
