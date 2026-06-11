import { memo } from 'react'
import { ShieldAlert, Shield } from 'lucide-react'
import type { Message } from '../../../types/message'
import { resolveMediaUrl } from '../../../store/settingsStore'
import Avatar from '../Avatar'
import { MessageContent } from './MessageContent'

interface MessageItemProps {
  msg: Message
  selfUserId: string
  isSameUser: boolean
  isSelected: boolean
  isOwner: boolean
  isAdmin: boolean
  timeStr: string
  selectMode: boolean
  chatId: string
  chatType: number
  onContextMenu: (e: React.MouseEvent, msg: Message) => void
  onTouchStart: () => void
  onTouchEnd: (e: React.TouchEvent, msg: Message) => void
  onDoubleClick: (msg: Message) => void
  onSelectToggle: (msgId: string) => void
  onAtUser: (senderId: string, senderName: string) => void
  onStickerPreview: (packId: number) => void
}

export const MessageItem = memo(({
  msg,
  selfUserId,
  isSameUser,
  isSelected,
  isOwner,
  isAdmin,
  timeStr,
  selectMode,
  chatId,
  chatType,
  onContextMenu,
  onTouchStart,
  onTouchEnd,
  onDoubleClick,
  onSelectToggle,
  onAtUser,
  onStickerPreview,
}: MessageItemProps) => {
  const isOwn = msg.senderId === selfUserId

  return (
    <div
      className={`flex group transition-all ${
        isSameUser ? 'mt-1' : 'mt-6'
      } ${
        isSelected ? 'bg-black/[0.05] dark:bg-white/[0.08] rounded-2xl px-3 py-1.5 -mx-3 -my-1.5' : ''
      }`}
      onContextMenu={(e) => onContextMenu(e, msg)}
      onTouchStart={onTouchStart}
      onTouchEnd={(e) => onTouchEnd(e, msg)}
      onDoubleClick={() => onDoubleClick(msg)}
    >
      {/* Left Side: Avatar or timestamp on hover */}
      <div className="w-14 shrink-0 flex flex-col items-center select-none">
        {!isSameUser ? (
          <Avatar
            src={msg.senderAvatar ? resolveMediaUrl(msg.senderAvatar) : undefined}
            name={msg.senderName}
            isGroup={true}
            sizeClass="w-10 h-10"
            isOwn={isOwn}
            className="cursor-pointer"
          />
        ) : (
          <span className="text-[10px] opacity-0 group-hover:opacity-30 transition-opacity mt-1 select-none text-[var(--adw-fg-dim)]">
            {timeStr}
          </span>
        )}
      </div>

      {/* Right Side: Header and Content */}
      <div className="flex-1 min-w-0 pr-12">
        {!isSameUser && (
          <div className="flex items-baseline gap-2 mb-1">
            <span
              className={`text-sm font-bold hover:underline cursor-pointer ${
                isOwn ? 'text-[var(--adw-accent)]' : 'text-emerald-600'
              }`}
              onClick={() => onAtUser(msg.senderId, msg.senderName)}
            >
              {msg.senderName}
              {isOwner && (
                <ShieldAlert size={10} className="inline ml-1 text-yellow-500" />
              )}
              {isAdmin && (
                <Shield size={10} className="inline ml-1 text-blue-500" />
              )}
            </span>
            <span className="text-[10px] opacity-30 font-medium text-[var(--adw-fg-dim)]">
              {timeStr}
            </span>
          </div>
        )}

        {/* Quoted Message details */}
        {msg.quoteMsgText ? (
          <div className="text-[11px] text-[var(--adw-fg-dim)] bg-[var(--adw-card)] border border-[var(--adw-border)]/[0.2] rounded-lg px-3 py-1.5 my-1 truncate max-w-[280px] border-l-2 border-l-[var(--adw-blue)] shadow-xs">
            {msg.quoteMsgText}
          </div>
        ) : msg.quoteImageUrl ? (
          <div className="my-1">
            <img
              src={resolveMediaUrl(msg.quoteImageUrl)}
              alt="引用图片"
              className="max-w-[120px] max-h-[80px] rounded-lg object-cover border border-[var(--adw-border)]/[0.2] shadow-xs"
            />
          </div>
        ) : msg.quoteVideoUrl ? (
          <div className="my-1">
            <video
              src={resolveMediaUrl(msg.quoteVideoUrl)}
              className="max-w-[120px] max-h-[80px] rounded-lg object-cover border border-[var(--adw-border)]/[0.2] shadow-xs"
              muted
            />
          </div>
        ) : null}

        {/* Main Message Content */}
        <div className="text-[13.5px] leading-relaxed opacity-90 dark:opacity-100 break-words text-[var(--adw-fg)]">
          <MessageContent
            msg={msg}
            selfUserId={selfUserId}
            chatId={chatId}
            chatType={chatType}
            openStickerPreview={onStickerPreview}
          />
        </div>
      </div>

      {/* Selection Checkbox */}
      {selectMode && (
        <div className="self-center shrink-0 pr-2" onClick={() => onSelectToggle(msg.msgId)}>
          <div
            className={`w-4 h-4 rounded-full border flex items-center justify-center cursor-pointer transition-colors ${
              isSelected
                ? 'bg-[var(--adw-blue)] border-[var(--adw-blue)] text-white'
                : 'border-[var(--adw-border)] bg-[var(--adw-view)]'
            }`}
          >
            {isSelected && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        </div>
      )}
    </div>
  )
})

MessageItem.displayName = 'MessageItem'
