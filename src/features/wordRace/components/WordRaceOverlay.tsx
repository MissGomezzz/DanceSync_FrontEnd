import { useState } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { useRoomStore } from '../../rooms/store/roomStore'
import { useCountdown } from '../../../shared/hooks/useCountdown'
import { useActiveWordRound, useWordRaceAttempt, useWordRaceResult, useWordRaceStore } from '../store/wordRaceStore'
import { WordRaceBannerView } from './WordRaceBannerView'
import { WordRaceDialogView } from './WordRaceDialogView'

/**
 * Mid-battle word race. Dancers get a full-screen layer with the word and an
 * input; spectators a non-modal banner, so they can keep watching and voting.
 * Events are fed into the store by useWordRaceSync (mounted by the battle
 * stage); this container only reads it.
 */
export function WordRaceOverlay() {
  const round = useActiveWordRound()
  const result = useWordRaceResult()
  const myId = useAuthStore((state) => state.identity?.id ?? null)
  const isDancer = useRoomStore(
    (state) => myId !== null && (state.room?.battle?.dancerIds.includes(myId) ?? false),
  )
  const { submitting, lastAttempt } = useWordRaceAttempt()
  const submitWord = useWordRaceStore((state) => state.submitWord)
  const clearAttempt = useWordRaceStore((state) => state.clearAttempt)
  const remainingMs = useCountdown(round?.deadline ?? null)
  // Tagged with its round, so the typed text starts empty again every round.
  const [draft, setDraft] = useState<{ roundId: string | null; text: string }>({ roundId: null, text: '' })

  if (!round && !result) return null

  const roundView = round && {
    roundId: round.roundId,
    word: round.word,
    roundNumber: round.roundNumber,
    totalRounds: round.totalRounds,
    remainingMs,
    totalMs: round.totalMs,
  }

  if (!isDancer) return <WordRaceBannerView round={roundView} result={result} />

  const typed = round && draft.roundId === round.roundId ? draft.text : ''

  const handleTypedChange = (value: string) => {
    setDraft({ roundId: round?.roundId ?? null, text: value })
    if (lastAttempt) clearAttempt()
  }

  const handleSubmit = () => {
    if (myId) void submitWord(typed, myId)
  }

  return (
    <WordRaceDialogView
      round={roundView}
      result={result}
      typed={typed}
      submitting={submitting}
      notice={lastAttempt === 'incorrect' ? 'Not quite, try again' : null}
      onTypedChange={handleTypedChange}
      onSubmit={handleSubmit}
    />
  )
}
