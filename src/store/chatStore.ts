import { create } from 'zustand'
import type { Message } from '../types/message'

interface ChatItem {
  chatId: string
  chatType: number
  name: string
  avatarUrl: string
  lastMsg: string
  unread: number
  remark: string
  doNotDisturb: boolean
  sendTimestamp: number
}

interface ChatState {
  conversations: ChatItem[]
  currentChatId: string | null
  currentChatType: number | null
  currentMessages: Message[]
  setConversations: (list: ChatItem[]) => void
  setCurrentChat: (chatId: string, chatType: number) => void
  updateConversation: (chatId: string, updates: Partial<ChatItem>) => void
  addMessage: (msg: Message) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  currentChatId: null,
  currentChatType: null,
  currentMessages: [],

  setConversations: (list) => set({ conversations: list }),

  setCurrentChat: (chatId, chatType) =>
    set({ currentChatId: chatId, currentChatType: chatType, currentMessages: [] }),

  updateConversation: (chatId, updates) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.chatId === chatId ? { ...c, ...updates } : c
      ),
    })),

  addMessage: (msg) =>
    set((state) => ({
      currentMessages: [...state.currentMessages, msg],
    })),

  clearMessages: () => set({ currentMessages: [] }),
}))