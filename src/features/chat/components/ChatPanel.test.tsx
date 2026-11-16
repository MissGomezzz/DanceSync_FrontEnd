import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatMessage } from '../../../shared/types'
import { useAuthStore } from '../../auth/store/authStore'
import { useChatStore } from '../store/chatStore'
import { ChatPanel } from './ChatPanel'
import { ChatPanelView } from './ChatPanelView'

const { emitWithAck } = vi.hoisted(() => ({ emitWithAck: vi.fn() }))

vi.mock('../../../shared/lib/socket', () => ({ emitWithAck }))

const message = (id: string, senderName: string, content: string): ChatMessage => ({
  id,
  roomCode: 'ROOM01',
  senderId: senderName.toLowerCase(),
  senderName,
  content,
  sentAt: '2026-01-01T00:00:00.000Z',
})

describe('ChatPanelView', () => {
  const noop = () => {}

  it('shows an empty state when nobody has written yet', () => {
    render(<ChatPanelView messages={[]} draft="" error={null} sending={false} onDraftChange={noop} onSend={noop} />)
    expect(screen.getByText('No messages yet.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('lists the messages with their sender and shows the error', () => {
    render(
      <ChatPanelView
        messages={[message('1', 'Ana', 'Hello'), message('2', 'Beto', 'Hi!')]}
        draft=""
        error="Could not send"
        sending={false}
        onDraftChange={noop}
        onSend={noop}
      />,
    )
    const items = screen.getAllByRole('listitem').map((item) => item.textContent)
    expect(items).toEqual(['Ana: Hello', 'Beto: Hi!'])
    expect(screen.getByText('Could not send')).toBeTruthy()
  })

  it('reports typing and sends on submit', async () => {
    const onDraftChange = vi.fn()
    const onSend = vi.fn()
    render(<ChatPanelView messages={[]} draft="hey" error={null} sending={false} onDraftChange={onDraftChange} onSend={onSend} />)

    await userEvent.type(screen.getByLabelText('Chat message'), '!')
    expect(onDraftChange).toHaveBeenCalledWith('hey!')

    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('disables sending while a message is on its way', () => {
    render(<ChatPanelView messages={[]} draft="hey" error={null} sending onDraftChange={noop} onSend={noop} />)
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('ChatPanel', () => {
  beforeEach(() => {
    emitWithAck.mockReset()
    useChatStore.getState().clear()
    useAuthStore.setState({ identity: { id: 'ana', displayName: 'Ana' }, session: { kind: 'user' } })
  })

  it('renders the messages of the store', () => {
    useChatStore.getState().addMessage(message('1', 'Beto', 'Ready?'))
    render(<ChatPanel roomCode="ROOM01" />)
    expect(screen.getByText('Ready?')).toBeTruthy()
  })

  it('sends the trimmed message as the current player and clears the draft', async () => {
    emitWithAck.mockResolvedValue(message('1', 'Ana', 'Hello'))
    render(<ChatPanel roomCode="ROOM01" />)
    const input = screen.getByLabelText('Chat message') as HTMLInputElement

    await userEvent.type(input, '  Hello  {enter}')

    expect(emitWithAck).toHaveBeenCalledWith('chat:message', { roomCode: 'ROOM01', senderId: 'ana', content: 'Hello' })
    expect(input.value).toBe('')
  })

  it('keeps the draft and shows the server error when sending fails', async () => {
    emitWithAck.mockRejectedValue(new Error('Too many messages'))
    render(<ChatPanel roomCode="ROOM01" />)
    const input = screen.getByLabelText('Chat message') as HTMLInputElement

    await userEvent.type(input, 'Hello{enter}')

    expect(await screen.findByText('Too many messages')).toBeTruthy()
    expect(input.value).toBe('Hello')
  })

  it('shows a generic error for a non-error rejection', async () => {
    emitWithAck.mockRejectedValue('nope')
    render(<ChatPanel roomCode="ROOM01" />)
    await userEvent.type(screen.getByLabelText('Chat message'), 'Hello{enter}')
    expect(await screen.findByText('Could not send the message')).toBeTruthy()
  })

  it('sends nothing for a blank draft or without an identity', async () => {
    render(<ChatPanel roomCode="ROOM01" />)
    const input = screen.getByLabelText('Chat message')
    await userEvent.type(input, '   {enter}')
    expect(emitWithAck).not.toHaveBeenCalled()

    useAuthStore.setState({ identity: null, session: null })
    await userEvent.type(input, 'Hello{enter}')
    expect(emitWithAck).not.toHaveBeenCalled()
  })

  it('ignores a second send while the first is pending', async () => {
    let resolve: (value: ChatMessage) => void = () => {}
    emitWithAck.mockReturnValue(new Promise((r) => (resolve = r)))
    render(<ChatPanel roomCode="ROOM01" />)
    const input = screen.getByLabelText('Chat message')

    await userEvent.type(input, 'Hello{enter}')
    await userEvent.type(input, '{enter}')

    expect(emitWithAck).toHaveBeenCalledTimes(1)
    resolve(message('1', 'Ana', 'Hello'))
    await screen.findByDisplayValue('')
  })
})
