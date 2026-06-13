import { memo } from 'react'
import { Trash2, CornerUpLeft, CheckSquare, User } from 'lucide-react'
import type { Message } from '../../../types/message'

interface ContextMenuProps {
  x: number
  y: number
  msgId: string
  senderId: string
  senderName: string
  selfUserId: string
  messages: Message[]
  onRecall: (msgId: string) => void
  onQuote: (msg: Message) => void
  onSelectMode: (msgId: string) => void
  onAtUser: (senderId: string, senderName: string) => void
  onClose: () => void
}

export const ContextMenu = memo(({
  x,
  y,
  msgId,
  senderId,
  senderName,
  selfUserId,
  messages,
  onRecall,
  onQuote,
  onSelectMode,
  onAtUser,
  onClose,
}: ContextMenuProps) => {
  const handleRecallClick = () => {
    onRecall(msgId)
  }

  const handleQuoteClick = () => {
    const m = messages.find((x) => x.msgId === msgId)
    if (m) onQuote(m)
  }

  const handleSelectModeClick = () => {
    onSelectMode(msgId)
  }

  const handleAtUserClick = () => {
    onAtUser(senderId, senderName)
  }

  return (
    <>
      <div
        className="fixed inset-0 z-45"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault()
          onClose()
        }}
      />
      <div
        className="fixed z-50 bg-[var(--adw-card)] rounded-xl shadow-lg border border-[var(--adw-border)]/[0.2] py-1 w-36 animate-in p-1"
        style={{
          left: Math.min(x, window.innerWidth - 160),
          top: Math.min(y, window.innerHeight - 200),
        }}
      >
        <button
          onClick={handleRecallClick}
          className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer text-left"
        >
          <Trash2 size={13} />
          <span>撤回消息</span>
        </button>
        <button
          onClick={handleQuoteClick}
          className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-[var(--adw-fg)] hover:bg-[var(--adw-hover)] rounded-lg transition-colors cursor-pointer text-left"
        >
          <CornerUpLeft size={13} className="opacity-70" />
          <span>引用消息</span>
        </button>
        <button
          onClick={handleSelectModeClick}
          className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-[var(--adw-fg)] hover:bg-[var(--adw-hover)] rounded-lg transition-colors cursor-pointer text-left"
        >
          <CheckSquare size={13} className="opacity-70" />
          <span>多选</span>
        </button>
        {senderId !== selfUserId && (
          <button
            onClick={handleAtUserClick}
            className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-[var(--adw-fg)] hover:bg-[var(--adw-hover)] rounded-lg transition-colors cursor-pointer text-left"
          >
            <User size={13} className="opacity-70" />
            <span>@{senderName}</span>
          </button>
        )}
      </div>
    </>
  )
})

ContextMenu.displayName = 'ContextMenu'
