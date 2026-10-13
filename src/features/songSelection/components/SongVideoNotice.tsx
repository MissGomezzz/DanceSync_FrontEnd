interface SongVideoNoticeProps {
  message: string
}

/**
 * Calm notice drawn in the song area when the music video cannot play there.
 * The battle itself goes on, so this is not an error banner.
 */
export function SongVideoNotice({ message }: SongVideoNoticeProps) {
  return (
    <div className="flex aspect-video w-full items-center justify-center bg-black p-6">
      <p role="note" className="max-w-md rounded-xl border border-white/15 bg-white/10 px-5 py-4 text-center text-sm text-white/90 backdrop-blur-sm">
        {message}
      </p>
    </div>
  )
}
