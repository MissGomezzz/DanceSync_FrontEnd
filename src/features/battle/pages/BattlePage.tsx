import { Navigate, useParams } from 'react-router'
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery'
import { useRoom } from '../../rooms/store/roomStore'
import { ChatPanel } from '../../chat/components/ChatPanel'
import { LiveScoreboard } from '../../scoreboard/components/LiveScoreboard'
import { VotePanel } from '../../voting/components/VotePanel'
import { BattleStage } from '../components/BattleStage'
import { PlayersPanel } from '../components/PlayersPanel'

/** Tailwind's `lg` breakpoint: from here up the page has a sidebar. */
const SIDEBAR_QUERY = '(min-width: 1024px)'

export function BattlePage() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const room = useRoom()
  const hasSidebar = useMediaQuery(SIDEBAR_QUERY)

  if (!roomCode) {
    return <Navigate to="/home" replace />
  }

  const code = roomCode.toUpperCase()
  const inBattle = room?.code === code && room.battle !== null && room.status !== 'waiting'
  // The vote and the live ranking belong to a running battle: once it is over
  // the results dashboard replaces them.
  const battling = inBattle && room.status === 'battling'

  return (
    <main className="grid min-h-screen grid-cols-[minmax(0,1fr)] content-start gap-3 p-3 sm:gap-6 sm:p-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      {/*
        On a phone the page is one long column: the vote and the ranking go right
        under the song video, before the camera tiles, so nobody scrolls past every
        camera to vote. With a sidebar they stay at its top.
      */}
      <BattleStage
        roomCode={code}
        songPanels={
          !hasSidebar && battling ? (
            <>
              <VotePanel />
              <LiveScoreboard />
            </>
          ) : null
        }
      />
      <aside className="flex min-w-0 flex-col gap-3 sm:gap-6">
        {hasSidebar && battling && (
          <>
            <LiveScoreboard />
            <VotePanel />
          </>
        )}
        {inBattle && <PlayersPanel />}
        <ChatPanel roomCode={code} />
      </aside>
    </main>
  )
}
