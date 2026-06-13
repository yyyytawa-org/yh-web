import { memo } from 'react'
import { Download } from 'lucide-react'
import { CONTENT_TYPE, type Message } from '../../../types/message'
import { resolveMediaUrl } from '../../../store/settingsStore'
import { reportButtonClick } from '../../../api/message'

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

function getFileExtension(name: string): string {
  const parts = name.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : ''
}

function getFileConfig(name: string) {
  const ext = getFileExtension(name)
  return FILE_TYPE_CONFIG[ext] ?? { color: '#9ca3af' }
}

function formatFileSize(size: number) {
  if (!size) return ''
  if (size > 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  if (size > 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${size} B`
}

function renderFileIcon(fileName: string) {
  const config = getFileConfig(fileName)
  if (config.iconUrl) return <img src={config.iconUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
  return (
    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${config.color}18` }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={config.color} strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <polyline points="9 15 12 12 15 15" />
      </svg>
    </div>
  )
}

function renderButtons(buttonsJson: string, msgId: string, chatId: string, chatType: number, userId: string) {
  try {
    const rows = JSON.parse(buttonsJson)
    if (!Array.isArray(rows) || rows.length === 0) return null
    return (
      <div className="mt-1.5 space-y-1 flex flex-col items-start">
        {rows.map((row: any[], ri: number) => (
          <div key={ri} className="flex gap-1 flex-wrap">
            {row.map((btn: any, bi: number) => (
              <button
                key={bi}
                onClick={async () => {
                  const btnValue = btn.actionType === 1 ? (btn.url || '') : (btn.value || '')
                  reportButtonClick(msgId, chatId, chatType, userId, btnValue).catch(() => {})
                  if (btn.actionType === 1 && btn.url) window.open(btn.url, '_blank', 'noopener,noreferrer')
                  else if (btn.actionType === 2 && btn.value) navigator.clipboard.writeText(btn.value)
                }}
                className="px-2.5 py-1 rounded-lg text-[10px] font-bold border border-[var(--adw-border)]/[0.2] bg-[var(--adw-card)] text-[var(--adw-fg)] hover:bg-[var(--adw-hover)] transition-colors cursor-pointer shadow-xs"
              >
                {btn.text || ''}
              </button>
            ))}
          </div>
        ))}
      </div>
    )
  } catch {
    return null
  }
}

interface MessageContentProps {
  msg: Message
  selfUserId: string
  chatId: string
  chatType: number
  openStickerPreview: (packId: number) => void
}

export const MessageContent = memo(({ msg, selfUserId, chatId, chatType, openStickerPreview }: MessageContentProps) => {
  switch (msg.contentType) {
    case CONTENT_TYPE.IMAGE:
      return (
        <div>
          <img
            src={resolveMediaUrl(msg.imageUrl)}
            alt="图片"
            className="max-w-[240px] max-h-[320px] rounded-xl object-cover cursor-pointer my-1.5 shadow-xs border border-[var(--adw-border)]/[0.2]"
            loading="lazy"
            onClick={(e) => {
              const img = e.currentTarget
              img.style.maxWidth = img.style.maxWidth === '240px' ? '100%' : '240px'
              img.style.maxHeight = img.style.maxHeight === '320px' ? 'none' : '320px'
            }}
          />
          {msg.buttons && renderButtons(msg.buttons, msg.msgId, chatId, chatType, selfUserId)}
        </div>
      )
    case CONTENT_TYPE.FILE:
      return (
        <div>
          <div className="flex items-center gap-3 bg-[var(--adw-card)]/55 border border-[var(--adw-border)]/[0.2] rounded-xl px-4 py-3 hover:bg-[var(--adw-hover)] transition-colors max-w-sm my-1.5 shadow-xs">
            {renderFileIcon(msg.fileName)}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-[var(--adw-fg)] truncate">{msg.fileName || '未知文件'}</div>
              {msg.fileSize > 0 && <div className="text-xs text-[var(--adw-fg-dim)] opacity-70 mt-0.5">{formatFileSize(msg.fileSize)}</div>}
            </div>
            <a
              href={resolveMediaUrl(msg.fileUrl)}
              target="_blank"
              rel="noopener noreferrer"
              download={msg.fileName}
              className="p-2 rounded-full hover:bg-[var(--adw-blue)]/10 text-[var(--adw-blue)] transition-colors cursor-pointer"
            >
              <Download size={16} />
            </a>
          </div>
          {msg.buttons && renderButtons(msg.buttons, msg.msgId, chatId, chatType, selfUserId)}
        </div>
      )
    case CONTENT_TYPE.VIDEO:
      return (
        <div>
          <video
            src={resolveMediaUrl(msg.videoUrl)}
            controls
            preload="metadata"
            className="rounded-xl bg-black max-w-[320px] max-h-[240px] my-1.5 border border-[var(--adw-border)]/[0.2]"
            playsInline
          >
            您的浏览器不支持视频播放
          </video>
          {msg.buttons && renderButtons(msg.buttons, msg.msgId, chatId, chatType, selfUserId)}
        </div>
      )
    case CONTENT_TYPE.AUDIO:
      return (
        <div>
          <audio
            src={resolveMediaUrl(msg.audioUrl)}
            controls
            preload="metadata"
            className="max-w-[280px] h-9 my-1.5"
          >
            您的浏览器不支持语音播放
          </audio>
          {msg.buttons && renderButtons(msg.buttons, msg.msgId, chatId, chatType, selfUserId)}
        </div>
      )
    case CONTENT_TYPE.EXPRESSION:
      {
        const rawUrl = msg.stickerUrl || msg.imageUrl
        const emojiUrl = resolveMediaUrl(rawUrl)
        if (!emojiUrl) return <span className="text-[var(--adw-fg-dim)] text-xs italic opacity-60">[表情]</span>
        return (
          <img
            src={emojiUrl}
            alt="表情"
            className="max-w-[120px] max-h-[120px] object-contain cursor-pointer my-1"
            loading="lazy"
            onClick={() => {
              if (msg.stickerPackId > 0) openStickerPreview(msg.stickerPackId)
            }}
          />
        )
      }
    default:
      return (
        <div className="flex flex-col items-start">
          <span className="whitespace-pre-wrap break-words">{msg.content}</span>
          {msg.buttons && renderButtons(msg.buttons, msg.msgId, chatId, chatType, selfUserId)}
        </div>
      )
  }
})

MessageContent.displayName = 'MessageContent'
