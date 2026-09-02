import { useState } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { useChatStore } from '../store/chatStore'
import { ChatPanelView } from './ChatPanelView'

interface ChatPanelProps {
  roomId: string
}

export function ChatPanel({ roomId }: ChatPanelProps) {
  const [draft, setDraft] = useState('')
  const messages = useChatStore((state) => state.messages)
  const addMessage = useChatStore((state) => state.addMessage)
  const user = useAuthStore((state) => state.user)

  const handleSend = () => {
    const content = draft.trim()
    if (content.length === 0) return

    // Messages will be emitted through the shared socket once the chat service is available.
    addMessage({
      id: crypto.randomUUID(),
      roomId,
      authorId: user?.id ?? 'anonymous',
      authorName: user?.displayName ?? 'Guest',
      content,
      sentAt: new Date().toISOString(),
    })
    setDraft('')
  }

  return <ChatPanelView messages={messages} draft={draft} onDraftChange={setDraft} onSend={handleSend} />
}
