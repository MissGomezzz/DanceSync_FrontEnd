import type { FormEvent } from 'react'
import type { ChatMessage } from '../../../shared/types'
import { Button } from '../../../shared/ui/atoms/Button'
import { Input } from '../../../shared/ui/atoms/Input'

interface ChatPanelViewProps {
  messages: ChatMessage[]
  draft: string
  error: string | null
  sending: boolean
  onDraftChange: (value: string) => void
  onSend: () => void
}

export function ChatPanelView({ messages, draft, error, sending, onDraftChange, onSend }: ChatPanelViewProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSend()
  }

  return (
    <section className="flex flex-col rounded-2xl border border-line bg-surface shadow-soft">
      <header className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Room chat</h2>
        <p className="text-xs text-ink-soft">Everyone in the room can chat.</p>
      </header>
      <ul className="flex max-h-64 flex-1 flex-col gap-2 overflow-y-auto px-4 py-3 text-sm">
        {messages.length === 0 && <li className="text-ink-soft">No messages yet.</li>}
        {messages.map((message) => (
          <li key={message.id}>
            <span className="font-semibold text-secondary-strong">{message.senderName}: </span>
            <span className="text-ink">{message.content}</span>
          </li>
        ))}
      </ul>
      {error && <p className="px-4 pb-2 text-xs text-rose-700">{error}</p>}
      <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-line px-4 py-3">
        <div className="flex-1">
          <Input
            id="chat-draft"
            aria-label="Chat message"
            placeholder="Write a message"
            maxLength={500}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary" disabled={sending || draft.trim().length === 0}>
          Send
        </Button>
      </form>
    </section>
  )
}
