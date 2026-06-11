import { useState, useRef, useCallback, useEffect } from 'react'
import { sendMessage } from '../../api/message'
import { useChatStore } from '../../store/chatStore'
import { uploadToQiniu, compressImage } from '../../api/upload'
import type { QuoteMsg } from '../../types/message'

interface UploadItem {
  id: string
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

let uploadIdCounter = 0
function nextUploadId(): string { return `upload_${++uploadIdCounter}_${Date.now()}` }

interface InputAreaProps {
  quoteMsg: QuoteMsg | null
  onClearQuote?: () => void
}

export default function InputArea({ quoteMsg, onClearQuote }: InputAreaProps) {
  const { currentChatId, currentChatType } = useChatStore()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [height, setHeight] = useState(80)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [compress, setCompress] = useState(() => localStorage.getItem('yh_compress') !== '0')
  const [compressQuality, setCompressQuality] = useState(() => {
    const saved = localStorage.getItem('yh_compress_quality')
    return saved ? Number(saved) : 0.8
  })
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const isResizing = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(0)
  const dragCounter = useRef(0)

  const toggleCompress = () => { const next = !compress; setCompress(next); localStorage.setItem('yh_compress', next ? '1' : '0') }
  const updateCompressQuality = (val: number) => { const clamped = Math.max(0.01, Math.min(1, val)); setCompressQuality(clamped); localStorage.setItem('yh_compress_quality', String(clamped)) }

  useEffect(() => {
    const handler = (e: Event) => { const detail = (e as CustomEvent).detail; setText((prev) => prev + `@${detail.name} `); textareaRef.current?.focus() }
    window.addEventListener('at-user', handler); return () => window.removeEventListener('at-user', handler)
  }, [])

  const handleFiles = async (files: FileList | File[]) => {
    const fileArr = Array.from(files)
    if (fileArr.length === 0) return
    const items: UploadItem[] = fileArr.map((file) => ({ id: nextUploadId(), file, progress: 0, status: 'pending' as const }))
    setUploads((prev) => [...prev, ...items])
    for (const item of items) {
      setUploads((prev) => prev.map((u) => (u.id === item.id ? { ...u, status: 'uploading' as const } : u)))
      try {
        let file = item.file
        const isImage = file.type.startsWith('image/')
        const isVideo = file.type.startsWith('video/')
        const type = isImage ? 'image' : isVideo ? 'video' : 'file'
        if (isImage && compress) file = await compressImage(file, compressQuality)
        const result = await uploadToQiniu(file, type, (pct) => { setUploads((prev) => prev.map((u) => (u.id === item.id ? { ...u, progress: pct } : u))) })
        const store = useChatStore.getState()
        if (store.currentChatId && store.currentChatType != null) {
          if (type === 'image') {
            await sendMessage({ chatId: store.currentChatId, chatType: store.currentChatType, contentType: 2, image: result.key })
          } else if (type === 'video') {
            await sendMessage({ chatId: store.currentChatId, chatType: store.currentChatType, contentType: 10, video: result.key })
          } else {
            await sendMessage({ chatId: store.currentChatId, chatType: store.currentChatType, contentType: 4, fileKey: result.key, fileName: item.file.name, fileSize: item.file.size })
          }
        }
        setUploads((prev) => prev.filter((u) => u.id !== item.id))
      } catch (err: any) {
        setUploads((prev) => prev.map((u) => (u.id === item.id ? { ...u, status: 'error' as const, error: err.message || '上传失败' } : u)))
        setTimeout(() => setUploads((prev) => prev.filter((u) => u.id !== item.id)), 3000)
      }
    }
  }

  const handleSend = useCallback(async () => {
    if (!text.trim() || !currentChatId || currentChatType == null) return
    setSending(true)
    try {
      const hasQuoteImage = !!quoteMsg?.quoteImageUrl
      const hasQuoteVideo = !!quoteMsg?.quoteVideoUrl
      await sendMessage({
        chatId: currentChatId,
        chatType: currentChatType,
        contentType: 1,
        text: text.trim(),
        quoteMsgId: quoteMsg?.msgId,
        quoteMsgText: (hasQuoteImage || hasQuoteVideo) ? undefined : quoteMsg?.text,
        quoteImageUrl: quoteMsg?.quoteImageUrl,
        quoteImageName: quoteMsg?.quoteImageName,
        quoteVideoUrl: quoteMsg?.quoteVideoUrl,
        quoteVideoTime: quoteMsg?.quoteVideoTime,
      })
      setText('')
      onClearQuote?.()
      setTimeout(() => textareaRef.current?.focus(), 50)
    } catch (err) { console.error('发送失败:', err) } finally { setSending(false) }
  }, [text, currentChatId, currentChatType, quoteMsg, onClearQuote])

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }

  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); dragCounter.current++; if (dragCounter.current === 1) setDragOver(true) }
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault() }
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); dragCounter.current--; if (dragCounter.current === 0) setDragOver(false) }
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); dragCounter.current = 0; setDragOver(false); if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files) }
  const handlePaste = (e: React.ClipboardEvent) => { if (e.clipboardData?.files.length) { e.preventDefault(); handleFiles(e.clipboardData.files) } }

  const handleMouseDown = (e: React.MouseEvent) => {
    isResizing.current = true; startY.current = e.clientY; startHeight.current = height
    document.body.style.cursor = 'ns-resize'; document.body.style.userSelect = 'none'
    const onMouseMove = (ev: MouseEvent) => { if (!isResizing.current) return; const diff = startY.current - ev.clientY; setHeight(Math.max(60, Math.min(300, startHeight.current + diff))) }
    const onMouseUp = () => { isResizing.current = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp) }
    document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp)
  }

  const handleFocus = () => {
    if ('visualViewport' in window) window.visualViewport!.addEventListener('resize', () => { textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, { once: true })
  }

  const pendingUploads = uploads.filter((u) => u.status !== 'done')

  if (!currentChatId) return <div className="h-20 border-t border-gray-200 bg-[#f5f5f5] flex items-center justify-center text-gray-400 text-sm shrink-0">请先选择一个会话</div>

  return (
    <div className="border-t border-gray-200 bg-white shrink-0" style={{ height: `${height + 16 + (pendingUploads.length > 0 ? 44 : 0)}px` }}>
      <div onMouseDown={handleMouseDown} className="hidden md:flex h-1.5 cursor-ns-resize hover:bg-gray-200 transition-colors items-center justify-center"><div className="w-8 h-0.5 bg-gray-300 rounded" /></div>
      {pendingUploads.length > 0 && (
        <div className="px-3 py-1.5 space-y-1">
          {pendingUploads.map((u) => (
            <div key={u.id} className="flex items-center gap-2 text-xs">
              <span className={`truncate flex-1 ${u.status === 'error' ? 'text-red-500' : 'text-gray-500'}`}>{u.status === 'error' ? u.error : u.file.name}</span>
              {u.status === 'uploading' && <><div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${u.progress}%` }} /></div><span className="text-gray-400 w-8 text-right">{u.progress}%</span></>}
            </div>
          ))}
        </div>
      )}

      {/* 引用消息提示 */}
      {quoteMsg && (
        <div className="px-3 py-1.5 bg-gray-50 flex items-center gap-2 text-xs border-b border-gray-100">
          <span className="text-gray-400 shrink-0">回复</span>
          {quoteMsg.quoteImageUrl ? (
            <img src={quoteMsg.quoteImageUrl} alt="" className="h-8 w-12 object-cover rounded" />
          ) : quoteMsg.quoteVideoUrl ? (
            <video src={quoteMsg.quoteVideoUrl} className="h-8 w-12 object-cover rounded" muted />
          ) : (
            <span className="text-gray-600 truncate flex-1">{quoteMsg.text}</span>
          )}
          <button onClick={onClearQuote} className="text-gray-400 hover:text-gray-600 shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      <div className="flex gap-2 px-3 pb-3 pt-2 md:pt-0 relative" style={{ height: `${height}px` }}
        onDragEnter={handleDragEnter} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
        {dragOver && <div className="absolute inset-0 bg-blue-50/80 z-10 rounded-xl flex items-center justify-center border-2 border-dashed border-blue-400"><span className="text-blue-500 font-medium text-sm">释放以上传文件</span></div>}
        <div className="flex flex-col items-center justify-end pb-1 shrink-0 relative">
          <button onClick={() => setMenuOpen(!menuOpen)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" title="更多"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg></button>
          {menuOpen && (<><div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} /><div className="absolute bottom-full left-0 mb-1 bg-white rounded-xl shadow-lg border border-gray-200 z-20 py-1 w-40">
            <button onClick={() => { fileInputRef.current?.click(); setMenuOpen(false) }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>发送文件</button>
            <button onClick={() => { imageInputRef.current?.click(); setMenuOpen(false) }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>发送图片</button>
            <button onClick={() => { videoInputRef.current?.click(); setMenuOpen(false) }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>发送视频</button>
            <div className="border-t border-gray-100 my-1" />
            <button onClick={() => { toggleCompress(); setMenuOpen(false) }} className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${compress ? 'text-blue-600' : 'text-gray-700 hover:bg-gray-50'}`}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /><line x1="16" y1="5" x2="22" y2="5" /><line x1="18" y1="3" x2="18" y2="7" /></svg>图片压缩 {compress ? '✓' : ''}</button>
            {compress && (
              <div className="px-3 py-1 flex items-center gap-2">
                <input type="range" min="1" max="100" step="1" value={Math.round(compressQuality * 100)} onChange={(e) => updateCompressQuality(Number(e.target.value) / 100)} className="flex-1 h-1.5 appearance-none bg-gray-200 rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
                <input type="number" min="1" max="100" value={Math.round(compressQuality * 100)} onChange={(e) => { const val = Number(e.target.value); if (!isNaN(val)) updateCompressQuality(val / 100) }} className="w-12 text-center text-xs border border-gray-200 rounded py-0.5 focus:outline-none focus:border-blue-300" />
                <span className="text-[10px] text-gray-400 w-4">%</span>
              </div>
            )}
          </div></>)}
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = '' }} />
          <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = '' }} />
          <input ref={videoInputRef} type="file" accept="video/*" multiple className="hidden" onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = '' }} />
        </div>
        <textarea ref={textareaRef} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={handleKeyDown} onPaste={handlePaste} onFocus={handleFocus} placeholder="输入消息... (Enter 发送，Shift+Enter 换行)" className="flex-1 px-3 py-2 border border-gray-200 rounded-xl resize-none focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300 text-sm leading-relaxed" disabled={sending} />
        <button onClick={handleSend} disabled={sending || !text.trim()} className="px-4 bg-[#95ec69] text-gray-900 rounded-xl hover:bg-[#7ddb52] disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium self-end transition-colors shrink-0" style={{ height: '36px' }}>{sending ? '...' : '发送'}</button>
      </div>
    </div>
  )
}