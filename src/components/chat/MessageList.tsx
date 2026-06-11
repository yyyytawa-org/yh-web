import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { getMessages, recallMessage, batchRecallMessages } from '../../api/message'
import { useChatStore } from '../../store/chatStore'
import { useAuthStore } from '../../store/authStore'
import { parseMessage, CONTENT_TYPE, type Message, type QuoteMsg } from '../../types/message'
import { useDebouncedCallback } from '../../hooks/useDebounce'
import { MessageSquare } from 'lucide-react'

// Sub-components
import { MessageItem } from './messagelist/MessageItem'
import { ContextMenu } from './messagelist/ContextMenu'
import { StickerPreviewModal } from './messagelist/StickerPreviewModal'

interface MessageListProps {
  adminIds: Set<string>
  ownerId: string
  onQuote: (q: QuoteMsg | null) => void
  quoteMsg: QuoteMsg | null
}

export default function MessageList({ adminIds, ownerId, onQuote }: MessageListProps) {
  const { currentChatId, currentChatType, currentMessages } = useChatStore()
  const selfUserId = useAuthStore((s) => s.userId) || ''
  const [historyMessages, setHistoryMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const virtuosoRef = useRef<any>(null)
  const prevChatId = useRef<string | null>(null)

  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; msgId: string; senderId: string; senderName: string; direction: string } | null>(null)
  const [stickerPackId, setStickerPackId] = useState<number | null>(null)

  // Virtuoso index offset for prepending items smoothly
  const [firstItemIndex, setFirstItemIndex] = useState(10000)

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMobile = useRef(false)
  useEffect(() => {
    isMobile.current = 'ontouchstart' in window
  }, [])

  // Deduplicate and merge history messages and current active chat messages
  const messages = useMemo(() => {
    const existingIds = new Set(historyMessages.map((m) => m.msgId))
    const newMsgs = currentMessages.filter((m) => !existingIds.has(m.msgId))
    return [...historyMessages, ...newMsgs]
  }, [historyMessages, currentMessages])

  // Core message loading function
  const loadMessages = useCallback(async (signal?: AbortSignal) => {
    if (!currentChatId || currentChatType == null || loading) return
    setLoading(true)
    try {
      const firstMsg = historyMessages[0]
      const resp = await getMessages(currentChatId, currentChatType, 30, firstMsg?.msgId, signal)
      const rawMsgs = resp.msg || []
      
      if (rawMsgs.length < 30) {
        setHasMore(false)
      }
      
      const msgs: Message[] = [...rawMsgs].reverse().map((m: any) => parseMessage(m, selfUserId))
      
      if (firstMsg) {
        setFirstItemIndex((prev) => prev - msgs.length)
        setHistoryMessages((prev) => [...msgs, ...prev])
      } else {
        setFirstItemIndex(10000 - msgs.length)
        setHistoryMessages(msgs)
        // Scroll to bottom on initial load
        setTimeout(() => {
          virtuosoRef.current?.scrollToIndex({
            index: 10000 - 1,
            behavior: 'auto',
          })
        }, 100)
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('加载消息失败:', err)
      }
    } finally {
      setLoading(false)
    }
  }, [currentChatId, currentChatType, historyMessages, loading, selfUserId])

  // Debounced load more to prevent network request thrashing on fast scrolls
  const debouncedLoadMessages = useDebouncedCallback((signal?: AbortSignal) => {
    if (!loading && hasMore) {
      loadMessages(signal)
    }
  }, 200)

  // Reset chat states when switching chat conversations
  useEffect(() => {
    if (prevChatId.current !== currentChatId) {
      prevChatId.current = currentChatId
      setHistoryMessages([])
      setHasMore(true)
      setSelectMode(false)
      setSelectedIds(new Set())
      setFirstItemIndex(10000)
    }
  }, [currentChatId])

  // Trigger initial messages load
  useEffect(() => {
    if (!currentChatId) return
    const abortController = new AbortController()

    if (historyMessages.length === 0) {
      loadMessages(abortController.signal)
    }

    return () => {
      abortController.abort()
    }
  }, [currentChatId, historyMessages.length, loadMessages])

  // Scroll to bottom on new incoming messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        virtuosoRef.current?.scrollToIndex({
          index: firstItemIndex + messages.length - 1,
          behavior: 'smooth',
        })
      }, 50)
    }
  }, [currentMessages.length]) // Scroll smoothly only on active list updates

  const formatTime = (ms: number) => {
    if (!ms) return ''
    const d = new Date(ms)
    if (isNaN(d.getTime())) return ''
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  const handleContextMenu = useCallback((e: React.MouseEvent, msg: Message) => {
    if (!currentChatId || currentChatType == null) return
    if (selectMode) {
      e.preventDefault()
      toggleSelect(msg.msgId)
      return
    }
    if (!isMobile.current && e.ctrlKey) return
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      msgId: msg.msgId,
      senderId: msg.senderId,
      senderName: msg.senderName,
      direction: msg.direction,
    })
  }, [currentChatId, currentChatType, selectMode])

  const handleTouchStart = useCallback(() => {
    if (!selectMode) {
      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null
      }, 500)
    }
  }, [selectMode])

  const handleTouchEnd = useCallback((e: React.TouchEvent, msg: Message) => {
    if (selectMode) {
      toggleSelect(msg.msgId)
      return
    }
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
      const touch = e.changedTouches[0]
      setContextMenu({
        x: touch.clientX,
        y: touch.clientY,
        msgId: msg.msgId,
        senderId: msg.senderId,
        senderName: msg.senderName,
        direction: msg.direction,
      })
    }
  }, [selectMode])

  const toggleSelect = useCallback((msgId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(msgId)) {
        next.delete(msgId)
      } else {
        next.add(msgId)
      }
      if (next.size === 0) {
        setSelectMode(false)
      }
      return next
    })
  }, [])

  const handleRecall = useCallback(async (msgId: string) => {
    if (!currentChatId || currentChatType == null) return
    try {
      await recallMessage(msgId, currentChatId, currentChatType)
    } catch (err) {
      console.error('撤回失败:', err)
    }
    setContextMenu(null)
  }, [currentChatId, currentChatType])

  const handleBatchRecall = useCallback(async () => {
    if (!currentChatId || currentChatType == null) return
    const ids = Array.from(selectedIds)
    try {
      for (let i = 0; i < ids.length; i += 10) {
        await batchRecallMessages(ids.slice(i, i + 10), currentChatId, currentChatType)
      }
    } catch (err) {
      console.error('批量撤回失败:', err)
    }
    setSelectedIds(new Set())
    setSelectMode(false)
    setContextMenu(null)
  }, [currentChatId, currentChatType, selectedIds])

  const handleQuote = useCallback((msg: Message) => {
    const quote: QuoteMsg = { msgId: msg.msgId, text: '' }
    switch (msg.contentType) {
      case CONTENT_TYPE.IMAGE:
        quote.quoteImageUrl = msg.imageUrl
        quote.quoteImageName = msg.imageUrl.split('/').pop() || 'image'
        break
      case CONTENT_TYPE.VIDEO:
        quote.quoteVideoUrl = msg.videoUrl
        quote.quoteVideoTime = 0
        break
      case CONTENT_TYPE.FILE:
        quote.text = `${msg.senderName}: [文件] ${msg.fileName}`
        break
      case CONTENT_TYPE.AUDIO:
        quote.text = `${msg.senderName}: [语音]`
        break
      default:
        quote.text = `${msg.senderName}: ${msg.content}`
    }
    onQuote(quote)
    setContextMenu(null)
  }, [onQuote])

  const handleAtUser = useCallback((senderId: string, senderName: string) => {
    setContextMenu(null)
    window.dispatchEvent(new CustomEvent('at-user', { detail: { userId: senderId, name: senderName } }))
  }, [])

  const handleDoubleClick = useCallback((msg: Message) => {
    if (!selectMode) {
      setSelectMode(true)
      toggleSelect(msg.msgId)
    }
  }, [selectMode, toggleSelect])

  const handleStartReached = useCallback(() => {
    if (!loading && hasMore) {
      debouncedLoadMessages()
    }
  }, [loading, hasMore, debouncedLoadMessages])

  const handleStickerPreview = useCallback((packId: number) => {
    setStickerPackId(packId)
  }, [])

  if (!currentChatId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--adw-window)]">
        <div className="text-center opacity-40">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[var(--adw-card)] border border-[var(--adw-border)]/[0.2] flex items-center justify-center">
            <MessageSquare size={28} />
          </div>
          <p className="text-xs">选择一个会话开始聊天</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {selectMode && (
        <div className="px-4 py-2 bg-[var(--adw-selected)] border-b border-[var(--adw-border)]/[0.2] flex items-center gap-3 text-xs shrink-0 z-10">
          <span className="font-bold text-[var(--adw-blue)]">已选 {selectedIds.size} 条消息</span>
          <div className="flex-1" />
          <button
            onClick={handleBatchRecall}
            className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold cursor-pointer transition-colors shadow-xs"
          >
            批量撤回
          </button>
          <button
            onClick={() => {
              setSelectMode(false)
              setSelectedIds(new Set())
            }}
            className="px-3 py-1 bg-[var(--adw-view)] hover:bg-[var(--adw-hover)] text-[var(--adw-fg)] border border-[var(--adw-border)]/[0.2] rounded-lg font-semibold cursor-pointer transition-colors shadow-xs"
          >
            取消
          </button>
        </div>
      )}

      <div className="flex-1 relative bg-[var(--adw-window)] overflow-hidden">
        <Virtuoso
          ref={virtuosoRef}
          style={{ height: '100%' }}
          data={messages}
          firstItemIndex={firstItemIndex}
          startReached={handleStartReached}
          itemContent={(index, msg) => {
            const isOwn = msg.senderId === selfUserId
            const prevMsg = index !== 0 ? messages[index - 1] : null
            const isSameUser = !!(prevMsg && prevMsg.senderId === msg.senderId && msg.sendTime - prevMsg.sendTime < 5 * 60 * 1000)
            const isSelected = selectedIds.has(msg.msgId)
            const isMsgOwner = ownerId === msg.senderId
            const isMsgAdmin = adminIds.has(msg.senderId) && !isMsgOwner
            const timeStr = formatTime(msg.sendTime)

            return (
              <MessageItem
                msg={msg}
                selfUserId={selfUserId}
                isSameUser={isSameUser}
                isSelected={isSelected}
                isOwner={isMsgOwner}
                isAdmin={isMsgAdmin}
                timeStr={timeStr}
                selectMode={selectMode}
                chatId={currentChatId}
                chatType={currentChatType}
                onContextMenu={handleContextMenu}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onDoubleClick={handleDoubleClick}
                onSelectToggle={toggleSelect}
                onAtUser={handleAtUser}
                onStickerPreview={handleStickerPreview}
              />
            )
          }}
          components={{
            Header: () => (
              <>
                {loading && hasMore && (
                  <div className="flex justify-center py-4 shrink-0">
                    <div className="w-5 h-5 border-2 border-[var(--adw-blue)]/20 border-t-[var(--adw-blue)] rounded-full animate-spin" />
                  </div>
                )}
                {!hasMore && messages.length > 0 && (
                  <div className="text-center text-[var(--adw-fg-dim)] text-[10px] opacity-40 tracking-wider py-4 shrink-0 font-bold uppercase">
                    — 已经到达聊天起点 —
                  </div>
                )}
              </>
            ),
            Footer: () => <div className="h-28 shrink-0" />,
          }}
        />
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          msgId={contextMenu.msgId}
          senderId={contextMenu.senderId}
          senderName={contextMenu.senderName}
          selfUserId={selfUserId}
          messages={messages}
          onRecall={handleRecall}
          onQuote={handleQuote}
          onSelectMode={(id) => {
            setSelectMode(true)
            toggleSelect(id)
            setContextMenu(null)
          }}
          onAtUser={handleAtUser}
          onClose={() => setContextMenu(null)}
        />
      )}

      {stickerPackId !== null && (
        <StickerPreviewModal packId={stickerPackId} onClose={() => setStickerPackId(null)} />
      )}
    </>
  )
}