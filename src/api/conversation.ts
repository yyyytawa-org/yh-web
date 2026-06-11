import { apiClient } from './client'
import protobuf from 'protobufjs'

const protoStr = `
syntax = "proto3";

message Status {
  uint64 number = 1;
  uint64 code = 2;
  string msg = 3;
}

message AtData {
  uint64 unknown = 1;
  string mentioned_id = 2;
  string mentioned_name = 3;
  string mentioned_in = 4;
  string mentioner_id = 6;
  string mentioner_name = 7;
  uint64 msg_seq = 8;
}

message Data {
  string chat_id = 1;
  uint64 chat_type = 2;
  string remark = 3;
  string chat_content = 4;
  uint64 timestamp_ms = 5;
  uint64 unread_message = 6;
  uint64 at = 7;
  uint64 avatar_id = 8;
  string avatar_url = 9;
  uint64 do_not_disturb = 11;
  uint64 send_timestamp = 12;
  AtData at_data = 14;
  string name = 15;
  uint64 certification_level = 16;
}

message list {
  Status status = 1;
  repeated Data data = 2;
  uint64 total = 3;
  string md5 = 4;
}

message address_book_list_send {
  string md5 = 2;
}
`

const root = protobuf.parse(protoStr).root
const ConversationListResp = root.lookupType('list')
const ConversationListReq = root.lookupType('address_book_list_send')

export async function getConversationList(md5: string = '') {
  let body: Uint8Array | null = null
  if (md5) {
    body = ConversationListReq.encode({ md5 }).finish()
  }

  const { data } = await apiClient.post('/v1/conversation/list', body, {
    headers: { 'Content-Type': 'application/x-protobuf' },
    responseType: 'arraybuffer',
    transformRequest: [(d: any) => d],
  })
  return ConversationListResp.decode(new Uint8Array(data))
}

export async function dismissNotification(chatId: string) {
  const token = localStorage.getItem('yh_token') || ''
  await fetch('https://chat-go.jwzhd.com/v1/conversation/dismiss-notification', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'token': token,
    },
    body: JSON.stringify({ chatId }),
  })
}

/** 获取置顶会话列表 */
export async function getStickyList() {
  const token = localStorage.getItem('yh_token') || ''
  const resp = await fetch('https://chat-go.jwzhd.com/v1/sticky/list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'token': token },
  })
  return resp.json()
}