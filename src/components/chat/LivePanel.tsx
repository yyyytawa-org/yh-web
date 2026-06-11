import { useState, useEffect, useRef, useCallback } from 'react'
import { getJoinToken, getStreamKey } from '../../api/live'
import { connectLiveKit, disconnectLiveKit, setLiveKitCallbacks, getCurrentRoom } from '../../api/livekit'
import { getUserInfo } from '../../api/user'
import { resolveMediaUrl } from '../../store/settingsStore'

interface ParticipantTile {
  id: string
  name: string
  avatarUrl: string
  videoTrack: any
  audioTrack: any
  volume: number
}

export default function LivePanel({ roomId, chatId, title, onClose }: {
  roomId: string
  chatId: string
  title: string
  onClose: () => void
}) {
  const [participants, setParticipants] = useState<ParticipantTile[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const [popout, setPopout] = useState(false)

  const [popoutPos, setPopoutPos] = useState({ x: window.innerWidth - 310, y: window.innerHeight - 420 })
  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map())
  const attachedTracks = useRef<Set<string>>(new Set())

  const [micMuted, setMicMuted] = useState(false)
  const [hasMic, setHasMic] = useState(false)
  const [allMuted, setAllMuted] = useState(false)

  const [streamKey, setStreamKey] = useState('')
  const [streamUrl, setStreamUrl] = useState('')
  const [streamKeyLoading, setStreamKeyLoading] = useState(false)
  const [streamKeyError, setStreamKeyError] = useState('')
  const [copied, setCopied] = useState(false)

  const ensureParticipant = useCallback((id: string, updates?: Partial<ParticipantTile>) => {
    setParticipants((prev) => {
      const existing = prev.find((p) => p.id === id)
      if (existing) {
        return prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
      }
      getUserInfo(id).then((data) => {
        const u = data?.data
        setParticipants((prev2) =>
          prev2.map((p) =>
            p.id === id ? { ...p, name: u?.name || id, avatarUrl: u?.avatarUrl || '' } : p,
          ),
        )
      }).catch(() => {})
      return [...prev, { id, name: id, avatarUrl: '', videoTrack: null, audioTrack: null, volume: 100, ...updates }]
    })
  }, [])

  const attachTracks = useCallback(() => {
    participants.forEach((p) => {
      const key = p.id
      if (attachedTracks.current.has(key)) return
      const videoEl = videoRefs.current.get(key)
      const audioEl = audioRefs.current.get(key)
      if (videoEl && p.videoTrack && !videoEl.srcObject) {
        p.videoTrack.attach(videoEl)
        videoEl.play().catch(() => {})
        attachedTracks.current.add(key)
      }
      if (audioEl && p.audioTrack && !audioEl.srcObject) {
        p.audioTrack.attach(audioEl)
      }
    })
  }, [participants])

  useEffect(() => {
    setLiveKitCallbacks({
      onTrackSubscribed: (track, participant) => {
        ensureParticipant(participant.identity, {
          [track.kind === 'video' ? 'videoTrack' : 'audioTrack']: track,
        })
      },
      onTrackUnsubscribed: (participantId) => {
        attachedTracks.current.delete(participantId)
        setParticipants((prev) => prev.filter((p) => p.id !== participantId))
      },
      onDisconnected: () => setConnected(false),
    })

    getJoinToken(roomId, chatId).then((data) => {
      const token = data?.data?.joinToken
      if (token) connectLiveKit(token).then(() => setConnected(true)).catch((err) => setError(err.message))
      else setError('获取 token 失败')
    }).catch((err) => setError(err.message))

    return () => { disconnectLiveKit() }
  }, [roomId, chatId, ensureParticipant])

  /** 小窗切换时清除绑定缓存，强制重新 attach */
  useEffect(() => {
    attachedTracks.current.clear()
    videoRefs.current.clear()
    audioRefs.current.clear()
  }, [popout])

  useEffect(() => {
    const timer = setTimeout(() => attachTracks(), 50)
    return () => clearTimeout(timer)
  }, [participants, popout, attachTracks])

  const setVolume = (id: string, vol: number) => {
    setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, volume: vol } : p)))
    const room = getCurrentRoom()
    if (room) {
      const rp = room.remoteParticipants.get(id)
      if (rp) {
        rp.audioTrackPublications.forEach((pub) => {
          if (pub.track) (pub.track as any).setVolume(vol / 100)
        })
      }
    }
  }

  const toggleMic = async () => {
    const room = getCurrentRoom()
    if (!room) return
    if (!hasMic) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const audioTrack = stream.getAudioTracks()[0]
        await room.localParticipant.publishTrack(audioTrack)
        setHasMic(true)
        setMicMuted(false)
      } catch { /* 用户拒绝 */ }
    } else {
      const pub = room.localParticipant.audioTrackPublications.values().next().value
      if (pub?.track) {
        if (micMuted) { pub.track.unmute(); setMicMuted(false) }
        else { pub.track.mute(); setMicMuted(true) }
      }
    }
  }

  const toggleAllMute = () => {
    const room = getCurrentRoom()
    if (!room) return
    const mute = !allMuted
    setAllMuted(mute)
    setParticipants((prev) => prev.map((p) => ({ ...p, volume: mute ? 0 : 100 })))
    room.remoteParticipants.forEach((rp) => {
      rp.audioTrackPublications.forEach((pub) => {
        if (pub.track) (pub.track as any).setVolume(mute ? 0 : 1)
      })
    })
  }

  const fetchStreamKey = async () => {
    setStreamKeyLoading(true)
    setStreamKeyError('')
    try {
      const data = await getStreamKey(roomId)
      if (data?.code === 1) {
        setStreamKey(data?.data?.streamKey || '')
        setStreamUrl(data?.data?.url || '')
      } else {
        setStreamKeyError(data?.msg || '获取推流码失败')
      }
    } catch (err: any) {
      setStreamKeyError(err?.message || '网络错误')
    } finally {
      setStreamKeyLoading(false)
    }
  }

  const handleCopyStreamKey = () => {
    if (streamKey) {
      navigator.clipboard.writeText(streamKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handlePopoutMouseDown = (e: React.MouseEvent) => {
    dragging.current = true
    dragOffset.current = { x: e.clientX - popoutPos.x, y: e.clientY - popoutPos.y }
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      setPopoutPos({ x: ev.clientX - dragOffset.current.x, y: ev.clientY - dragOffset.current.y })
    }
    const onUp = () => {
      dragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const handlePopoutTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    dragging.current = true
    dragOffset.current = { x: touch.clientX - popoutPos.x, y: touch.clientY - popoutPos.y }
  }

  const handlePopoutTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current) return
    const touch = e.touches[0]
    setPopoutPos({ x: touch.clientX - dragOffset.current.x, y: touch.clientY - dragOffset.current.y })
  }

  const handlePopoutTouchEnd = () => { dragging.current = false }

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const el = document.getElementById('popout-window')
    if (!el) return
    const startW = el.offsetWidth
    const startH = el.offsetHeight
    const onMove = (ev: MouseEvent) => {
      el.style.width = Math.max(200, startW + ev.clientX - startX) + 'px'
      el.style.height = Math.max(150, startH + ev.clientY - startY) + 'px'
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const renderParticipant = (p: ParticipantTile, compact: boolean) => (
    <div key={p.id} className="bg-gray-50 rounded-xl overflow-hidden">
      {p.videoTrack ? (
        <div className="bg-black aspect-video relative">
          <video
            ref={(el) => { if (el) videoRefs.current.set(p.id, el) }}
            className="w-full h-full object-contain"
            muted autoPlay playsInline controls
          />
          <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent ${compact ? 'p-1.5' : 'p-2'}`}>
            <span className={`text-white ${compact ? 'text-[10px]' : 'text-xs'}`}>{p.name}</span>
          </div>
        </div>
      ) : (
        <div className="aspect-video bg-gray-100 flex items-center justify-center relative">
          {p.avatarUrl ? (
            <img src={resolveMediaUrl(p.avatarUrl)} alt="" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center text-white text-xl font-medium">
              {p.name[0] || '?'}
            </div>
          )}
          <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/30 to-transparent ${compact ? 'p-1.5' : 'p-2'}`}>
            <span className={`text-white ${compact ? 'text-[10px]' : 'text-xs'}`}>{p.name}</span>
          </div>
        </div>
      )}
      {p.audioTrack && (
        <div className={`flex items-center gap-2 ${compact ? 'px-2 py-1.5' : 'px-3 py-2'}`}>
          <svg width={compact ? 12 : 14} height={compact ? 12 : 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 shrink-0">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
          <input type="range" min="0" max="100" value={p.volume} onChange={(e) => setVolume(p.id, parseInt(e.target.value))} className="flex-1 h-1.5 appearance-none bg-gray-200 rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full" />
          <span className={`text-gray-400 ${compact ? 'text-[10px] w-6' : 'text-xs w-8'} text-right`}>{p.volume}%</span>
        </div>
      )}
      <audio ref={(el) => { if (el) audioRefs.current.set(p.id, el) }} autoPlay className="hidden" />
    </div>
  )

  const renderBottomBar = () => (
    <div className="flex items-center justify-center gap-6 p-3 border-t border-gray-100">
      <button onClick={toggleMic} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${micMuted || !hasMic ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {hasMic && !micMuted ? (
            <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></>
          ) : (
            <><line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" /><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></>
          )}
        </svg>
      </button>

      <button onClick={toggleAllMute} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${allMuted ? 'bg-orange-100 text-orange-500' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {allMuted ? (
            <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></>
          ) : (
            <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></>
          )}
        </svg>
      </button>

      <button onClick={onClose} className="w-12 h-12 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      </button>
    </div>
  )

  if (popout) {
    return (
      <div id="popout-window" className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col" style={{ left: popoutPos.x, top: popoutPos.y, width: 288, maxHeight: '60vh' }}>
        <div
          className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100 cursor-grab active:cursor-grabbing select-none shrink-0"
          style={{ touchAction: 'none' }}
          onMouseDown={handlePopoutMouseDown}
          onTouchStart={handlePopoutTouchStart} onTouchMove={handlePopoutTouchMove} onTouchEnd={handlePopoutTouchEnd}
        >
          <span className="text-xs font-medium text-gray-600 truncate">🎙️ {title} · {participants.length} 人</span>
          <button onClick={() => setPopout(false)} className="text-gray-400 hover:text-gray-600 p-1" title="还原">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain p-2 space-y-2">
          {participants.map((p) => renderParticipant(p, true))}
          {participants.length === 0 && <p className="text-gray-400 text-[10px] text-center py-4">等待参与者...</p>}
        </div>
        <div className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize" onMouseDown={handleResizeMouseDown}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" className="absolute bottom-0.5 right-0.5"><polyline points="21 3 21 21 3 21" /></svg>
        </div>
      </div>
    )
  }

  return (
    <div className="w-80 border-l border-gray-200 bg-white flex flex-col shrink-0 h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
        <div className="min-w-0 flex-1 mr-2">
          <h3 className="font-medium text-sm text-gray-800 truncate">🎙️ {title}</h3>
          <span className={`text-xs ${connected ? 'text-green-500' : 'text-gray-400'}`}>
            {connected ? `已连接 · ${participants.length} 人` : error || '连接中...'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!streamKey ? (
            <button onClick={fetchStreamKey} disabled={streamKeyLoading} className="text-gray-400 hover:text-gray-600 p-1 text-[10px]" title="获取推流码">{streamKeyLoading ? '...' : '🔑'}</button>
          ) : (
            <button onClick={handleCopyStreamKey} className="text-gray-400 hover:text-gray-600 p-1 text-[10px]" title="复制推流码">{copied ? '✓' : '📋'}</button>
          )}
          <button onClick={() => setPopout(true)} className="text-gray-400 hover:text-gray-600 p-1" title="小窗模式">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="5" y="5" width="14" height="14" rx="2" /><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
            </svg>
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {(streamKey || streamKeyError) && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs shrink-0">
          {streamKeyError ? <span className="text-red-500">{streamKeyError}</span> : (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2"><span className="text-gray-400 shrink-0">推流地址：</span><span className="text-gray-600 truncate text-[11px]">{streamUrl}</span></div>
              <div className="flex items-center gap-2"><span className="text-gray-400 shrink-0">推流码：</span><span className="text-gray-600 truncate flex-1 text-[11px]">{streamKey}</span><button onClick={handleCopyStreamKey} className="text-blue-500 hover:text-blue-600 shrink-0 text-[11px]">{copied ? '已复制' : '复制'}</button></div>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-3">
        {participants.map((p) => renderParticipant(p, false))}
        {participants.length === 0 && connected && <p className="text-gray-400 text-sm text-center py-8">等待其他参与者加入...</p>}
      </div>

      {renderBottomBar()}
    </div>
  )
}