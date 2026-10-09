import { useEffect, useState } from 'react'
import { fetchMatchResults, type MatchResults } from '../api/matchesApi'

interface Fetched {
  matchId: string
  results: MatchResults | null
}

export interface MatchResultsState {
  results: MatchResults | null
  loading: boolean
  failed: boolean
}

/**
 * Loads the stored results of `matchId` from the results endpoint; pass null to
 * skip it (the room payload already carries them). Loading is derived from
 * which match was last fetched, so no state is set synchronously in the effect.
 */
export function useMatchResults(matchId: string | null): MatchResultsState {
  const [fetched, setFetched] = useState<Fetched | null>(null)

  useEffect(() => {
    if (!matchId) return
    const controller = new AbortController()
    fetchMatchResults(matchId, controller.signal)
      .then((results) => setFetched({ matchId, results }))
      .catch(() => {
        if (!controller.signal.aborted) setFetched({ matchId, results: null })
      })
    return () => controller.abort()
  }, [matchId])

  if (!matchId) return { results: null, loading: false, failed: false }
  const current = fetched?.matchId === matchId ? fetched : null
  return { results: current?.results ?? null, loading: current === null, failed: current !== null && !current.results }
}
