import type { ChooserReason, Song } from '../../../shared/types'
import { Button } from '../../../shared/ui/atoms/Button'

export interface SongPickerViewProps {
  songs: Song[]
  chooserName: string
  chooserReason: ChooserReason | null
  isChooser: boolean
  /** Song sent with song:choose and waiting for the server; every button is disabled meanwhile. */
  pendingSongId?: string | null
  /** Time left to pick before the server picks a random song; null when there is no deadline. */
  remainingMs?: number | null
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
  remainingMs = null,
  onChoose,
}: SongPickerViewProps) {
  const reason = chooserReason ? reasonLabels[chooserReason] : null
  const seconds = remainingMs === null ? null : Math.ceil(remainingMs / 1000)
  const heading = isChooser
    ? 'You won! Choose the song to dance'
    : seconds === null
      ? `${chooserName} is choosing the song...`
      : `${chooserName} is choosing the song — ${seconds}s`

  return (
    <section
      aria-label="Choose the song"
      className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-6"
    >
      <h2 className="text-lg font-semibold">{heading}</h2>
      {isChooser && seconds !== null && (
        <p role="timer" aria-label="Time left to choose" className="text-sm text-slate-300">
          Pick within <span className="font-mono font-semibold tabular-nums">{seconds}s</span> or a random song is
          chosen.
        </p>
      )}
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
