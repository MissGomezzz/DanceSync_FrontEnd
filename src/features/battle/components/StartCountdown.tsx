import { useState } from 'react'
import { useCountdown } from '../../../shared/hooks/useCountdown'
import type { Battle } from '../../../shared/types'
import { StartCountdownView } from './StartCountdownView'

/** How long "Dance!" stays on screen once the music starts. */
export const DANCE_CUE_MS = 700
/** The numerals cover the last three seconds; "Get ready" shows before them. */
const NUMERAL_SECONDS = 3

interface StartCountdownProps {
  /** The running battle of this room; null when there is none or it is not battling. */
  battle: Battle | null
  /**
   * performance.now() timestamp at which the song starts, the same value the
   * song player uses (from the server-relative startsInMs), so the countdown
   * ends exactly when the music begins.
   */
  startAt: number | null
}

/**
 * Full-screen "Get ready", 3, 2, 1, "Dance!" before the song starts, for
 * everyone in the room. Only a battle first seen before its start counts down:
 * reopening the page mid-battle shows nothing.
 */
export function StartCountdown({ battle, startAt }: StartCountdownProps) {
  const [countdown, setCountdown] = useState<{ battleId: string | null; done: boolean }>({ battleId: null, done: true })

  // Armed when a battle arrives that has not started yet (adjusting state while rendering).
  if (battle && battle.id !== countdown.battleId && (battle.startsInMs ?? 0) > 0) {
    setCountdown({ battleId: battle.id, done: false })
  }

  const active = battle !== null && battle.id === countdown.battleId && !countdown.done && startAt !== null
  // Runs past the start by DANCE_CUE_MS, so "Dance!" stays up a moment after the music starts.
  const remainingMs = useCountdown(active ? startAt + DANCE_CUE_MS : null)

  if (active && remainingMs === 0) setCountdown({ battleId: battle.id, done: true })
  if (!active || remainingMs === 0) return null

  return <StartCountdownView step={stepAt(remainingMs - DANCE_CUE_MS)} />
}

/** What the countdown shows `msToStart` milliseconds before the song starts. */
function stepAt(msToStart: number): string {
  if (msToStart <= 0) return 'Dance!'
  if (msToStart > NUMERAL_SECONDS * 1000) return 'Get ready'
  return String(Math.ceil(msToStart / 1000))
}
