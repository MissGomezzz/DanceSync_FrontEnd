import type { ChooserReason, Song } from '../../../shared/types'
import { Button } from '../../../shared/ui/atoms/Button'

interface SongPickerViewProps {
  songs: Song[]
  chooserName: string
  chooserReason: ChooserReason | null
  isChooser: boolean
  /** Song sent with song:choose and waiting for the server; every button is disabled meanwhile. */
  pendingSongId?: string | null
  onChoose: (songId: string) => void
}

const reasonLabels: Record<ChooserReason, string> = {
  typed: 'typed the phrase first',
  timeout: 'got the turn because time ran out',
  'all-failed': 'got the turn because nobody typed it correctly',
  'chooser-left': 'got the turn because the previous chooser left',
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

export function SongPickerView({
  songs,
  chooserName,
  chooserReason,
  isChooser,
  pendingSongId = null,
  onChoose,
}: SongPickerViewProps) {
  const reason = chooserReason ? reasonLabels[chooserReason] : null

  return (
    <section
      aria-label="Choose the song"
      className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-6"
    >
      <h2 className="text-lg font-semibold">
        {isChooser ? 'You won! Choose the song to dance' : `${chooserName} is choosing the song...`}
      </h2>
      {reason && (
        <p className="text-sm text-slate-400">
          {isChooser ? 'You' : chooserName} {reason}.
        </p>
      )}
      {isChooser && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {songs.map((song) => (
            <li key={song.id}>
              <Button
                variant="secondary"
                className="w-full flex-col items-start! text-left"
                disabled={pendingSongId !== null}
                aria-busy={pendingSongId === song.id}
                onClick={() => onChoose(song.id)}
              >
                <span>{song.title}</span>
                <span className="text-xs font-normal text-slate-400">
                  {song.artist} · {formatDuration(song.durationSeconds)}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
