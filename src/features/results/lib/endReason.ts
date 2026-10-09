import type { BattleEndReason } from '../../../shared/types'

const endReasonCopy: Record<BattleEndReason, string> = {
  'song-end': 'The song ended',
  'not-enough-dancers': 'Not enough dancers left',
}

/** Why the battle finished, in plain words; null when the server did not say. */
export function endReasonText(reason: BattleEndReason | null | undefined): string | null {
  return reason ? (endReasonCopy[reason] ?? null) : null
}
