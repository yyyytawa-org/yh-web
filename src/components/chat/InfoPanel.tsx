import { useState, useEffect, useRef } from 'react'
import { useChatStore } from '../../store/chatStore'
import { resolveMediaUrl } from '../../store/settingsStore'
import { getGroupInfo, editGroup } from '../../api/group'
import { getUserInfo } from '../../api/user'
import { getBotInfo } from '../../api/bot'
import { toNumber, toString } from '../../utils/convert'

interface GroupInfo {
  name: string
  avatarUrl: string
  introduction: string
  memberCount: number
  createTime: string
  owner: string
  categoryName: string
  categoryId: number
  groupCode: string
  myNickname: string
  historyMsg: boolean
  directJoin: boolean
  isPrivate: boolean
  hideMembers: boolean
}

interface UserInfo {
  name: string
  avatarUrl: string
  registerTime: string
  onlineDay: number
  continuousOnlineDay: number
  isVip: boolean
  ipGeo: string
  introduction: string
  gender: string
}

interface BotInfo {
  name: string
  avatarUrl: string
  introduction: string
  creator: string
  headcount: number
  createTime: string
  isStop: boolean
}

interface InfoPanelProps {
  onClose: () => void
  isAdmin: boolean
  chatId: string
}

export default function InfoPanel({ onClose, isAdmin, chatId }: InfoPanelProps) {
  const { currentChatId, currentChatType, conversations } = useChatStore()
  const [loading, setLoading] = useState(true)
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null)
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null)

  /** 编辑群信息状态 */
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editIntro, setEditIntro] = useState('')
  const [editDirectJoin, setEditDirectJoin] = useState(false)
  const [editHistoryMsg, setEditHistoryMsg] = useState(false)
  const [editPrivate, setEditPrivate] = useState(false)
  const [editHideMembers, setEditHideMembers] = useState(false)
  const [saving, setSaving] = useState(false)

  /** 保存原始群信息，编辑时合并 */
  const rawGroupData = useRef<any>(null)

  const conv = conversations.find((c) => c.chatId === currentChatId)
  const displayName = conv?.remark || conv?.name || '未知'

  useEffect(() => {
    if (!currentChatId || currentChatType == null) return

    setLoading(true)
    setEditing(false)

    const load = async () => {
      try {
        if (currentChatType === 2) {
          const data = await getGroupInfo(currentChatId)
          const g = data?.data
          rawGroupData.current = g
          const info: GroupInfo = {
            name: toString(g?.name),
            avatarUrl: toString(g?.avatarUrl),
            introduction: toString(g?.introduction),
            memberCount: toNumber(g?.member),
            createTime: toNumber(g?.createTime)
              ? new Date(toNumber(g.createTime) * 1000).toLocaleDateString('zh-CN')
              : '',
            owner: toString(g?.owner),
            categoryName: toString(g?.categoryName),
            categoryId: toNumber(g?.categoryId),
            groupCode: toString(g?.groupCode),
            myNickname: toString(g?.myGroupNickname),
            historyMsg: toNumber(g?.historyMsg) === 1,
            directJoin: toNumber(g?.directJoin) === 1,
            isPrivate: toNumber(g?.private) === 1,
            hideMembers: toNumber(g?.hideGroupMembers) === 1,
          }
          setGroupInfo(info)
          setEditName(info.name)
          setEditIntro(info.introduction)
          setEditDirectJoin(info.directJoin)
          setEditHistoryMsg(info.historyMsg)
          setEditPrivate(info.isPrivate)
          setEditHideMembers(info.hideMembers)
        } else if (currentChatType === 1) {
          const data = await getUserInfo(currentChatId)
          const u = data?.data
          setUserInfo({
            name: toString(u?.name),
            avatarUrl: toString(u?.avatarUrl),
            registerTime: toString(u?.registerTime),
            onlineDay: toNumber(u?.onlineDay),
            continuousOnlineDay: toNumber(u?.continuousOnlineDay),
            isVip: u?.isVip === 1,
            ipGeo: toString(u?.ipGeo),
            introduction: toString(u?.profileInfo?.introduction),
            gender: u?.profileInfo?.gender === 1 ? '男' : u?.profileInfo?.gender === 2 ? '女' : '其他',
          })
        } else if (currentChatType === 3) {
          const data = await getBotInfo(currentChatId)
          const b = data?.data
          setBotInfo({
            name: toString(b?.name),
            avatarUrl: toString(b?.avatarUrl),
            introduction: toString(b?.introduction),
            creator: toString(b?.createBy),
            headcount: toNumber(b?.headcount),
            createTime: b?.createTime ? new Date(toNumber(b.createTime) * 1000).toLocaleDateString('zh-CN') : '',
            isStop: b?.isStop === 1,
          })
        }
      } catch (err) {
        console.error('加载信息失败:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [currentChatId, currentChatType])

  /** 保存群信息——用原始数据合并，只覆盖修改的字段 */
  const handleSaveGroupInfo = async () => {
    if (!chatId || saving || !rawGroupData.current) return
    setSaving(true)
    try {
      // 用原始 protobuf 对象合并，只改用户修改的字段
      const base = { ...rawGroupData.current }
      base.name = editName.trim()
      base.introduction = editIntro.trim()
      base.directJoin = editDirectJoin ? 1 : 0
      base.historyMsg = editHistoryMsg ? 1 : 0
      base.private = editPrivate ? 1 : 0
      base.hideGroupMembers = editHideMembers ? 1 : 0

      await editGroup(base)

      setGroupInfo((prev) =>
        prev
          ? {
              ...prev,
              name: editName.trim(),
              introduction: editIntro.trim(),
              directJoin: editDirectJoin,
              historyMsg: editHistoryMsg,
              isPrivate: editPrivate,
              hideMembers: editHideMembers,
            }
          : null,
      )
      setEditing(false)
    } catch (err) {
      console.error('保存失败:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-72 border-l border-gray-200 bg-white flex flex-col shrink-0 overflow-y-auto">
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <h3 className="font-medium text-sm text-gray-800">详情</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-gray-400 text-sm">加载中...</span>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* 头像 + 名称 */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
              {conv?.avatarUrl ? (
                <img src={resolveMediaUrl(conv.avatarUrl)} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl text-gray-400">{displayName[0]}</span>
              )}
            </div>
            <span className="font-medium text-gray-800">{displayName}</span>
          </div>

          {/* 群聊信息 */}
          {groupInfo && (
            <div className="space-y-3">
              {editing ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-300"
                    placeholder="群名称"
                  />
                  <textarea
                    value={editIntro}
                    onChange={(e) => setEditIntro(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-y min-h-[60px] focus:outline-none focus:border-blue-300"
                    rows={3}
                    placeholder="群简介"
                  />
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editDirectJoin}
                      onChange={(e) => setEditDirectJoin(e.target.checked)}
                      className="rounded"
                    />
                    进群免审核
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editHistoryMsg}
                      onChange={(e) => setEditHistoryMsg(e.target.checked)}
                      className="rounded"
                    />
                    新成员可查看历史消息
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editPrivate}
                      onChange={(e) => setEditPrivate(e.target.checked)}
                      className="rounded"
                    />
                    私有群聊
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editHideMembers}
                      onChange={(e) => setEditHideMembers(e.target.checked)}
                      className="rounded"
                    />
                    隐藏群成员列表
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveGroupInfo}
                      disabled={saving}
                      className="flex-1 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
                    >
                      {saving ? '保存中...' : '保存'}
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false)
                        // 恢复原始值
                        if (groupInfo) {
                          setEditName(groupInfo.name)
                          setEditIntro(groupInfo.introduction)
                          setEditDirectJoin(groupInfo.directJoin)
                          setEditHistoryMsg(groupInfo.historyMsg)
                          setEditPrivate(groupInfo.isPrivate)
                          setEditHideMembers(groupInfo.hideMembers)
                        }
                      }}
                      className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <InfoRow label="群号" value={currentChatId || ''} copyable />
                  <InfoRow label="群主" value={groupInfo.owner} />
                  <InfoRow label="分类" value={groupInfo.categoryName} />
                  <InfoRow label="人数" value={String(groupInfo.memberCount)} />
                  <InfoRow label="创建时间" value={groupInfo.createTime} />
                  {groupInfo.groupCode && <InfoRow label="群口令" value={groupInfo.groupCode} copyable />}
                  {groupInfo.myNickname && <InfoRow label="我的群昵称" value={groupInfo.myNickname} />}
                  <InfoRow label="历史消息" value={groupInfo.historyMsg ? '开放' : '关闭'} />
                  <InfoRow label="直接进群" value={groupInfo.directJoin ? '是' : '需审核'} />
                  <InfoRow label="私有群聊" value={groupInfo.isPrivate ? '是' : '否'} />
                  <InfoRow label="隐藏成员" value={groupInfo.hideMembers ? '是' : '否'} />
                  {groupInfo.introduction && (
                    <div>
                      <span className="text-xs text-gray-400">简介</span>
                      <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{groupInfo.introduction}</p>
                    </div>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => setEditing(true)}
                      className="w-full py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      编辑群信息
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* 用户信息 */}
          {userInfo && (
            <div className="space-y-3">
              <InfoRow label="ID" value={currentChatId || ''} copyable />
              {userInfo.registerTime && <InfoRow label="注册时间" value={userInfo.registerTime} />}
              {userInfo.onlineDay > 0 && <InfoRow label="在线天数" value={`${userInfo.onlineDay} 天`} />}
              {userInfo.continuousOnlineDay > 0 && (
                <InfoRow label="连续在线" value={`${userInfo.continuousOnlineDay} 天`} />
              )}
              {userInfo.ipGeo && <InfoRow label="IP 归属地" value={userInfo.ipGeo} />}
              <InfoRow label="性别" value={userInfo.gender} />
              <InfoRow label="VIP" value={userInfo.isVip ? '是' : '否'} />
              {userInfo.introduction && (
                <div>
                  <span className="text-xs text-gray-400">简介</span>
                  <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{userInfo.introduction}</p>
                </div>
              )}
            </div>
          )}

          {/* 机器人信息 */}
          {botInfo && (
            <div className="space-y-3">
              <InfoRow label="ID" value={currentChatId || ''} copyable />
              <InfoRow label="创建者" value={botInfo.creator} />
              <InfoRow label="使用人数" value={String(botInfo.headcount)} />
              {botInfo.createTime && <InfoRow label="创建时间" value={botInfo.createTime} />}
              <InfoRow label="状态" value={botInfo.isStop ? '已停用' : '运行中'} />
              {botInfo.introduction && (
                <div>
                  <span className="text-xs text-gray-400">简介</span>
                  <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{botInfo.introduction}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  if (!value) return null
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-400 text-xs shrink-0">{label}</span>
      <span className="text-gray-700 truncate ml-2 max-w-[160px] text-right">
        {value}
        {copyable && (
          <button
            onClick={() => navigator.clipboard.writeText(value)}
            className="ml-1 text-gray-400 hover:text-gray-600 align-middle"
            title="复制"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
        )}
      </span>
    </div>
  )
}