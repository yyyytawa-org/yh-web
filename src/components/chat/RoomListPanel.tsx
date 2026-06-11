import { useState, useEffect } from 'react'
import { getLiveRooms } from '../../api/live'
import { resolveMediaUrl } from '../../store/settingsStore'
import { toNumber, toString } from '../../utils/convert'

interface Room {
  roomId: string
  userId: string
  nickname: string
  avatarUrl: string
  title: string
  count: number
  createTime: string
  chatId: string
}

interface RoomListPanelProps {
  chatId: string
  onClose: () => void
  onJoin: (roomId: string, title: string) => void
}

export default function RoomListPanel({ chatId, onClose, onJoin }: RoomListPanelProps) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getLiveRooms(chatId).then((res) => {
      if (res?.data?.rooms) {
        setRooms(res.data.rooms.map((r: any) => ({
          roomId: toString(r.roomId),
          userId: toString(r.userId),
          nickname: toString(r.nickname),
          avatarUrl: toString(r.avatarUrl),
          title: toString(r.title),
          count: toNumber(r.count),
          createTime: r.createTime
            ? new Date(r.createTime * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
            : '',
          chatId: toString(r.chatId),
        })))
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [chatId])

  return (
    <div className="w-72 border-l border-gray-200 bg-white flex flex-col shrink-0 overflow-y-auto">
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <h3 className="font-medium text-sm text-gray-800">语音房间</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center"><span className="text-gray-400 text-sm">加载中...</span></div>
      ) : rooms.length === 0 ? (
        <div className="flex-1 flex items-center justify-center"><span className="text-gray-400 text-sm">暂无语音房间</span></div>
      ) : (
        <div className="p-3 space-y-2">
          {rooms.map((room) => (
            <div key={room.roomId} className="bg-gray-50 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-gray-300 overflow-hidden shrink-0 flex items-center justify-center">
                  {room.avatarUrl ? <img src={resolveMediaUrl(room.avatarUrl)} alt="" className="w-full h-full object-cover" /> : <span className="text-xs text-gray-400">{room.nickname[0]}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-800 truncate">{room.title || `${room.nickname} 的语音房间`}</div>
                  <div className="text-xs text-gray-400">{room.nickname} · {room.count} 人 · {room.createTime}</div>
                </div>
              </div>
              <button onClick={() => onJoin(room.roomId, room.title || `${room.nickname} 的语音房间`)} className="w-full py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition-colors">加入</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}