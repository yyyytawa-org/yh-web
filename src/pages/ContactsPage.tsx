import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAddressBook, getRequestList } from '../api/friend'
import { useChatStore } from '../store/chatStore'
import { resolveMediaUrl } from '../store/settingsStore'
import { toNumber, toString } from '../utils/convert'
import AdwButton from '../components/chat/AdwButton'
import Avatar from '../components/chat/Avatar'
import { 
  ArrowLeft, 
  Search, 
  X, 
  ChevronRight, 
  ChevronDown, 
  User, 
  UserPlus, 
  ShieldAlert, 
  Shield 
} from 'lucide-react'

interface ContactItem {
  chatId: string
  chatType: number
  name: string
  avatarUrl: string
  remark: string
  permissionLevel: number
}

interface ContactGroup {
  listName: string
  chatType: number
  items: ContactItem[]
}

interface RequestItem {
  id: number
  name: string
  avatar: string
  groupName: string
  groupAvatar: string
  targetType: number
  targetId: string
  receiverName: string
  receiverAvatar: string
  inviteAtStr: string
  note: string
  result: number
}

const CHAT_TYPE_ORDER: Record<number, number> = {
  1: 0,  // 用户
  2: 1,  // 群聊
  3: 2,  // 机器人
}

const CHAT_TYPE_NAMES: Record<number, string> = {
  1: '好友',
  2: '群聊',
  3: '机器人',
}

export default function ContactsPage() {
  const navigate = useNavigate()
  const { setCurrentChat } = useChatStore()
  const [groups, setGroups] = useState<ContactGroup[]>([])
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [requestsCollapsed, setRequestsCollapsed] = useState(true)

  // 在加载完数据后折叠所有分组
  useEffect(() => {
    if (groups.length > 0 && collapsedGroups.size === 0) {
      setCollapsedGroups(new Set(groups.map((g) => g.listName)))
    }
  }, [groups])
  const loadedRef = useRef(false)

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    Promise.all([
      getAddressBook(),
      getRequestList(),
    ]).then(([addrResp, reqResp]) => {
      // 通讯录
      const data = addrResp?.data || []
      const gs: ContactGroup[] = data
        .map((g: any) => ({
          listName: toString(g.listName || g.list_name),
          chatType: toNumber(g.chatType),
          items: (g.data || []).map((item: any) => ({
            chatId: toString(item.chatId),
            chatType: toNumber(g.chatType),
            name: toString(item.name || item.chatName || item.remark),
            avatarUrl: toString(item.avatarUrl || item.chatAvatarUrl),
            remark: toString(item.remark),
            permissionLevel: toNumber(item.permissonLevel),
          })),
        }))
        .sort((a: ContactGroup, b: ContactGroup) =>
          (CHAT_TYPE_ORDER[a.chatType] ?? 99) - (CHAT_TYPE_ORDER[b.chatType] ?? 99),
        )

      // 每组内按名称排序
      gs.forEach((g) => {
        g.items.sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b), 'zh'))
      })

      setGroups(gs)

      // 好友请求
      const reqs = (reqResp?.requests || []).map((r: any) => ({
        id: toNumber(r.requestId),
        name: toString(r.name),
        avatar: toString(r.avatar),
        groupName: toString(r.groupName),
        groupAvatar: toString(r.groupAvatar),
        targetType: toNumber(r.targetType),
        targetId: toString(r.targetId),
        receiverName: toString(r.receiverName),
        receiverAvatar: toString(r.receiverAvatar),
        inviteAtStr: toString(r.inviteAtStr),
        note: toString(r.note),
        result: toNumber(r.result),
      }))
      setRequests(reqs)

      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const toggleGroup = (name: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const getDisplayName = (item: ContactItem) => item.remark || item.name || '未知'

  const getAvatarUrl = (item: ContactItem | { avatarUrl?: string; avatar?: string }) => {
    const url = 'avatarUrl' in item ? item.avatarUrl : 'avatar' in item ? (item as any).avatar : ''
    if (url) return resolveMediaUrl(url)
    return ''
  }

  const filteredGroups = groups.map((g) => ({
    ...g,
    items: g.items.filter((item) => {
      if (!searchKeyword.trim()) return true
      const kw = searchKeyword.toLowerCase()
      return getDisplayName(item).toLowerCase().includes(kw)
    }),
  })).filter((g) => g.items.length > 0)

  const pendingRequests = requests.filter((r) => r.result === 0)

  return (
    <div className="h-screen flex flex-col bg-[var(--adw-window)] text-[var(--adw-fg)] overflow-hidden font-cantarell transition-colors duration-200">
      {/* Header Bar */}
      <div className="header-bar shrink-0">
        <AdwButton 
          ghost 
          iconOnly 
          onClick={() => navigate('/chat')} 
          title="返回聊天"
        >
          <ArrowLeft size={18} className="text-[var(--adw-fg-dim)]" />
        </AdwButton>
        <h2 className="font-bold text-sm text-[var(--adw-fg)]">通讯录</h2>
        <div className="w-9 h-9" /> {/* Spacer */}
      </div>

      {/* Search Bar */}
      <div className="px-4 py-3 bg-[var(--adw-view)] border-b border-[var(--adw-border)]/[0.2] shrink-0">
        <div className="relative flex items-center max-w-xl mx-auto">
          <Search className="absolute left-3.5 text-[var(--adw-fg-dim)] opacity-50 pointer-events-none" size={14} />
          <input
            type="text"
            placeholder="搜索联系人..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full pl-10 pr-9 py-2 bg-[var(--adw-window)]/[0.5] rounded-xl outline-none text-xs text-[var(--adw-fg)] placeholder-[var(--adw-fg-dim)]/50 transition-all"
          />
          {searchKeyword && (
            <button
              onClick={() => setSearchKeyword('')}
              className="absolute right-3.5 text-[var(--adw-fg-dim)] hover:text-[var(--adw-fg)] cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
        <div className="max-w-xl mx-auto space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-60">
              <div className="w-6 h-6 border-2 border-[var(--adw-blue)]/20 border-t-[var(--adw-blue)] rounded-full animate-spin" />
              <p className="text-xs">加载通讯录...</p>
            </div>
          ) : (
            <>
              {/* 好友请求 */}
              {pendingRequests.length > 0 && !searchKeyword && (
                <div className="card-adw overflow-hidden bg-[var(--adw-card)]">
                  <button
                    onClick={() => setRequestsCollapsed(!requestsCollapsed)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--adw-hover)] transition-colors text-xs font-bold uppercase tracking-wider text-[var(--adw-fg-dim)] cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <UserPlus size={14} className="text-[var(--adw-blue)]" />
                      <span>新的朋友</span>
                      <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold shadow-xs">
                        {pendingRequests.length}
                      </span>
                    </div>
                    {requestsCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </button>
                  
                  {!requestsCollapsed && (
                    <div className="border-t border-[var(--adw-border)]/[0.2] divide-y divide-[var(--adw-border)]/[0.1]">
                      {pendingRequests.map((r) => (
                        <div key={r.id} className="flex items-center gap-3 px-4 py-3 bg-[var(--adw-view)]">
                          <Avatar
                            src={r.avatar ? resolveMediaUrl(r.avatar) : undefined}
                            name={r.name}
                            sizeClass="w-10 h-10"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-bold text-[var(--adw-fg)] truncate block">{r.name}</span>
                            <span className="text-xs text-[var(--adw-fg-dim)] opacity-70 truncate block">{r.note || '请求添加好友'}</span>
                          </div>
                          <span className="text-[10px] text-[var(--adw-fg-dim)] opacity-50 shrink-0">{r.inviteAtStr}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 联系人列表 */}
              {filteredGroups.length === 0 && !pendingRequests.length ? (
                <div className="text-center py-12 opacity-40">
                  <User size={36} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">
                    {searchKeyword ? '没有找到匹配的联系人' : '暂无联系人'}
                  </p>
                </div>
              ) : (
                filteredGroups.map((g) => {
                  const isCollapsed = collapsedGroups.has(g.listName)
                  const iconColor = g.chatType === 2 ? 'text-indigo-500' : g.chatType === 3 ? 'text-purple-500' : 'text-emerald-500'
                  return (
                    <div key={g.listName} className="card-adw overflow-hidden bg-[var(--adw-card)]">
                      <button
                        onClick={() => toggleGroup(g.listName)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--adw-hover)] transition-colors text-xs font-bold uppercase tracking-wider text-[var(--adw-fg-dim)] cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${iconColor === 'text-indigo-500' ? 'bg-indigo-500' : iconColor === 'text-purple-500' ? 'bg-purple-500' : 'bg-emerald-500'}`} />
                          <span>{g.listName || CHAT_TYPE_NAMES[g.chatType] || '其他'}</span>
                          <span className="opacity-55">({g.items.length})</span>
                        </div>
                        {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      </button>
                      
                      {!isCollapsed && (
                        <div className="border-t border-[var(--adw-border)]/[0.2] divide-y divide-[var(--adw-border)]/[0.1] bg-[var(--adw-view)]">
                          {g.items.map((item) => {
                            const isGroup = item.chatType === 2
                            return (
                              <div
                                key={item.chatId}
                                onClick={() => {
                                  setCurrentChat(item.chatId, item.chatType)
                                  navigate('/chat')
                                }}
                                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--adw-hover)] cursor-pointer transition-colors"
                              >
                                <Avatar
                                  src={getAvatarUrl(item)}
                                  name={getDisplayName(item)}
                                  isGroup={isGroup}
                                  sizeClass="w-10 h-10"
                                />
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-bold text-[var(--adw-fg)] truncate block">{getDisplayName(item)}</span>
                                  {item.permissionLevel > 0 && (
                                    <span className="inline-flex items-center gap-0.5 mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--adw-window)] border border-[var(--adw-border)]/[0.2] text-[var(--adw-fg-dim)]">
                                      {item.permissionLevel === 100 ? (
                                        <><ShieldAlert size={10} className="text-amber-500" />群主</>
                                      ) : item.permissionLevel === 2 ? (
                                        <><Shield size={10} className="text-blue-500" />管理员</>
                                      ) : null}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}