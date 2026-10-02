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
    <section className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/60">
      <header className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Room chat</h2>
        <p className="text-xs text-slate-500">Everyone in the room can chat.</p>
      </header>
      <ul className="flex max-h-64 flex-1 flex-col gap-2 overflow-y-auto px-4 py-3 text-sm">
        {messages.length === 0 && <li className="text-slate-500">No messages yet.</li>}
        {messages.map((message) => (
          <li key={message.id}>
            <span className="font-semibold text-fuchsia-300">{message.senderName}: </span>
            <span className="text-slate-200">{message.content}</span>
          </li>
        ))}
      </ul>
      {error && <p className="px-4 pb-2 text-xs text-rose-400">{error}</p>}
      <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-slate-800 px-4 py-3">
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
