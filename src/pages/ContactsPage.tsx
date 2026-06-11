import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAddressBook, getRequestList } from '../api/friend'
import { useChatStore } from '../store/chatStore'
import { resolveMediaUrl } from '../store/settingsStore'
import { toNumber, toString } from '../utils/convert'

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
    <div className="h-full flex flex-col bg-[#f5f5f5]">
      {/* 顶部栏 */}
      <div className="h-14 border-b border-gray-200 bg-white flex items-center px-4 gap-3 shrink-0">
        <button onClick={() => navigate('/chat')} className="text-gray-400 hover:text-gray-600">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h2 className="font-semibold text-gray-800">通讯录</h2>
      </div>

      {/* 搜索框 */}
      <div className="px-3 py-2 bg-white border-b border-gray-100">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="搜索..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-300"
          />
          {searchKeyword && (
            <button
              onClick={() => setSearchKeyword('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-gray-400 text-sm text-center py-8">加载中...</p>
        ) : (
          <>
            {/* 好友请求 */}
            {pendingRequests.length > 0 && !searchKeyword && (
              <div>
                <button
                  onClick={() => setRequestsCollapsed(!requestsCollapsed)}
                  className="w-full flex items-center gap-2 px-4 py-2 bg-gray-50 text-xs text-gray-500 hover:bg-gray-100 transition-colors sticky top-0"
                >
                  <svg
                    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`transition-transform ${requestsCollapsed ? '' : 'rotate-90'}`}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  新的朋友
                  <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 min-w-[16px] text-center">
                    {pendingRequests.length}
                  </span>
                </button>
                {!requestsCollapsed && pendingRequests.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 border-b border-gray-50">
                    <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0 overflow-hidden flex items-center justify-center">
                      {r.avatar ? (
                        <img src={resolveMediaUrl(r.avatar)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm text-gray-400">{r.name[0]}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-800 truncate block">{r.name}</span>
                      <span className="text-xs text-gray-400">{r.note || '请求添加好友'}</span>
                    </div>
                    <span className="text-xs text-gray-400">{r.inviteAtStr}</span>
                  </div>
                ))}
              </div>
            )}

            {filteredGroups.length === 0 && !pendingRequests.length ? (
              <p className="text-gray-400 text-sm text-center py-8">
                {searchKeyword ? '没有找到匹配的联系人' : '暂无联系人'}
              </p>
            ) : (
              filteredGroups.map((g) => (
                <div key={g.listName}>
                  <button
                    onClick={() => toggleGroup(g.listName)}
                    className="w-full flex items-center gap-2 px-4 py-2 bg-gray-50 text-xs text-gray-500 hover:bg-gray-100 transition-colors sticky top-0"
                  >
                    <svg
                      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      className={`transition-transform ${collapsedGroups.has(g.listName) ? '' : 'rotate-90'}`}
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    {g.listName || CHAT_TYPE_NAMES[g.chatType] || '其他'}
                    <span className="text-gray-400">({g.items.length})</span>
                  </button>
                  {!collapsedGroups.has(g.listName) && g.items.map((item) => (
                    <div
                      key={item.chatId}
                      onClick={() => {
                        setCurrentChat(item.chatId, item.chatType)
                        navigate('/chat')
                      }}
                      className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-50"
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0 overflow-hidden flex items-center justify-center">
                        {getAvatarUrl(item) ? (
                          <img src={getAvatarUrl(item)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm text-gray-400">{getDisplayName(item)[0]}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-gray-800 truncate block">{getDisplayName(item)}</span>
                        {item.permissionLevel > 0 && (
                          <span className="text-[10px] text-gray-400">
                            {item.permissionLevel === 100 ? '群主' : item.permissionLevel === 2 ? '管理员' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  )
}