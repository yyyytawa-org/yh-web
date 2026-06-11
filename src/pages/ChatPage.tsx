import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getConversationList, dismissNotification, getStickyList } from '../api/conversation'
import { getSelfInfo } from '../api/user'
import { getGroupInfo } from '../api/group'
import { useChatStore } from '../store/chatStore'
import { useAuthStore } from '../store/authStore'
import { resolveMediaUrl } from '../store/settingsStore'
import { toNumber, toString } from '../utils/convert'
import { useWebSocket } from '../hooks/useWebSocket'
import MessageList from '../components/chat/MessageList'
import InputArea from '../components/chat/InputArea'
import InfoPanel from '../components/chat/InfoPanel'
import RoomListPanel from '../components/chat/RoomListPanel'
import LivePanel from '../components/chat/LivePanel'
import type { QuoteMsg } from '../types/message'

export default function ChatPage() {
  const navigate = useNavigate()

  const [showSidebar, setShowSidebar] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [convMd5, setConvMd5] = useState('')
  const loadingRef = useRef(false)
  const [searchKeyword, setSearchKeyword] = useState('')

  const [stickyIds, setStickyIds] = useState<Set<string>>(new Set())
  const [stickyCollapsed, setStickyCollapsed] = useState(() => localStorage.getItem('yh_sticky_collapsed') === '1')

  const [showInfo, setShowInfo] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showRoomList, setShowRoomList] = useState(false)
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set())
  const [ownerId, setOwnerId] = useState('')
  const [isGroupAdmin, setIsGroupAdmin] = useState(false)

  const [quoteMsg, setQuoteMsg] = useState<QuoteMsg | null>(null)
  const [liveRoom, setLiveRoom] = useState<{ roomId: string; chatId: string; title: string } | null>(null)

  const {
    conversations,
    currentChatId,
    currentChatType,
    setConversations,
    setCurrentChat,
  } = useChatStore()

  const currentConv = conversations.find((c) => c.chatId === currentChatId)
  const selfUserId = useAuthStore((s) => s.userId)
  const userIdFetched = useRef(false)

  useEffect(() => {
    if (useAuthStore.getState().userId) return
    if (userIdFetched.current) return
    userIdFetched.current = true
    let cancelled = false
    getSelfInfo().then((res: any) => {
      if (cancelled) return
      const uid = res?.data?.id || ''
      const token = useAuthStore.getState().token
      if (uid && token && !useAuthStore.getState().userId) {
        useAuthStore.getState().login(token, uid)
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  useWebSocket()

  const loadConversations = async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    setError('')
    try {
      const resp = await getConversationList(convMd5 || '')
      const dataList = resp.data || []
      if (dataList.length > 0) {
        const list = dataList.map((item: any) => ({
          chatId: toString(item.chatId),
          chatType: toNumber(item.chatType),
          name: toString(item.name),
          avatarUrl: toString(item.avatarUrl),
          lastMsg: toString(item.chatContent),
          unread: toNumber(item.unreadMessage),
          remark: toString(item.remark),
          doNotDisturb: !!item.doNotDisturb,
          sendTimestamp: toNumber(item.sendTimestamp),
        }))
        setConversations(list)
        if (resp.md5) setConvMd5(resp.md5)
      }
      // 只在首次加载后刷新置顶列表
      loadStickyList()
    } catch (err) {
      console.error('加载会话失败:', err)
      setError('加载会话失败')
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }

  const loadStickyList = () => {
    getStickyList().then((res) => {
      if (res?.data?.sticky) setStickyIds(new Set(res.data.sticky.map((s: any) => s.chatId)))
    }).catch(() => {})
  }

  const loadGroupAdminInfo = async (groupId: string) => {
    try {
      const data = await getGroupInfo(groupId)
      const g = data?.data
      const admins = new Set<string>()
      if (g?.owner) { setOwnerId(g.owner); admins.add(g.owner) }
      if (g?.admin) g.admin.forEach((a: string) => admins.add(a))
      setAdminIds(admins)
      setIsGroupAdmin(admins.has(selfUserId || ''))
    } catch { setAdminIds(new Set()); setOwnerId(''); setIsGroupAdmin(false) }
  }

  useEffect(() => { loadConversations() }, [])
  useEffect(() => {
    if (currentChatId && currentChatType === 2) loadGroupAdminInfo(currentChatId)
    else { setAdminIds(new Set()); setOwnerId(''); setIsGroupAdmin(false) }
  }, [currentChatId, currentChatType, selfUserId])

  const getDisplayName = (conv: (typeof conversations)[0]) => conv.remark || conv.name || '未知'
  const getAvatarUrl = (conv: (typeof conversations)[0]) => {
    if (conv.avatarUrl) return resolveMediaUrl(conv.avatarUrl)
    return ''
  }
  const formatTime = (conv: (typeof conversations)[0]) => {
    const sec = conv.sendTimestamp || 0
    if (!sec) return ''
    const d = new Date(sec * 1000)
    if (isNaN(d.getTime())) return ''
    const now = new Date()
    if (d.toDateString() === now.toDateString()) {
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    }
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  const filteredConversations = conversations.filter((conv) => {
    if (!searchKeyword.trim()) return true
    const keyword = searchKeyword.toLowerCase()
    return getDisplayName(conv).toLowerCase().includes(keyword) || (conv.lastMsg || '').toLowerCase().includes(keyword)
  })

  const stickyConvs = filteredConversations.filter((c) => stickyIds.has(c.chatId))
  const normalConvs = filteredConversations.filter((c) => !stickyIds.has(c.chatId))

  const handleSelectChat = (chatId: string, chatType: number) => {
    setCurrentChat(chatId, chatType)
    setShowInfo(false)
    setShowRoomList(false)
    setMenuOpen(false)
    setQuoteMsg(null)
    const conv = conversations.find((c) => c.chatId === chatId)
    if (conv && conv.unread > 0) {
      dismissNotification(chatId)
      useChatStore.getState().updateConversation(chatId, { unread: 0 })
    }
    if (showSidebar) setShowSidebar(false)
  }

  const renderConvItem = (conv: (typeof conversations)[0]) => (
    <div
      key={conv.chatId}
      onClick={() => handleSelectChat(conv.chatId, conv.chatType)}
      className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors ${currentChatId === conv.chatId ? 'bg-blue-50' : ''}`}
    >
      <div className="w-12 h-12 rounded-full bg-gray-300 shrink-0 overflow-hidden flex items-center justify-center">
        {getAvatarUrl(conv) ? (
          <img src={getAvatarUrl(conv)} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white text-lg font-medium bg-gradient-to-br from-blue-400 to-blue-500">
            {getDisplayName(conv)[0]}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-800 truncate">{getDisplayName(conv)}</span>
          <span className="text-xs text-gray-400 ml-2 shrink-0">{formatTime(conv)}</span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-xs text-gray-500 truncate">{conv.lastMsg || ''}</span>
          {conv.unread > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center ml-1 shrink-0 leading-none">
              {conv.unread > 99 ? '99+' : conv.unread}
            </span>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="h-full flex bg-white">
      {showSidebar && <div className="fixed inset-0 bg-black/30 z-20 lg:hidden" onClick={() => setShowSidebar(false)} />}

      {/* 左侧会话列表 */}
      <div className={`fixed lg:static inset-y-0 left-0 z-30 w-72 bg-gray-50 border-r border-gray-200 transition-transform lg:translate-x-0 flex flex-col ${showSidebar ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between shrink-0">
          <h2 className="font-semibold text-gray-800">消息</h2>
          <div className="flex gap-3">
            <button onClick={() => navigate('/contacts')} className="text-gray-400 hover:text-gray-600 text-sm">通讯录</button>
            <button onClick={() => navigate('/settings')} className="text-gray-400 hover:text-gray-600 text-sm">设置</button>
          </div>
        </div>
        <div className="px-3 py-2 shrink-0">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input type="text" placeholder="搜索会话..." value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-300" />
            {searchKeyword && (
              <button onClick={() => setSearchKeyword('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {error && <p className="text-red-500 text-sm text-center py-4">{error}</p>}
          {loading && conversations.length === 0 && <p className="text-gray-400 text-sm text-center py-8">加载中...</p>}
          {!loading && conversations.length === 0 && !error && <p className="text-gray-400 text-sm text-center py-8">暂无会话</p>}
          {stickyConvs.length > 0 && (
            <div>
              <button onClick={() => { const c = !stickyCollapsed; setStickyCollapsed(c); localStorage.setItem('yh_sticky_collapsed', c ? '1' : '0') }} className="w-full flex items-center gap-1 px-4 py-2 text-xs text-gray-400 hover:bg-gray-100 transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${stickyCollapsed ? '' : 'rotate-90'}`}><polyline points="9 18 15 12 9 6" /></svg>
                置顶 {stickyConvs.length}
              </button>
              {!stickyCollapsed && stickyConvs.map(renderConvItem)}
            </div>
          )}
          {stickyConvs.length > 0 && normalConvs.length > 0 && <div className="px-4 py-2 text-xs text-gray-400">消息</div>}
          {normalConvs.map(renderConvItem)}
        </div>
      </div>

      {/* 右侧区域 */}
      <div className="flex-1 flex min-w-0">
        <div className="flex-1 flex flex-col min-w-0">
          {!currentConv ? (
            <div className="flex-1 flex flex-col min-w-0">
              <div className="h-14 border-b border-gray-200 bg-[#f5f5f5] flex items-center px-4 shrink-0">
                <button className="lg:hidden text-gray-400 hover:text-gray-600" onClick={() => setShowSidebar(true)}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
                </button>
              </div>
              <div className="flex-1 bg-[#f5f5f5]" />
            </div>
          ) : (
            <>
              <div className="h-14 border-b border-gray-200 bg-white flex items-center px-4 gap-3 shrink-0">
                <button className="lg:hidden text-gray-400 hover:text-gray-600" onClick={() => setShowSidebar(true)}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
                </button>
                <div className="w-9 h-9 rounded-full bg-gray-300 shrink-0 overflow-hidden flex items-center justify-center">
                  {getAvatarUrl(currentConv) ? (
                    <img src={getAvatarUrl(currentConv)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-sm bg-gradient-to-br from-blue-400 to-blue-500">{getDisplayName(currentConv)[0]}</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm text-gray-800 truncate">{getDisplayName(currentConv)}</div>
                </div>
                <div className="relative">
                  <button onClick={() => setMenuOpen(!menuOpen)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>
                  </button>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 z-20 py-1 w-36">
                        <button onClick={() => { setShowInfo(true); setMenuOpen(false) }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>查看详情
                        </button>
                        {currentChatType === 2 && (
                          <button onClick={() => { setShowRoomList(true); setMenuOpen(false) }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>语音房间
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <MessageList adminIds={adminIds} ownerId={ownerId} onQuote={setQuoteMsg} quoteMsg={quoteMsg} />
              <InputArea quoteMsg={quoteMsg} onClearQuote={() => setQuoteMsg(null)} />
            </>
          )}
        </div>

        {showInfo && <InfoPanel onClose={() => setShowInfo(false)} isAdmin={isGroupAdmin} chatId={currentChatId || ''} />}
        {showRoomList && currentChatId && currentChatType === 2 && (
          <RoomListPanel chatId={currentChatId} onClose={() => setShowRoomList(false)} onJoin={(roomId, title) => { setShowRoomList(false); setLiveRoom({ roomId, chatId: currentChatId!, title }) }} />
        )}
        {liveRoom && <LivePanel roomId={liveRoom.roomId} chatId={liveRoom.chatId} title={liveRoom.title} onClose={() => setLiveRoom(null)} />}
      </div>
    </div>
  )
}