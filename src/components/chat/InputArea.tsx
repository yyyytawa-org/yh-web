import { useState, useRef, useCallback, useEffect } from 'react'
import { sendMessage } from '../../api/message'
import { useChatStore } from '../../store/chatStore'
import { uploadToQiniu, compressImage } from '../../api/upload'
import type { QuoteMsg } from '../../types/message'
import { 
  Plus, 
  Send, 
  File, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  Sliders, 
  X, 
  Check,
  Smile,
  Code
} from 'lucide-react'
import EmojiPicker from 'emoji-picker-react'
import AdwButton from './AdwButton'

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
  const dragCounter = useRef(0)

  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [messageMode, setMessageMode] = useState<'text' | 'markdown' | 'html'>('text')
  const emojiPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getMessageModeColor = () => {
    switch (messageMode) {
      case 'markdown':
        return 'text-red-500'
      case 'html':
        return 'text-purple-500'
      default:
        return 'text-[var(--adw-blue)]'
    }
  }

  const cycleMessageMode = () => {
    setMessageMode((prev) => {
      if (prev === 'text') return 'markdown'
      if (prev === 'markdown') return 'html'
      return 'text'
    })
  }

  const getPlaceholderText = () => {
    switch (messageMode) {
      case 'markdown':
        return `Markdown 模式 - 输入消息...`
      case 'html':
        return `HTML 模式 - 输入消息...`
      default:
        return `输入消息...`
    }
  }

  const toggleCompress = () => { 
    const next = !compress
    setCompress(next)
    localStorage.setItem('yh_compress', next ? '1' : '0') 
  }
  
  const updateCompressQuality = (val: number) => { 
    const clamped = Math.max(0.01, Math.min(1, val))
    setCompressQuality(clamped)
    localStorage.setItem('yh_compress_quality', String(clamped)) 
  }

  useEffect(() => {
    const handler = (e: Event) => { 
      const detail = (e as CustomEvent).detail
      setText((prev) => prev + `@${detail.name} `)
      textareaRef.current?.focus() 
    }
    window.addEventListener('at-user', handler)
    return () => window.removeEventListener('at-user', handler)
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
        const result = await uploadToQiniu(file, type, (pct) => { 
          setUploads((prev) => prev.map((u) => (u.id === item.id ? { ...u, progress: pct } : u))) 
        })
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

  const handleKeyDown = (e: React.KeyboardEvent) => { 
    if (e.key === 'Enter' && !e.shiftKey) { 
      e.preventDefault()
      handleSend() 
    } 
  }

  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); dragCounter.current++; if (dragCounter.current === 1) setDragOver(true) }
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault() }
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); dragCounter.current--; if (dragCounter.current === 0) setDragOver(false) }
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); dragCounter.current = 0; setDragOver(false); if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files) }
  const handlePaste = (e: React.ClipboardEvent) => { if (e.clipboardData?.files.length) { e.preventDefault(); handleFiles(e.clipboardData.files) } }

  const handleFocus = () => {
    if ('visualViewport' in window) {
      window.visualViewport!.addEventListener('resize', () => { 
        textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) 
      }, { once: true })
    }
  }

  const pendingUploads = uploads.filter((u) => u.status !== 'done')

  if (!currentChatId) {
    return (
      <div className="h-14 border-t border-[var(--adw-border)]/[0.2] bg-[var(--adw-window)] flex items-center justify-center text-[var(--adw-fg-dim)] text-xs shrink-0 select-none opacity-60 font-semibold">
        请先选择一个会话以开始聊天
      </div>
    )
  }

  return (
    <footer className="px-0 py-3 absolute bottom-0 left-0 right-0 bg-transparent bg-gradient-to-t from-[var(--adw-window)]/90 to-[var(--adw-window)] backdrop-blur-md z-20 pointer-events-none">
      <div className="max-w-4xl mx-auto px-4 pointer-events-auto">
        {/* Uploading Progress */}
        {pendingUploads.length > 0 && (
          <div className="px-4 py-1.5 space-y-1 bg-[var(--adw-card)]/50 border border-[var(--adw-border)]/[0.2] rounded-xl mb-2">
            {pendingUploads.map((u) => (
              <div key={u.id} className="flex items-center gap-2 text-[10px]">
                <span className={`truncate flex-1 font-bold ${u.status === 'error' ? 'text-red-500' : 'text-[var(--adw-fg-dim)]'}`}>
                  {u.status === 'error' ? u.error : u.file.name}
                </span>
                {u.status === 'uploading' && (
                  <>
                    <div className="w-20 h-1 bg-[var(--adw-border)]/[0.3] rounded-full overflow-hidden shrink-0">
                      <div className="h-full bg-[var(--adw-blue)] rounded-full transition-all" style={{ width: `${u.progress}%` }} />
                    </div>
                    <span className="text-[var(--adw-fg-dim)] w-8 text-right font-bold">{u.progress}%</span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Quoted Message display */}
        {quoteMsg && (
          <div className="mb-2 p-2 bg-[var(--adw-blue)]/5 border border-[var(--adw-blue)]/10 rounded-lg relative flex items-center justify-between animate-in select-none">
            <div className="flex-1 min-w-0 pr-3">
              <span className="text-[10px] font-bold text-[var(--adw-blue)] uppercase block mb-0.5">回复</span>
              <p className="text-xs truncate opacity-70 text-[var(--adw-fg)]">
                {quoteMsg.text}
              </p>
            </div>
            <button 
              onClick={onClearQuote} 
              className="p-1 rounded-lg hover:bg-[var(--adw-hover)] text-[var(--adw-fg-dim)] hover:text-[var(--adw-fg)] transition-colors cursor-pointer shrink-0"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Main Textarea and Controls row */}
        <div 
          className="flex items-center gap-2 -mx-4 px-4 relative" 
          onDragEnter={handleDragEnter} 
          onDragOver={handleDragOver} 
          onDragLeave={handleDragLeave} 
          onDrop={handleDrop}
        >
          {dragOver && (
            <div className="absolute inset-0 bg-[var(--adw-blue)]/10 backdrop-blur-xs z-10 rounded-xl flex items-center justify-center border-2 border-dashed border-[var(--adw-blue)]">
              <span className="text-[var(--adw-blue)] font-bold text-sm">释放文件以上传到当前会话</span>
            </div>
          )}

          {/* Left Buttons Group */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Attachment menu trigger */}
            <div className="relative">
              <AdwButton 
                iconOnly
                ghost
                roundedFull
                className="p-2.5"
                onClick={() => setMenuOpen(!menuOpen)} 
                title="添加附件"
              >
                <Plus size={18} className="text-[var(--adw-fg-dim)]" />
              </AdwButton>
              
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute bottom-full left-0 mb-2 bg-[var(--adw-card)] rounded-xl shadow-lg border border-[var(--adw-border)]/[0.2] z-50 p-1 w-44 animate-in">
                    <button 
                      onClick={() => { fileInputRef.current?.click(); setMenuOpen(false) }} 
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[var(--adw-fg)] hover:bg-[var(--adw-hover)] rounded-lg transition-colors cursor-pointer text-left"
                    >
                      <File size={15} className="opacity-70 text-[var(--adw-blue)]" />
                      <span>发送文件</span>
                    </button>
                    <button 
                      onClick={() => { imageInputRef.current?.click(); setMenuOpen(false) }} 
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[var(--adw-fg)] hover:bg-[var(--adw-hover)] rounded-lg transition-colors cursor-pointer text-left"
                    >
                      <ImageIcon size={15} className="opacity-70 text-emerald-500" />
                      <span>发送图片</span>
                    </button>
                    <button 
                      onClick={() => { videoInputRef.current?.click(); setMenuOpen(false) }} 
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[var(--adw-fg)] hover:bg-[var(--adw-hover)] rounded-lg transition-colors cursor-pointer text-left"
                    >
                      <VideoIcon size={15} className="opacity-70 text-indigo-500" />
                      <span>发送视频</span>
                    </button>
                    <div className="border-t border-[var(--adw-border)]/[0.1] my-1" />
                    <button 
                      onClick={() => { toggleCompress(); setMenuOpen(false) }} 
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        compress ? 'text-[var(--adw-blue)] hover:bg-[var(--adw-blue)]/10' : 'text-[var(--adw-fg)] hover:bg-[var(--adw-hover)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Sliders size={15} className="opacity-70" />
                        <span>图片压缩</span>
                      </div>
                      {compress && <Check size={14} />}
                    </button>
                    
                    {compress && (
                      <div className="px-3 py-2 flex items-center gap-1.5 bg-[var(--adw-window)]/[0.4] rounded-lg mt-1 mx-1">
                        <input 
                          type="range" 
                          min="1" 
                          max="100" 
                          step="1" 
                          value={Math.round(compressQuality * 100)} 
                          onChange={(e) => updateCompressQuality(Number(e.target.value) / 100)} 
                          className="flex-1 h-1 appearance-none bg-[var(--adw-border)]/[0.3] rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-[var(--adw-blue)] [&::-webkit-slider-thumb]:rounded-full cursor-pointer" 
                        />
                        <span className="text-[9px] font-bold text-[var(--adw-fg-dim)] w-8 text-right shrink-0">
                          {Math.round(compressQuality * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
              
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = '' }} />
              <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = '' }} />
              <input ref={videoInputRef} type="file" accept="video/*" multiple className="hidden" onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = '' }} />
            </div>

            {/* Smile (Emoji) button */}
            <AdwButton
              iconOnly
              ghost
              roundedFull
              className="p-2.5 text-[var(--adw-fg-dim)]"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              active={showEmojiPicker}
              title="选择表情"
            >
              <Smile size={18} />
            </AdwButton>

            {/* Code (Mode) button */}
            <AdwButton
              iconOnly
              ghost
              roundedFull
              onClick={cycleMessageMode}
              className={`p-2.5 ${getMessageModeColor()}`}
              title="切换输入模式"
            >
              <Code size={18} className="text-[var(--adw-fg-dim)]" />
            </AdwButton>
          </div>

          {/* Text input box matching native GNOME text view */}
          <div className="flex-1 flex flex-col gap-1 bg-[var(--adw-view)]/80 border border-[var(--adw-border)]/[0.2] rounded-lg px-3 py-1 focus-within:ring-1 focus-within:ring-[var(--adw-accent)]/[0.3] transition-all">
            <textarea 
              ref={textareaRef} 
              value={text} 
              onChange={(e) => setText(e.target.value)} 
              onKeyDown={handleKeyDown} 
              onPaste={handlePaste} 
              onFocus={handleFocus} 
              placeholder={getPlaceholderText()} 
              className="flex-1 bg-transparent border-none outline-none resize-none py-1 px-0.5 text-[13px] leading-relaxed min-h-[24px] max-h-32 text-[var(--adw-fg)] placeholder-[var(--adw-fg-dim)]/50" 
              disabled={sending} 
              rows={1}
            />
          </div>

          {/* Send button */}
          <button 
            onClick={handleSend} 
            disabled={sending || !text.trim()} 
            className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-all active:scale-95 shrink-0 cursor-pointer shadow-xs ${
              text.trim() && !sending 
                ? 'bg-[var(--adw-blue)] hover:bg-[var(--adw-blue)]/90' 
                : 'bg-zinc-400 dark:bg-zinc-700 opacity-40 cursor-not-allowed'
            }`}
          >
            <Send size={16} />
          </button>
        </div>
        
        {/* EmojiPicker Dropdown Popover */}
        {showEmojiPicker && (
          <div className="absolute bottom-20 left-6 z-50 pointer-events-auto" ref={emojiPickerRef}>
            <div className="fixed inset-0" onClick={() => setShowEmojiPicker(false)} />
            <div className="relative">
              <EmojiPicker 
                onEmojiClick={(emojiData) => {
                  setText((prev) => prev + emojiData.emoji)
                }} 
                theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'} 
              />
            </div>
          </div>
        )}
      </div>
    </footer>
  )
}