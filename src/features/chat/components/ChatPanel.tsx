import { useState } from 'react'
import { emitWithAck } from '../../../shared/lib/socket'
import type { ChatMessage } from '../../../shared/types'
import { useAuthStore } from '../../auth/store/authStore'
import { useChatStore } from '../store/chatStore'
import { ChatPanelView } from './ChatPanelView'

interface ChatPanelProps {
  roomCode: string
}

export function ChatPanel({ roomCode }: ChatPanelProps) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const messages = useChatStore((state) => state.messages)

  const handleSend = async () => {
    const content = draft.trim()
    if (content.length === 0 || sending) return

    const identity = useAuthStore.getState().ensureIdentity()
    setSending(true)
    try {
      // The server broadcasts the message back to everyone in the room,
      // including the sender, so nothing is appended locally here.
      await emitWithAck<ChatMessage>('chat:message', {
        roomCode,
        senderId: identity.id,
        content,
      })
      setDraft('')
      setError(null)
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Could not send the message')
    } finally {
      setSending(false)
    }
  }

  return (
    <ChatPanelView
      messages={messages}
      draft={draft}
      error={error}
      sending={sending}
      onDraftChange={setDraft}
      onSend={() => void handleSend()}
    />
  )
}
