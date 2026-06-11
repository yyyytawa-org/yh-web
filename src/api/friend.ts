import protobuf from 'protobufjs'
import { API_BASE } from '../config'

const protoStr = `
syntax = "proto3";

message Status {
  uint64 number = 1;
  uint64 code = 2;
  string msg = 3;
}

message address_book_list_send {
  string md5 = 2;
}

message DataList {
  string chat_id = 1;
  string remark = 2;
  string avatar_url = 3;
  int32 permisson_level = 4;
  bool noDisturb = 5;
  string name = 8;
}

message Data {
  string list_name = 1;
  repeated DataList data = 2;
  int32 chat_type = 3;
}

message address_book_list {
  Status status = 1;
  repeated Data data = 2;
  string md5 = 3;
}

message Request {
  string receiverName = 1;
  string receiverAvatar = 2;
  string name = 3;
  string avatar = 4;
  string groupName = 5;
  string groupAvatar = 6;
  string inviterId = 7;
  int32 sourceType = 9;
  int32 targetType = 10;
  string targetId = 11;
  string receiverId = 12;
  int32 result = 13;
  int64 processedAt = 14;
  int64 inviteAt = 16;
  string inviteAtStr = 17;
  int32 requestId = 18;
  string botName = 19;
  string botAvatar = 20;
  string processorName = 22;
  string note = 23;
}

message request_list {
  Status status = 1;
  repeated Request requests = 2;
  int32 total = 3;
  int32 pending = 4;
}
`

const root = protobuf.parse(protoStr).root
const Req = root.lookupType('address_book_list_send')
const Resp = root.lookupType('address_book_list')
const RequestListResp = root.lookupType('request_list')

async function protoGet(path: string, signal?: AbortSignal) {
  const token = localStorage.getItem('yh_token') || ''
  const resp = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-protobuf', 'token': token },
    signal,
  })
  const buf = await resp.arrayBuffer()
  return new Uint8Array(buf)
}

export async function getAddressBook(md5: string = '', signal?: AbortSignal) {
  const token = localStorage.getItem('yh_token') || ''
  const body = md5 ? Req.encode({ md5 }).finish() : null
  const resp = await fetch(`${API_BASE}/v1/friend/address-book-list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-protobuf', 'token': token },
    body: body as BodyInit | null,
    signal,
  })
  const buf = await resp.arrayBuffer()
  return Resp.toObject(Resp.decode(new Uint8Array(buf)), { defaults: true })
}

export async function getRequestList(signal?: AbortSignal) {
  const buf = await protoGet('/v1/friend/request-list', signal)
  return RequestListResp.toObject(RequestListResp.decode(buf), { defaults: true })
}