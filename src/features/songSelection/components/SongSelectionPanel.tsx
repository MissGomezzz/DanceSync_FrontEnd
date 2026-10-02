import { useState } from 'react'
import type { Room, SongSelection, SongSubmitOutcome } from '../../../shared/types'
import { Button } from '../../../shared/ui/atoms/Button'
import { useAuthStore } from '../../auth/store/authStore'
import { MIN_PLAYERS_TO_START, useRoomStore } from '../../rooms/store/roomStore'
import { useCountdown } from '../hooks/useCountdown'
import { SongChallengeView } from './SongChallengeView'
import { SongPickerView } from './SongPickerView'

interface SongSelectionPanelProps {
  room: Room
}

/**
 * Lobby step that decides who picks the song: the host starts a typing
 * challenge, the first dancer to type the phrase exactly wins the choice.
 */
export function SongSelectionPanel({ room }: SongSelectionPanelProps) {
  const myId = useAuthStore((state) => state.identity?.id)
  const startSongChallenge = useRoomStore((state) => state.startSongChallenge)
  const chooseSong = useRoomStore((state) => state.chooseSong)
  const [startingChallenge, setStartingChallenge] = useState(false)
  const [choosingSongId, setChoosingSongId] = useState<string | null>(null)
  const selection = room.songSelection

  const handleStartChallenge = async () => {
    if (startingChallenge) return
    setStartingChallenge(true)
    try {
      await startSongChallenge()
    } finally {
      setStartingChallenge(false)
    }
  }

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
      <SongPickerView
        songs={selection.songOptions}
        chooserName={chooser?.displayName ?? 'Another player'}
        chooserReason={selection.chooserReason}
        isChooser={selection.chooserId === myId}
        pendingSongId={choosingSongId}
        onChoose={(songId) => void handleChooseSong(songId)}
      />
    )
  }

  const isHost = room.hostId === myId
  const dancerCount = room.players.filter((p) => p.role === 'dancer').length
  const canStart = dancerCount >= MIN_PLAYERS_TO_START

  return (
    <section
      aria-label="Song"
      className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-6"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Song</h2>
      {room.selectedSong ? (
        <p className="text-lg">
          <span className="font-semibold">{room.selectedSong.title}</span>{' '}
          <span className="text-slate-400">by {room.selectedSong.artist}</span>
        </p>
      ) : (
        <p className="text-sm text-slate-400">No song chosen yet. Win the typing challenge to pick it.</p>
      )}
      {isHost ? (
        <div className="flex items-center gap-3">
          <Button onClick={() => void handleStartChallenge()} disabled={!canStart || startingChallenge}>
            {startingChallenge ? 'Starting...' : room.selectedSong ? 'Pick another song' : 'Start song challenge'}
          </Button>
          {!canStart && (
            <p className="text-sm text-slate-500">At least {MIN_PLAYERS_TO_START} dancers are needed.</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500">The host starts the song challenge.</p>
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
  const remainingMs = useCountdown(challenge.expiresAt)
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
