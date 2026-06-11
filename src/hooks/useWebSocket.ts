import { useEffect, useRef } from 'react'
import { useAuthStore } from '../store/authStore'
import { WS_URL } from '../config'
import { useChatStore } from '../store/chatStore'
import { parseMessage } from '../types/message'
import protobuf from 'protobufjs'

const protoStr = `
syntax = "proto3";
message Info { string seq = 1; string cmd = 2; }
message Tag { uint64 id = 1; string text = 3; string color = 4; }
message Sender { string chat_id = 1; uint64 chat_type = 2; string name = 3; string avatar_url = 4; repeated string tag_old = 6; repeated Tag tag = 7; }
message CmdInfo { uint64 id = 1; string name = 2; }
message Content {
  string text = 1; string buttons = 2; string image_url = 3; string file_name = 4; string file_url = 5;
  repeated string at = 6; string form = 7; string quote_msg_text = 8; string sticker_url = 9; string post_id = 10;
  string post_title = 11; string post_content = 12; string post_content_type = 13; string expression_id = 15;
  string quote_image_url = 16; string quote_image_name = 17; uint64 file_size = 18; string video_url = 19;
  string audio_url = 21; uint64 audio_time = 22; string quote_video_url = 23; uint64 quote_video_time = 24;
  uint64 sticker_item_id = 25; uint64 sticker_pack_id = 26; string call_text = 29; string call_status_text = 32;
  uint64 width = 33; uint64 height = 34; string tip = 37;
}
message PushMsg {
  string msg_id = 1; Sender sender = 2; string recv_id = 3; string chat_id = 4; uint64 chat_type = 5;
  Content content = 6; uint64 content_type = 7; uint64 timestamp = 8; CmdInfo cmd = 9; uint64 delete_timestamp = 10;
  string quote_msg_id = 11; uint64 msg_seq = 12;
}
message PushData { string any = 1; PushMsg msg = 2; }
message push_message { Info info = 1; PushData data = 2; }
message heartbeat_ack { Info info = 1; }
`

const root = protobuf.parse(protoStr).root
const HeartbeatAck = root.lookupType('heartbeat_ack')
const PushMessage = root.lookupType('push_message')

function getDeviceId(): string {
  const key = 'yh_device_id'
  let id = localStorage.getItem(key)
  if (!id) { id = 'web_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36); localStorage.setItem(key, id) }
  return id
}

function generateSeq(): string { return Math.random().toString(36).substring(2) + Date.now().toString(36) }

function handlePushMessage(raw: any, selfUserId: string) {
  const msg = raw.data?.msg || raw
  const parsed = parseMessage(msg, selfUserId)
  const chatId = String(msg.chatId || msg.chat_id || '')

  let summary = parsed.content
  switch (parsed.contentType) {
    case 2: summary = '[图片]'; break
    case 4: summary = parsed.fileName ? `[文件] ${parsed.fileName}` : '[文件]'; break
    case 7: summary = '[表情]'; break
    case 10: summary = '[视频]'; break
    case 11: summary = '[语音]'; break
  }

  const store = useChatStore.getState()
  store.updateConversation(chatId, { lastMsg: summary, sendTimestamp: Math.floor(parsed.sendTime / 1000) })
  if (store.currentChatId !== chatId) {
    const conv = store.conversations.find((c) => c.chatId === chatId)
    if (conv) store.updateConversation(chatId, { unread: conv.unread + 1 })
  }
  if (store.currentChatId === chatId) {
    store.addMessage(parsed)
  }
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const token = useAuthStore((s) => s.token)
  const userId = useAuthStore((s) => s.userId)
  const deviceId = useRef(getDeviceId()).current

  useEffect(() => {
    if (!token || !userId) return

    let cancelled = false

    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close() }
    if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)

    const ws = new WebSocket(WS_URL)
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    ws.onopen = () => {
      if (cancelled) { ws.close(); return }
      ws.send(JSON.stringify({ seq: generateSeq(), cmd: 'login', data: { userId, token, platform: 'Web', deviceId } }))
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ seq: generateSeq(), cmd: 'heartbeat', data: {} }))
      }, 30000)
    }

    ws.onmessage = (event) => {
      try {
        if (event.data instanceof ArrayBuffer) {
          const buf = new Uint8Array(event.data)
          const temp = HeartbeatAck.decode(buf)
          if (temp.info?.cmd === 'push_message') handlePushMessage(PushMessage.decode(buf), userId)
          return
        }
        try {
          const json = JSON.parse(event.data)
          if (json.cmd === 'login' && json.code !== 1) console.error('WebSocket 登录失败:', json)
        } catch { /* 忽略 */ }
      } catch { /* 忽略 */ }
    }

    ws.onclose = () => {
      if (cancelled) return
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      reconnectTimerRef.current = setTimeout(() => {
        if (!cancelled) connect()
      }, 5000)
    }

    ws.onerror = () => {}

    function connect() {
      if (cancelled || !token || !userId) return
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close() }
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)

      const newWs = new WebSocket(WS_URL)
      newWs.binaryType = 'arraybuffer'
      wsRef.current = newWs

      newWs.onopen = () => {
        if (cancelled) { newWs.close(); return }
        newWs.send(JSON.stringify({ seq: generateSeq(), cmd: 'login', data: { userId, token, platform: 'Web', deviceId } }))
        heartbeatRef.current = setInterval(() => {
          if (newWs.readyState === WebSocket.OPEN) newWs.send(JSON.stringify({ seq: generateSeq(), cmd: 'heartbeat', data: {} }))
        }, 30000)
      }

      newWs.onmessage = ws.onmessage
      newWs.onclose = ws.onclose
      newWs.onerror = () => {}
    }

    return () => {
      cancelled = true
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close() }
    }
  }, [token, userId, deviceId])
}