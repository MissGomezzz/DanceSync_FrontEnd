import { useState } from 'react'
import type { Room, SongSelection, SongSubmitOutcome } from '../../../shared/types'
import { useAuthStore } from '../../auth/store/authStore'
import { useRoomStore } from '../../rooms/store/roomStore'
import { useCountdown, useServerDeadline } from '../../../shared/hooks/useCountdown'
import { SongChallengeView } from './SongChallengeView'
import { SongPickerView, type SongPickerViewProps } from './SongPickerView'

interface SongSelectionPanelProps {
  room: Room
}

/**
 * Lobby step that decides who picks the song. It starts when the host presses
 * "Start battle" (see RoomLobby): the first dancer to type the phrase exactly
 * wins the choice, and the server starts the battle as soon as the song is chosen.
 */
export function SongSelectionPanel({ room }: SongSelectionPanelProps) {
  const myId = useAuthStore((state) => state.identity?.id)
  const chooseSong = useRoomStore((state) => state.chooseSong)
  const [choosingSongId, setChoosingSongId] = useState<string | null>(null)
  const selection = room.songSelection

  const handleChooseSong = async (songId: string) => {
    if (choosingSongId) return
    setChoosingSongId(songId)
    try {
      await chooseSong(songId)
    } finally {
      setChoosingSongId(null)
    }
  }

  if (selection?.phase === 'typing') {
    // Keyed by challenge so typed text resets and the input regains focus each round.
    return <SongChallenge key={selection.challenge.id} selection={selection} myId={myId} />
  }

  if (selection?.phase === 'choosing') {
    const chooser = room.players.find((p) => p.id === selection.chooserId)
    return (
      <SongPicker
        selection={selection}
        songs={selection.songOptions}
        chooserName={chooser?.displayName ?? 'Another player'}
        chooserReason={selection.chooserReason}
        isChooser={selection.chooserId === myId}
        pendingSongId={choosingSongId}
        onChoose={(songId) => void handleChooseSong(songId)}
      />
    )
  }

  return (
    <section
      aria-label="Song"
      className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-6"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Song</h2>
      {room.selectedSong ? (
        <>
          <p className="text-lg">
            <span className="font-semibold">{room.selectedSong.title}</span>{' '}
            <span className="text-slate-400">by {room.selectedSong.artist}</span>
          </p>
          {selection?.autoPicked && (
            <p className="text-sm text-slate-400">Time ran out, a random song was picked.</p>
          )}
        </>
      ) : (
        <p className="text-sm text-slate-400">
          No song chosen yet. When the host starts the battle, the dancers race to type a phrase and the winner picks
          the song.
        </p>
      )}
    </section>
  )
}

interface SongChallengeProps {
  selection: SongSelection
  myId: string | undefined
}

function SongChallenge({ selection, myId }: SongChallengeProps) {
  const submitSongPhrase = useRoomStore((state) => state.submitSongPhrase)
  const [typed, setTyped] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [outcome, setOutcome] = useState<SongSubmitOutcome | null>(null)
  const { challenge } = selection
  // Relative to this payload's arrival, so a skewed browser clock does not matter.
  const deadline = useServerDeadline(challenge.expiresInMs, selection, challenge.expiresAt)
  const remainingMs = useCountdown(deadline)
  // Window length for the progress bar; both dates come from the server clock.
  const totalMs = Date.parse(challenge.expiresAt) - Date.parse(challenge.startedAt)

  const isParticipant = myId !== undefined && selection.participantIds.includes(myId)
  const hasFailed = myId !== undefined && selection.failedIds.includes(myId)
  const timeUp = remainingMs === 0
  const canType = isParticipant && !hasFailed && !timeUp

  const notice = !isParticipant
    ? { tone: 'info' as const, text: 'Only dancers can type the phrase. Watch who wins the song choice!' }
    : outcome === 'incorrect'
      ? { tone: 'error' as const, text: 'Not quite — you used your attempt. The choice passes to the other players.' }
      : outcome === 'expired'
        ? { tone: 'error' as const, text: "Time's up! Your phrase arrived too late." }
        : hasFailed
      ? { tone: 'error' as const, text: 'Incorrect phrase. Your chance to choose passes to the other players.' }
      : timeUp
        ? { tone: 'error' as const, text: "Time's up! The turn passes to another player." }
        : null

  const handleSubmit = async () => {
    setSubmitting(true)
    // The room update that follows switches the view on success, timeout or failure.
    setOutcome(await submitSongPhrase(typed))
    setSubmitting(false)
  }

  return (
    <SongChallengeView
      phrase={challenge.phrase}
      remainingMs={remainingMs}
      totalMs={totalMs}
      typed={typed}
      canType={canType}
      submitting={submitting}
      notice={notice}
      onTypedChange={setTyped}
      onSubmit={() => void handleSubmit()}
    />
  )
}

type SongPickerProps = Omit<SongPickerViewProps, 'remainingMs'> & {
  selection: SongSelection
}

/** Adds the server's pick deadline (when it sends one) to the song picker. */
function SongPicker({ selection, ...viewProps }: SongPickerProps) {
  const deadline = useServerDeadline(selection.chooseExpiresInMs ?? null, selection)
  const remainingMs = useCountdown(deadline)
  return <SongPickerView {...viewProps} remainingMs={deadline === null ? null : remainingMs} />
}
