export type CharStatus = 'correct' | 'incorrect' | 'pending'

export interface CharFeedback {
  char: string
  status: CharStatus
}

export interface TypingFeedback {
  chars: CharFeedback[]
  /** Characters typed beyond the end of the target. */
  extraCount: number
  /** Number of leading characters that already match. */
  correctPrefix: number
  hasError: boolean
  /** Typed text matches the target exactly (the server ignores surrounding spaces). */
  isComplete: boolean
}

/**
 * Compares what the player typed against the phrase, character by character,
 * so the UI can colour correct, wrong and still-pending characters live.
 */
export function compareTyping(target: string, typed: string): TypingFeedback {
  const chars: CharFeedback[] = Array.from(target, (char, i) => ({
    char,
    status: i >= typed.length ? 'pending' : typed[i] === char ? 'correct' : 'incorrect',
  }))
  const extraCount = Math.max(0, typed.length - target.length)
  const firstWrong = chars.findIndex((c) => c.status === 'incorrect')
  const correctPrefix = firstWrong === -1 ? Math.min(typed.length, target.length) : firstWrong
  const hasError = firstWrong !== -1 || extraCount > 0
  return {
    chars,
    extraCount,
    correctPrefix,
    hasError,
    isComplete: typed.trim() === target,
  }
}
