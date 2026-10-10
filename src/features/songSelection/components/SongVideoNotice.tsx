interface SongVideoNoticeProps {
  message: string
}

/**
 * Calm notice drawn in the song area when the music video cannot play there.
 * The battle itself goes on, so this is not an error banner.
 */
export function SongVideoNotice({ message }: SongVideoNoticeProps) {
  return (
    <div className="flex aspect-video w-full items-center justify-center bg-slate-950 p-6">
      <p role="note" className="max-w-md rounded-xl border border-slate-700 bg-slate-900/80 px-5 py-4 text-center text-sm text-slate-300">
        {message}
      </p>
    </div>
  )
}
