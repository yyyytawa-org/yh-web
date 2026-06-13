import { memo, useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { getStickerDetail, addStickerPack } from '../../../api/sticker'
import { getUserInfo } from '../../../api/user'
import { resolveMediaUrl } from '../../../store/settingsStore'
import Avatar from '../Avatar'

interface StickerPreviewModalProps {
  packId: number
  onClose: () => void
}

export const StickerPreviewModal = memo(({ packId, onClose }: StickerPreviewModalProps) => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [packInfo, setPackInfo] = useState<{
    packId: number
    packName?: string
    authorId?: string
    authorName?: string
    authorAvatar?: string
    stickerCount?: number
    stickers: any[]
  } | null>(null)

  const [addingSticker, setAddingSticker] = useState(false)
  const [addMsg, setAddMsg] = useState('')
  const [addMsgType, setAddMsgType] = useState<'success' | 'error' | ''>('')
  const [showAuthorInfo, setShowAuthorInfo] = useState(false)
  const [authorInfo, setAuthorInfo] = useState<{
    name: string
    avatarUrl: string
    registerTime: string
    onlineDay: number
    isVip: boolean
  } | null>(null)
  const [loadingAuthor, setLoadingAuthor] = useState(false)

  // Fetch sticker pack details on mount
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    getStickerDetail(packId)
      .then((data) => {
        if (cancelled) return
        const pack = data?.data?.stickerPack
        const user = data?.data?.user
        setPackInfo({
          packId,
          packName: pack?.name || '',
          authorId: user?.user_id || pack?.createBy || '',
          authorName: user?.nickname || '',
          authorAvatar: user?.avatar_url || '',
          stickerCount: pack?.stickerItems?.length || 0,
          stickers: pack?.stickerItems || [],
        })
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Failed to get sticker pack detail:', err)
        setError('加载表情包失败')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [packId])

  const handleAddSticker = async () => {
    if (addingSticker) return
    setAddingSticker(true)
    setAddMsg('')
    setAddMsgType('')
    try {
      const data = await addStickerPack(packId)
      if (data?.code === 1) {
        setAddMsg('已添加到我的表情')
        setAddMsgType('success')
      } else {
        setAddMsg(data?.msg || '添加失败')
        setAddMsgType('error')
      }
    } catch (err: any) {
      setAddMsg(err?.response?.data?.msg || '网络错误')
      setAddMsgType('error')
    } finally {
      setAddingSticker(false)
      if (addMsgType !== 'error') {
        setTimeout(() => {
          setAddMsg('')
          setAddMsgType('')
        }, 3000)
      }
    }
  }

  const toggleAuthorInfo = async () => {
    if (showAuthorInfo) {
      setShowAuthorInfo(false)
      setAuthorInfo(null)
      return
    }
    if (!packInfo?.authorId || loadingAuthor) return
    setLoadingAuthor(true)
    try {
      const data = await getUserInfo(packInfo.authorId)
      const u = data?.data
      setAuthorInfo({
        name: u?.name ? String(u.name) : '',
        avatarUrl: u?.avatarUrl ? String(u.avatarUrl) : '',
        registerTime: u?.registerTime ? String(u.registerTime) : '',
        onlineDay: typeof u?.onlineDay === 'object' ? u.onlineDay.toNumber() : (u?.onlineDay || 0),
        isVip: u?.isVip === 1,
      })
      setShowAuthorInfo(true)
    } catch (err) {
      console.error('Failed to get sticker author info:', err)
    } finally {
      setLoadingAuthor(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" />
      <div
        className="relative card-adw bg-[var(--adw-card)] w-full max-w-md max-h-[70vh] overflow-y-auto p-4 flex flex-col z-10 animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-8 h-8 border-3 border-[var(--adw-blue)]/20 border-t-[var(--adw-blue)] rounded-full animate-spin mb-3" />
            <span className="text-xs text-[var(--adw-fg-dim)]">加载中...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-xs text-red-500 mb-4">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-[var(--adw-hover)] text-xs font-semibold rounded-lg text-[var(--adw-fg)] cursor-pointer"
            >
              关闭
            </button>
          </div>
        ) : packInfo ? (
          <>
            <div className="flex items-center justify-between mb-4 border-b border-[var(--adw-border)]/[0.2] pb-3">
              <div>
                <h3 className="font-bold text-sm text-[var(--adw-fg)]">{packInfo.packName || '表情包预览'}</h3>
                <div className="text-[10px] text-[var(--adw-fg-dim)] mt-0.5">
                  共 {packInfo.stickerCount || packInfo.stickers.length} 个表情
                  {packInfo.authorName && (
                    <>
                      {' · '}作者：
                      <button
                        onClick={toggleAuthorInfo}
                        disabled={loadingAuthor}
                        className="text-[var(--adw-blue)] hover:underline font-bold disabled:opacity-50 cursor-pointer"
                      >
                        {packInfo.authorName}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-[var(--adw-hover)] text-[var(--adw-fg-dim)] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {showAuthorInfo && authorInfo && (
              <div className="bg-[var(--adw-window)] border border-[var(--adw-border)]/[0.2] rounded-xl p-3 mb-4 flex items-center gap-3 animate-in">
                <Avatar
                  src={authorInfo.avatarUrl ? resolveMediaUrl(authorInfo.avatarUrl) : undefined}
                  name={authorInfo.name}
                  sizeClass="w-10 h-10"
                />
                <div className="min-w-0 flex-1 text-xs">
                  <div className="font-bold text-[var(--adw-fg)]">{authorInfo.name}</div>
                  <div className="text-[10px] text-[var(--adw-fg-dim)] opacity-70 mt-0.5 space-x-1.5">
                    {authorInfo.registerTime && <span>注册于 {authorInfo.registerTime}</span>}
                    {authorInfo.onlineDay > 0 && <span>· 在线 {authorInfo.onlineDay} 天</span>}
                    {authorInfo.isVip && <span className="text-amber-500 font-bold">VIP</span>}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 gap-2 flex-1 overflow-y-auto custom-scrollbar pr-1 max-h-[40vh]">
              {packInfo.stickers.map((s: any) => (
                <div
                  key={s.id}
                  className="flex flex-col items-center gap-1 bg-[var(--adw-window)]/[0.3] p-1.5 rounded-lg border border-[var(--adw-border)]/[0.1]"
                >
                  <img
                    src={resolveMediaUrl(s.url)}
                    alt={s.name || ''}
                    className="w-full aspect-square object-contain"
                    loading="lazy"
                  />
                  {s.name && <span className="text-[8px] text-[var(--adw-fg-dim)] truncate w-full text-center">{s.name}</span>}
                </div>
              ))}
            </div>

            {packInfo.stickers.length === 0 && (
              <p className="text-[var(--adw-fg-dim)] text-xs text-center py-8 opacity-60">该表情包为空</p>
            )}

            <div className="mt-4 pt-3 border-t border-[var(--adw-border)]/[0.2] space-y-2">
              {addMsg && (
                <div
                  className={`text-xs px-3 py-2 rounded-lg font-bold ${
                    addMsgType === 'success'
                      ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                      : 'bg-red-500/10 text-red-500 border border-red-500/20'
                  }`}
                >
                  {addMsg}
                </div>
              )}
              <button
                onClick={handleAddSticker}
                disabled={addingSticker || addMsgType === 'success'}
                className={`w-full py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  addMsgType === 'success'
                    ? 'bg-green-500 text-white'
                    : 'bg-[var(--adw-blue)] hover:bg-[var(--adw-blue)]/90 text-white disabled:opacity-50'
                }`}
              >
                {addMsgType === 'success' ? '已添加' : addingSticker ? '添加中...' : '添加到我的表情'}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
})

StickerPreviewModal.displayName = 'StickerPreviewModal'
