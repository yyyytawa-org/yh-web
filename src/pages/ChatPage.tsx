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
import { useTheme } from '../contexts/ThemeContext'
import MessageList from '../components/chat/MessageList'
import InputArea from '../components/chat/InputArea'
import InfoPanel from '../components/chat/InfoPanel'
import RoomListPanel from '../components/chat/RoomListPanel'
import LivePanel from '../components/chat/LivePanel'
import AdwButton from '../components/chat/AdwButton'
import Avatar from '../components/chat/Avatar'
import type { QuoteMsg } from '../types/message'
import { 
  Search, 
  X, 
  ArrowLeft, 
  MoreVertical, 
  MessageSquare, 
  Users, 
  Settings, 
  Sun, 
  Moon, 
  LogOut, 
  ChevronDown, 
  Video,
  Info,
  User
} from 'lucide-react'

export default function ChatPage() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [convMd5, setConvMd5] = useState('')
  const loadingRef = useRef(false)
  const [searchKeyword, setSearchKeyword] = useState('')

  const handleBack = () => {
    setCurrentChat('', 0)
  }

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

  // User menu profile dropdown states
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [selfInfo, setSelfInfo] = useState<{ id: string; name: string; avatarUrl: string } | null>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const {
    conversations,
    currentChatId,
    currentChatType,
    setConversations,
    setCurrentChat,
  } = useChatStore()

  const currentConv = conversations.find((c) => c.chatId === currentChatId)
  const selfUserId = useAuthStore((s) => s.userId)
  const logout = useAuthStore((s) => s.logout)
  const userIdFetched = useRef(false)

  useEffect(() => {
    let cancelled = false
    getSelfInfo().then((res: any) => {
      if (cancelled) return
      const uid = res?.data?.id || ''
      const name = res?.data?.name || ''
      const avatar = res?.data?.avatar_url || res?.data?.avatarUrl || ''
      setSelfInfo({ id: uid, name, avatarUrl: avatar })

      const token = useAuthStore.getState().token
      if (uid && token && !useAuthStore.getState().userId) {
        useAuthStore.getState().login(token, uid)
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useWebSocket()

  const loadConversations = async (signal?: AbortSignal) => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    setError('')
    try {
      const resp = await getConversationList(convMd5 || '', signal)
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
      loadStickyList(signal)
    } catch (err: any) {
      if (err?.name !== 'AbortError' && err?.name !== 'CanceledError') {
        console.error('加载会话失败:', err)
        setError('加载会话失败')
      }
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }

  const loadStickyList = (signal?: AbortSignal) => {
    getStickyList(signal).then((res) => {
      if (res?.data?.sticky) setStickyIds(new Set(res.data.sticky.map((s: any) => s.chatId)))
    }).catch(() => {})
  }

  const loadGroupAdminInfo = async (groupId: string, signal?: AbortSignal) => {
    try {
      const data = await getGroupInfo(groupId, signal)
      const g = data?.data
      const admins = new Set<string>()
      if (g?.owner) { setOwnerId(g.owner); admins.add(g.owner) }
      if (g?.admin) g.admin.forEach((a: string) => admins.add(a))
      setAdminIds(admins)
      setIsGroupAdmin(admins.has(selfUserId || ''))
    } catch (err: any) {
      if (err?.name !== 'AbortError' && err?.name !== 'CanceledError') {
        setAdminIds(new Set())
        setOwnerId('')
        setIsGroupAdmin(false)
      }
    }
  }

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    if (currentChatId && currentChatType === 2) {
      const abortController = new AbortController()
      loadGroupAdminInfo(currentChatId, abortController.signal)
      return () => abortController.abort()
    }
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
  }

  const handleLogout = () => {
    if (confirm('确定要退出登录吗？')) {
      logout()
      navigate('/login', { replace: true })
    }
  }

  const renderConvItem = (conv: (typeof conversations)[0]) => {
    const isSelected = currentChatId === conv.chatId
    const isGroup = conv.chatType === 2
    return (
      <div
        key={conv.chatId}
        onClick={() => handleSelectChat(conv.chatId, conv.chatType)}
        className={`group flex items-center gap-3 p-3 mx-2 my-1 rounded-xl cursor-pointer transition-all duration-150 ${
          isSelected 
            ? 'bg-[var(--adw-card)] shadow-sm' 
            : 'hover:bg-[var(--adw-hover)]'
        }`}
      >
        <Avatar
          src={getAvatarUrl(conv)}
          name={getDisplayName(conv)}
          isGroup={isGroup}
          sizeClass="w-10 h-10"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className={`text-sm truncate ${isSelected ? 'font-bold text-[var(--adw-fg)]' : 'font-semibold opacity-90 text-[var(--adw-fg)]'}`}>
              {getDisplayName(conv)}
            </span>
            <span className="text-[10px] opacity-40 ml-2 shrink-0 text-[var(--adw-fg-dim)] font-medium">
              {formatTime(conv)}
            </span>
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-xs text-[var(--adw-fg-dim)] opacity-60 truncate">
              {conv.lastMsg || ''}
            </span>
            {conv.unread > 0 && (
              <span className="bg-[var(--adw-blue)] text-white text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center ml-1 shrink-0 font-bold leading-none shadow-xs">
                {conv.unread > 99 ? '99+' : conv.unread}
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  const isChatActive = !!currentChatId

  return (
    <div className="h-screen w-screen bg-[var(--adw-window)] text-[var(--adw-fg)] flex overflow-hidden font-cantarell relative transition-colors duration-200">
      {/* Left Sidebar */}
      <div 
        className={`
          w-full md:w-80 border-r border-[var(--adw-border)]/[0.2] shrink-0 flex flex-col
          ${isChatActive ? 'hidden md:flex' : 'flex'}
          bg-[var(--adw-window)]
        `}
      >
        {/* Sidebar Header Bar */}
        <div className="h-14 px-4 flex items-center justify-between shrink-0 relative">
          {/* User Avatar Menu Dropdown (Mimicking rcw/components/Sidebar.jsx) */}
          <div className="w-[68px] flex justify-start relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-8 h-8 rounded-full shadow-xs hover:ring-2 ring-[var(--adw-accent)]/30 transition-all overflow-hidden cursor-pointer focus:outline-none"
            >
              <Avatar
                src={selfInfo?.avatarUrl ? resolveMediaUrl(selfInfo.avatarUrl) : undefined}
                name={selfInfo?.name || '云湖用户'}
                sizeClass="w-8 h-8"
                isOwn={true}
              />
            </button>

            {showUserMenu && (
              <div className="absolute top-10 left-0 w-64 bg-[var(--adw-card)] rounded-2xl shadow-2xl border border-[var(--adw-border)]/[0.2] z-50 overflow-hidden animate-in">
                <div className="p-4 border-b border-[var(--adw-border)]/[0.2] bg-[var(--adw-view)]/[0.5]">
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={selfInfo?.avatarUrl ? resolveMediaUrl(selfInfo.avatarUrl) : undefined}
                      name={selfInfo?.name || '云湖用户'}
                      sizeClass="w-10 h-10"
                      isOwn={true}
                    />
                    <div className="overflow-hidden">
                      <p className="font-bold text-sm truncate">{selfInfo?.name || '云湖用户'}</p>
                      <p className="text-[10px] opacity-50 truncate">ID: {selfInfo?.id || '未登录'}</p>
                    </div>
                  </div>
                </div>
                <div className="p-1.5 space-y-0.5">
                  <button
                    onClick={() => { toggleTheme(); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-xs hover:bg-[var(--adw-hover)] rounded-lg transition-colors cursor-pointer text-left text-[var(--adw-fg)]"
                  >
                    {theme === 'dark' ? <Sun size={14} className="opacity-70 text-amber-500" /> : <Moon size={14} className="opacity-70 text-indigo-500" />}
                    <span>{theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}</span>
                  </button>
                  <div className="h-px bg-[var(--adw-border)]/[0.2] my-1" />
                  <button
                    onClick={() => { handleLogout(); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-xs text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer text-left"
                  >
                    <LogOut size={14} />
                    <span>退出登录</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex-1 flex justify-center">
            <span className="font-bold text-sm text-[var(--adw-fg-dim)] opacity-60">云湖消息</span>
          </div>

          <div className="w-[68px] flex justify-end gap-1">
            <AdwButton 
              ghost 
              iconOnly 
              onClick={() => navigate('/contacts')} 
              title="通讯录"
            >
              <Users size={18} className="text-[var(--adw-fg-dim)]" />
            </AdwButton>
            <AdwButton 
              ghost 
              iconOnly 
              onClick={() => navigate('/settings')} 
              title="设置"
            >
              <Settings size={18} className="text-[var(--adw-fg-dim)]" />
            </AdwButton>
          </div>
        </div>

        {/* Sidebar Search Bar */}
        <div className="px-4 mb-4 mt-1 shrink-0">
          <div className="relative flex items-center">
            <Search className="absolute left-3 text-[var(--adw-fg-dim)] opacity-50 pointer-events-none" size={14} />
            <input 
              type="text" 
              placeholder="搜索会话..." 
              value={searchKeyword} 
              onChange={(e) => setSearchKeyword(e.target.value)} 
              className="w-full pl-9 pr-8 py-2 bg-[var(--adw-view)]/[0.5] rounded-xl outline-none text-xs text-[var(--adw-fg)] placeholder-[var(--adw-fg-dim)]/50 transition-all"
            />
            {searchKeyword && (
              <button 
                onClick={() => setSearchKeyword('')} 
                className="absolute right-3 text-[var(--adw-fg-dim)] hover:text-[var(--adw-fg)] cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Sidebar Conversation List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-1">
          {error && <p className="text-red-500 text-xs text-center py-4">{error}</p>}
          {loading && conversations.length === 0 && <p className="text-[var(--adw-fg-dim)] text-xs text-center py-8 opacity-60">加载中...</p>}
          {!loading && conversations.length === 0 && !error && (
            <div className="text-center py-10 opacity-40">
              <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-xs">暂无会话</p>
            </div>
          )}
          
          {stickyConvs.length > 0 && (
            <div>
              <button 
                onClick={() => { 
                  const c = !stickyCollapsed
                  setStickyCollapsed(c)
                  localStorage.setItem('yh_sticky_collapsed', c ? '1' : '0') 
                }} 
                className="w-full flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--adw-fg-dim)] opacity-60 hover:bg-[var(--adw-hover)] transition-colors cursor-pointer"
              >
                <ChevronDown size={10} className={`transition-transform duration-200 ${stickyCollapsed ? '-rotate-90' : ''}`} />
                置顶消息 ({stickyConvs.length})
              </button>
              {!stickyCollapsed && stickyConvs.map(renderConvItem)}
            </div>
          )}
          
          {stickyConvs.length > 0 && normalConvs.length > 0 && (
            <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--adw-fg-dim)] opacity-60 mt-2">
              近期消息
            </div>
          )}
          {normalConvs.map(renderConvItem)}
        </div>
      </div>

      {/* Right Chat Area */}
      <div 
        className={`
          flex-1 flex flex-col min-w-0 bg-[var(--adw-window)] relative
          ${!isChatActive ? 'hidden md:flex' : 'flex'}
        `}
      >
        {!currentConv ? (
          /* Empty Chat View */
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--adw-fg-dim)] bg-[var(--adw-window)]">
            <div className="w-16 h-16 bg-[var(--adw-card)] border border-[var(--adw-border)]/[0.2] rounded-full flex items-center justify-center mb-4 text-[var(--adw-fg-dim)] opacity-80 shadow-xs">
              <MessageSquare size={32} />
            </div>
            <h2 className="font-bold text-[var(--adw-fg)] text-base mb-1">开始聊聊天吧</h2>
            <p className="text-xs text-[var(--adw-fg-dim)] max-w-[200px] text-center opacity-70">从左侧列表选择一个好友或群聊，开启云湖新体验。</p>
          </div>
        ) : (
          /* Active Chat View */
          <>
            {/* Header Bar */}
            <div className="h-14 border-b border-[var(--adw-border)]/[0.2] flex items-center px-4 justify-between shrink-0 z-10 relative">
              {/* Left positioned elements */}
              <div className="flex items-center absolute left-4 gap-2">
                <AdwButton 
                  ghost 
                  iconOnly 
                  className="md:hidden shrink-0" 
                  onClick={handleBack}
                >
                  <ArrowLeft size={18} className="text-[var(--adw-fg-dim)]" />
                </AdwButton>
                
                <Avatar
                  src={getAvatarUrl(currentConv)}
                  name={getDisplayName(currentConv)}
                  isGroup={currentChatType === 2}
                  sizeClass="w-8 h-8"
                />
              </div>

              {/* Centered title and subtitle */}
              <div className="flex-1 flex flex-col items-center justify-center overflow-hidden px-16">
                <h2 className="font-bold text-sm truncate max-w-full text-[var(--adw-fg)]">
                  {getDisplayName(currentConv)}
                </h2>
                <p className="text-[10px] text-[var(--adw-fg-dim)] opacity-40 flex items-center gap-1 truncate max-w-full">
                  {currentChatType === 2 ? '群聊会话' : '单聊会话'}
                </p>
              </div>

              {/* Right positioned actions */}
              <div className="absolute right-4">
                <div className="relative">
                  <AdwButton 
                    ghost 
                    iconOnly 
                    onClick={() => setMenuOpen(!menuOpen)} 
                    active={menuOpen}
                  >
                    <MoreVertical size={18} className="text-[var(--adw-fg-dim)]" />
                  </AdwButton>

                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-1.5 bg-[var(--adw-card)] rounded-xl shadow-lg border border-[var(--adw-border)]/[0.2] z-20 p-1 w-38 animate-in">
                        <button 
                          onClick={() => { setShowInfo(true); setMenuOpen(false) }} 
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[var(--adw-fg)] hover:bg-[var(--adw-hover)] rounded-lg transition-colors cursor-pointer text-left"
                        >
                          <Info size={14} className="opacity-70" />查看详情
                        </button>
                        {currentChatType === 2 && (
                          <button 
                            onClick={() => { setShowRoomList(true); setMenuOpen(false) }} 
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[var(--adw-fg)] hover:bg-[var(--adw-hover)] rounded-lg transition-colors cursor-pointer text-left"
                          >
                            <Video size={14} className="opacity-70" />语音房间
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Message list area */}
            <div className="flex-1 flex min-h-0 relative bg-[var(--adw-window)]">
              <MessageList adminIds={adminIds} ownerId={ownerId} onQuote={setQuoteMsg} quoteMsg={quoteMsg} />
            </div>

            {/* Input bottom area */}
            <InputArea quoteMsg={quoteMsg} onClearQuote={() => setQuoteMsg(null)} />
          </>
        )}
      </div>

      {/* Side panels */}
      {showInfo && (
        <InfoPanel onClose={() => setShowInfo(false)} isAdmin={isGroupAdmin} chatId={currentChatId || ''} />
      )}
      {showRoomList && currentChatId && currentChatType === 2 && (
        <RoomListPanel 
          chatId={currentChatId} 
          onClose={() => setShowRoomList(false)} 
          onJoin={(roomId, title) => { 
            setShowRoomList(false) 
            setLiveRoom({ roomId, chatId: currentChatId!, title }) 
          }} 
        />
      )}
      {liveRoom && (
        <LivePanel 
          roomId={liveRoom.roomId} 
          chatId={liveRoom.chatId} 
          title={liveRoom.title} 
          onClose={() => setLiveRoom(null)} 
        />
      )}
    </div>
  )
}