import { create } from 'zustand'
import type { ChatMessage } from '../../../shared/types'

interface ChatState {
  messages: ChatMessage[]
  addMessage: (message: ChatMessage) => void
  clear: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  clear: () => set({ messages: [] }),
}))
