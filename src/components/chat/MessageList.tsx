import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { getMessages, reportButtonClick, recallMessage, batchRecallMessages } from '../../api/message'
import { getStickerDetail, addStickerPack } from '../../api/sticker'
import { getUserInfo } from '../../api/user'
import { useChatStore } from '../../store/chatStore'
import { useAuthStore } from '../../store/authStore'
import { resolveMediaUrl } from '../../store/settingsStore'
import { CONTENT_TYPE, parseMessage, type Message, type QuoteMsg } from '../../types/message'

const FILE_TYPE_CONFIG: Record<string, { color: string; iconUrl?: string }> = {
  pdf: { color: '#ef4444' }, doc: { color: '#3b82f6' }, docx: { color: '#3b82f6' }, xls: { color: '#22c55e' }, xlsx: { color: '#22c55e' },
  ppt: { color: '#f97316' }, pptx: { color: '#f97316' }, zip: { color: '#a855f7' }, rar: { color: '#a855f7' }, '7z': { color: '#a855f7' },
  tar: { color: '#a855f7' }, gz: { color: '#a855f7' }, txt: { color: '#6b7280' }, md: { color: '#6b7280' }, json: { color: '#f59e0b' },
  js: { color: '#f59e0b' }, ts: { color: '#3b82f6' }, py: { color: '#22c55e' }, java: { color: '#ef4444' }, html: { color: '#f97316' },
  css: { color: '#3b82f6' }, mp3: { color: '#ec4899' }, wav: { color: '#ec4899' }, flac: { color: '#ec4899' }, mp4: { color: '#8b5cf6' },
  avi: { color: '#8b5cf6' }, mkv: { color: '#8b5cf6' }, mov: { color: '#8b5cf6' }, png: { color: '#14b8a6' }, jpg: { color: '#14b8a6' },
  jpeg: { color: '#14b8a6' }, gif: { color: '#14b8a6' }, webp: { color: '#14b8a6' }, svg: { color: '#14b8a6' }, apk: { color: '#84cc16' },
  exe: { color: '#64748b' }, dmg: { color: '#64748b' }, iso: { color: '#64748b' },
}

function getFileExtension(name: string): string { const parts = name.split('.'); return parts.length > 1 ? parts.pop()!.toLowerCase() : '' }
function getFileConfig(name: string) { const ext = getFileExtension(name); return FILE_TYPE_CONFIG[ext] ?? { color: '#9ca3af' } }

function Avatar({ src, name, isRight, size }: { src: string; name: string; isRight: boolean; size: 'sm' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'w-12 h-12 text-lg' : 'w-9 h-9 text-xs'
  return (
    <div className={`${sizeClass} rounded-full bg-gray-300 shrink-0 overflow-hidden flex items-center justify-center`}>
      {src ? <img src={resolveMediaUrl(src)} alt="" className="w-full h-full object-cover" /> : (
        <div className={`w-full h-full flex items-center justify-center text-white font-medium ${isRight ? 'bg-gradient-to-br from-green-400 to-green-500' : 'bg-gradient-to-br from-blue-400 to-blue-500'}`}>{name[0] || '?'}</div>
      )}
    </div>
  )
}

function renderButtons(buttonsJson: string, isRight: boolean, msgId: string, chatId: string, chatType: number, userId: string) {
  try {
    const rows = JSON.parse(buttonsJson)
    if (!Array.isArray(rows) || rows.length === 0) return null
    return (
      <div className={`mt-1.5 space-y-1 ${isRight ? 'items-end' : 'items-start'} flex flex-col`}>
        {rows.map((row: any[], ri: number) => (
          <div key={ri} className="flex gap-1 flex-wrap">
            {row.map((btn: any, bi: number) => (
              <button key={bi} onClick={async () => {
                const btnValue = btn.actionType === 1 ? (btn.url || '') : (btn.value || '')
                reportButtonClick(msgId, chatId, chatType, userId, btnValue).catch(() => {})
                if (btn.actionType === 1 && btn.url) window.open(btn.url, '_blank', 'noopener,noreferrer')
                else if (btn.actionType === 2 && btn.value) navigator.clipboard.writeText(btn.value)
              }} className={`px-3 py-1 rounded-lg text-xs border transition-colors ${isRight ? 'bg-white/20 border-white/30 text-white hover:bg-white/30' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                {btn.text || ''}
              </button>
            ))}
          </div>
        ))}
      </div>
    )
  } catch { return null }
}

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
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const shouldScrollToBottom = useRef(false)
  const prevChatId = useRef<string | null>(null)

  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; msgId: string; senderId: string; senderName: string; direction: string } | null>(null)

  const [stickerPreview, setStickerPreview] = useState<{ packId: number; packName?: string; authorId?: string; authorName?: string; authorAvatar?: string; stickerCount?: number; stickers: any[] } | null>(null)
  const [addingSticker, setAddingSticker] = useState(false)
  const [addMsg, setAddMsg] = useState('')
  const [addMsgType, setAddMsgType] = useState<'success' | 'error' | ''>('')
  const [showAuthorInfo, setShowAuthorInfo] = useState(false)
  const [authorInfo, setAuthorInfo] = useState<{ name: string; avatarUrl: string; registerTime: string; onlineDay: number; isVip: boolean } | null>(null)
  const [loadingAuthor, setLoadingAuthor] = useState(false)

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMobile = useRef(false)
  useEffect(() => { isMobile.current = 'ontouchstart' in window }, [])

  const messages = useMemo(() => {
    const existingIds = new Set(historyMessages.map((m) => m.msgId))
    const newMsgs = currentMessages.filter((m) => !existingIds.has(m.msgId))
    return [...historyMessages, ...newMsgs]
  }, [historyMessages, currentMessages])

  const loadMessages = useCallback(async () => {
    if (!currentChatId || currentChatType == null || loading) return
    setLoading(true)
    try {
      const firstMsg = historyMessages[0]
      const resp = await getMessages(currentChatId, currentChatType, 30, firstMsg?.msgId)
      const rawMsgs = resp.msg || []
      if (rawMsgs.length < 30) setHasMore(false)
      const msgs: Message[] = [...rawMsgs].reverse().map((m: any) => parseMessage(m, selfUserId))
      if (firstMsg) setHistoryMessages((prev) => [...msgs, ...prev])
      else { setHistoryMessages(msgs); shouldScrollToBottom.current = true }
    } catch (err) { console.error('加载消息失败:', err) }
    finally { setLoading(false) }
  }, [currentChatId, currentChatType, historyMessages, loading, selfUserId])

  useEffect(() => { if (prevChatId.current !== currentChatId) { prevChatId.current = currentChatId; setHistoryMessages([]); setHasMore(true); setSelectMode(false); setSelectedIds(new Set()) } }, [currentChatId])
  useEffect(() => { if (currentChatId && historyMessages.length === 0) loadMessages() }, [currentChatId, historyMessages.length])
  useEffect(() => { if (currentMessages.length > 0) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50) }, [currentMessages.length])
  useEffect(() => { if (shouldScrollToBottom.current && historyMessages.length > 0) { shouldScrollToBottom.current = false; setTimeout(() => bottomRef.current?.scrollIntoView(), 50) } }, [historyMessages])

  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el || loading || !hasMore) return
    if (el.scrollTop < 50) { const prevHeight = el.scrollHeight; loadMessages().then(() => requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prevHeight })) }
  }, [loading, hasMore, loadMessages])

  const formatTime = (ms: number) => { if (!ms) return ''; const d = new Date(ms); if (isNaN(d.getTime())) return ''; return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}` }
  const formatFileSize = (size: number) => { if (!size) return ''; if (size > 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`; if (size > 1024) return `${(size / 1024).toFixed(1)} KB`; return `${size} B` }

  const handleContextMenu = (e: React.MouseEvent, msg: Message) => {
    if (!currentChatId || currentChatType == null) return
    if (selectMode) { e.preventDefault(); toggleSelect(msg.msgId); return }
    if (!isMobile.current && e.ctrlKey) return
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, msgId: msg.msgId, senderId: msg.senderId, senderName: msg.senderName, direction: msg.direction })
  }
  const handleTouchStart = () => { if (!selectMode) longPressTimer.current = setTimeout(() => { longPressTimer.current = null }, 500) }
  const handleTouchEnd = (e: React.TouchEvent, msg: Message) => {
    if (selectMode) { toggleSelect(msg.msgId); return }
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; const touch = e.changedTouches[0]; setContextMenu({ x: touch.clientX, y: touch.clientY, msgId: msg.msgId, senderId: msg.senderId, senderName: msg.senderName, direction: msg.direction }) }
  }
  const toggleSelect = (msgId: string) => { setSelectedIds((prev) => { const next = new Set(prev); if (next.has(msgId)) next.delete(msgId); else next.add(msgId); if (next.size === 0) setSelectMode(false); return next }) }
  const handleRecall = async (msgId: string) => { if (!currentChatId || currentChatType == null) return; try { await recallMessage(msgId, currentChatId, currentChatType) } catch (err) { console.error('撤回失败:', err) }; setContextMenu(null) }
  const handleBatchRecall = async () => {
    if (!currentChatId || currentChatType == null) return
    const ids = Array.from(selectedIds)
    try { for (let i = 0; i < ids.length; i += 10) await batchRecallMessages(ids.slice(i, i + 10), currentChatId, currentChatType) }
    catch (err) { console.error('批量撤回失败:', err) }
    setSelectedIds(new Set()); setSelectMode(false); setContextMenu(null)
  }
  const handleQuote = (msg: Message) => {
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
  }
  const handleAtUser = (senderId: string, senderName: string) => { setContextMenu(null); window.dispatchEvent(new CustomEvent('at-user', { detail: { userId: senderId, name: senderName } })) }
  const closeContextMenu = () => setContextMenu(null)

  const openStickerPreview = async (packId: number) => { try { const data = await getStickerDetail(packId); const pack = data?.data?.stickerPack; const user = data?.data?.user; setStickerPreview({ packId, packName: pack?.name || '', authorId: user?.user_id || pack?.createBy || '', authorName: user?.nickname || '', authorAvatar: user?.avatar_url || '', stickerCount: pack?.stickerItems?.length || 0, stickers: pack?.stickerItems || [] }); setAddMsg(''); setAddMsgType(''); setShowAuthorInfo(false); setAuthorInfo(null) } catch { } }
  const handleAddSticker = async () => { if (!stickerPreview || addingSticker) return; setAddingSticker(true); setAddMsg(''); setAddMsgType(''); try { const data = await addStickerPack(stickerPreview.packId); if (data?.code === 1) { setAddMsg('已添加到我的表情'); setAddMsgType('success') } else { setAddMsg(data?.msg || '添加失败'); setAddMsgType('error') } } catch (err: any) { setAddMsg(err?.response?.data?.msg || '网络错误'); setAddMsgType('error') } finally { setAddingSticker(false); if (addMsgType !== 'error') setTimeout(() => { setAddMsg(''); setAddMsgType('') }, 3000) } }
  const toggleAuthorInfo = async () => { if (showAuthorInfo) { setShowAuthorInfo(false); setAuthorInfo(null); return }; if (!stickerPreview?.authorId || loadingAuthor) return; setLoadingAuthor(true); try { const data = await getUserInfo(stickerPreview.authorId); const u = data?.data; setAuthorInfo({ name: u?.name ? String(u.name) : '', avatarUrl: u?.avatarUrl ? String(u.avatarUrl) : '', registerTime: u?.registerTime ? String(u.registerTime) : '', onlineDay: typeof u?.onlineDay === 'object' ? u.onlineDay.toNumber() : (u?.onlineDay || 0), isVip: u?.isVip === 1 }); setShowAuthorInfo(true) } catch { } finally { setLoadingAuthor(false) } }

  const renderFileIcon = (fileName: string) => {
    const config = getFileConfig(fileName)
    if (config.iconUrl) return <img src={config.iconUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
    return <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${config.color}18` }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={config.color} strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><polyline points="9 15 12 12 15 15" /></svg></div>
  }

  const renderContent = (msg: Message) => {
    switch (msg.contentType) {
      case CONTENT_TYPE.IMAGE: return <img src={resolveMediaUrl(msg.imageUrl)} alt="图片" className="max-w-[240px] max-h-[320px] rounded-xl object-cover cursor-pointer" loading="lazy" onClick={(e) => { const img = e.currentTarget; img.style.maxWidth = img.style.maxWidth === '240px' ? '100%' : '240px'; img.style.maxHeight = img.style.maxHeight === '320px' ? 'none' : '320px' }} />
      case CONTENT_TYPE.FILE: return <a href={resolveMediaUrl(msg.fileUrl)} target="_blank" rel="noopener noreferrer" download={msg.fileName} className="flex items-center gap-3 bg-white/50 rounded-xl px-4 py-3 hover:bg-white/80 transition-colors">{renderFileIcon(msg.fileName)}<div className="min-w-0"><div className="text-sm font-medium text-gray-800 truncate max-w-[200px]">{msg.fileName || '未知文件'}</div>{msg.fileSize > 0 && <div className="text-xs text-gray-400">{formatFileSize(msg.fileSize)}</div>}</div></a>
      case CONTENT_TYPE.VIDEO: return <video src={resolveMediaUrl(msg.videoUrl)} controls preload="metadata" className="rounded-xl bg-black max-w-[320px] max-h-[240px]" playsInline webkit-playsinline="true">您的浏览器不支持视频播放</video>
      case CONTENT_TYPE.AUDIO: return <audio src={resolveMediaUrl(msg.audioUrl)} controls preload="metadata" className="max-w-[280px] h-10">您的浏览器不支持语音播放</audio>
      case CONTENT_TYPE.EXPRESSION: { const rawUrl = msg.stickerUrl || msg.imageUrl; const emojiUrl = resolveMediaUrl(rawUrl); if (!emojiUrl) return <span className="text-gray-400 text-sm">[表情]</span>; return <img src={emojiUrl} alt="表情" className="max-w-[120px] max-h-[120px] object-contain cursor-pointer" loading="lazy" onClick={() => { if (msg.stickerPackId > 0) openStickerPreview(msg.stickerPackId) }} /> }
      default: return <span className="whitespace-pre-wrap break-words">{msg.content}</span>
    }
  }

  if (!currentChatId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#f5f5f5]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gray-200 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          </div>
          <p className="text-gray-400 text-sm">选择一个会话开始聊天</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {selectMode && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center gap-3 text-sm shrink-0">
          <span className="text-blue-600 font-medium">已选 {selectedIds.size} 条</span>
          <div className="flex-1" />
          <button onClick={handleBatchRecall} className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs hover:bg-red-600 transition-colors">批量撤回</button>
          <button onClick={() => { setSelectMode(false); setSelectedIds(new Set()) }} className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg text-xs hover:bg-gray-300 transition-colors">取消</button>
        </div>
      )}
      <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3 bg-[#f5f5f5]">
        {loading && hasMore && <div className="text-center text-gray-400 text-xs py-2">加载中...</div>}
        {!hasMore && messages.length > 0 && <div className="text-center text-gray-300 text-xs py-2">— 没有更多消息 —</div>}
        {messages.map((msg) => {
          const isRight = msg.direction === 'right'
          const isMedia = msg.contentType === CONTENT_TYPE.IMAGE || msg.contentType === CONTENT_TYPE.FILE || msg.contentType === CONTENT_TYPE.VIDEO || msg.contentType === CONTENT_TYPE.EXPRESSION || msg.contentType === CONTENT_TYPE.AUDIO
          const isOwner = ownerId === msg.senderId
          const isAdmin = adminIds.has(msg.senderId) && !isOwner
          const isSelected = selectedIds.has(msg.msgId)
          return (
            <div key={msg.msgId} className={`flex ${isRight ? 'justify-end' : 'justify-start'} relative`}>
              <div className={`flex gap-2 max-w-[75%] ${isRight ? 'flex-row-reverse' : ''}`}>
                {selectMode && (
                  <div className="self-center shrink-0" onClick={() => toggleSelect(msg.msgId)}>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'}`}>
                      {isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                    </div>
                  </div>
                )}
                <div className={`flex gap-2 max-w-full ${isRight ? 'flex-row-reverse' : ''}`}
                  onContextMenu={(e) => handleContextMenu(e, msg)} onTouchStart={handleTouchStart} onTouchEnd={(e) => handleTouchEnd(e, msg)}
                  onDoubleClick={() => { if (!selectMode) { setSelectMode(true); toggleSelect(msg.msgId) } }}>
                  <div className="self-start mt-1"><Avatar src={msg.senderAvatar} name={msg.senderName} isRight={isRight} size="sm" /></div>
                  <div className={isRight ? 'items-end flex flex-col' : ''}>
                    <span className={`text-xs text-gray-400 mb-1 flex items-center gap-1 ${isRight ? 'mr-1 flex-row-reverse' : 'ml-1'}`}>
                      {msg.senderName}
                      {isOwner && <span className="px-1 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">群主</span>}
                      {isAdmin && <span className="px-1 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-600">管理</span>}
                    </span>

                    {/* 引用消息：文字或图片/视频缩略图 */}
                    {msg.quoteMsgText ? (
                      <div className="text-xs text-gray-400 bg-white/70 rounded px-2 py-1 mb-1 truncate max-w-[200px] border-l-2 border-gray-300">{msg.quoteMsgText}</div>
                    ) : msg.quoteImageUrl ? (
                      <div className="mb-1">
                        <img src={resolveMediaUrl(msg.quoteImageUrl)} alt="引用图片" className="max-w-[120px] max-h-[80px] rounded-lg object-cover" />
                      </div>
                    ) : msg.quoteVideoUrl ? (
                      <div className="mb-1">
                        <video src={resolveMediaUrl(msg.quoteVideoUrl)} className="max-w-[120px] max-h-[80px] rounded-lg object-cover" muted />
                      </div>
                    ) : null}

                    {isMedia ? (
                      <>{renderContent(msg)}{renderButtons(msg.buttons, isRight, msg.msgId, currentChatId!, currentChatType!, selfUserId)}</>
                    ) : (
                      <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed break-words ${isRight ? 'bg-[#95ec69] text-gray-900 rounded-tr-md' : 'bg-white text-gray-800 rounded-tl-md shadow-sm'}`}>
                        {renderContent(msg)}
                        {renderButtons(msg.buttons, isRight, msg.msgId, currentChatId!, currentChatType!, selfUserId)}
                      </div>
                    )}
                    <div className={`text-xs text-gray-400 mt-0.5 ${isRight ? 'text-right' : ''}`}>{formatTime(msg.sendTime)}</div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeContextMenu} onContextMenu={(e) => { e.preventDefault(); closeContextMenu() }} />
          <div className="fixed z-50 bg-white rounded-xl shadow-lg border border-gray-200 py-1 w-36" style={{ left: Math.min(contextMenu.x, window.innerWidth - 160), top: Math.min(contextMenu.y, window.innerHeight - 200) }}>
            <button onClick={() => handleRecall(contextMenu.msgId)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>撤回消息</button>
            <button onClick={() => { const m = messages.find((x) => x.msgId === contextMenu.msgId); if (m) handleQuote(m) }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 17 4 12 9 7" /><path d="M20 18v-9a7 7 0 0 0-7-7H4" /></svg>引用消息</button>
            <button onClick={() => { setSelectMode(true); toggleSelect(contextMenu.msgId); closeContextMenu() }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /></svg>多选</button>
            {contextMenu.senderId !== selfUserId && <button onClick={() => handleAtUser(contextMenu.senderId, contextMenu.senderName)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>@{contextMenu.senderName}</button>}
          </div>
        </>
      )}

      {/* 表情包预览弹窗 */}
      {stickerPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setStickerPreview(null)}>
          <div className="fixed inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl w-[90vw] max-w-lg max-h-[70vh] overflow-y-auto p-4 m-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><div><h3 className="font-medium text-sm">{stickerPreview.packName || '表情包预览'}</h3><p className="text-xs text-gray-400 mt-0.5">共 {stickerPreview.stickerCount || stickerPreview.stickers.length} 个表情{stickerPreview.authorName && <>{' · '}作者：<button onClick={toggleAuthorInfo} disabled={loadingAuthor} className="text-blue-500 hover:text-blue-600 disabled:opacity-50">{stickerPreview.authorName}</button></>}</p></div><button onClick={() => setStickerPreview(null)} className="text-gray-400 hover:text-gray-600 shrink-0"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg></button></div>
            {showAuthorInfo && authorInfo && (<div className="bg-gray-50 rounded-xl p-3 mb-3 flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden shrink-0 flex items-center justify-center">{authorInfo.avatarUrl ? <img src={resolveMediaUrl(authorInfo.avatarUrl)} alt="" className="w-full h-full object-cover" /> : <span className="text-sm text-gray-400">{authorInfo.name?.[0]}</span>}</div><div className="min-w-0 text-sm"><div className="font-medium text-gray-800">{authorInfo.name}</div><div className="text-xs text-gray-400">{authorInfo.registerTime && <span>注册于 {authorInfo.registerTime}</span>}{authorInfo.onlineDay > 0 && <span> · 在线 {authorInfo.onlineDay} 天</span>}{authorInfo.isVip && <span className="text-amber-500 ml-1">VIP</span>}</div></div></div>)}
            <div className="grid grid-cols-4 gap-3">{stickerPreview.stickers.map((s: any) => (<div key={s.id} className="flex flex-col items-center gap-1"><img src={resolveMediaUrl(s.url)} alt={s.name || ''} className="w-full aspect-square object-contain bg-gray-50 rounded-lg" loading="lazy" />{s.name && <span className="text-[10px] text-gray-400 truncate w-full text-center">{s.name}</span>}</div>))}</div>
            {stickerPreview.stickers.length === 0 && <p className="text-gray-400 text-sm text-center py-8">该表情包为空</p>}
            <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
              {addMsg && <div className={`text-xs px-3 py-2 rounded-lg ${addMsgType === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>{addMsg}</div>}
              <button onClick={handleAddSticker} disabled={addingSticker || addMsgType === 'success'} className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${addMsgType === 'success' ? 'bg-green-100 text-green-600' : 'bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50'}`}>{addMsgType === 'success' ? '已添加' : addingSticker ? '添加中...' : '添加到我的表情'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}