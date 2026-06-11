import protobuf from 'protobufjs'
import { API_BASE } from '../config'

const protoStr = `
syntax = "proto3";

message Status {
  uint64 number = 1;
  uint64 code = 2;
  string msg = 3;
}

message bot_info_send {
  string id = 2;
}

message BotData {
  string bot_id = 1;
  string name = 2;
  int64 name_id = 3;
  string avatar_url = 4;
  string avatar_id = 5;
  string introduction = 6;
  string create_by = 7;
  int64 create_time = 8;
  int64 headcount = 9;
  int32 private = 10;
  int32 is_stop = 11;
  int32 always_agree = 13;
  int32 do_not_disturb = 15;
  int32 top = 18;
  int32 group_limit = 20;
}

message bot_info {
  Status status = 1;
  BotData data = 2;
}
`

const root = protobuf.parse(protoStr).root
const BotInfoReq = root.lookupType('bot_info_send')
const BotInfoResp = root.lookupType('bot_info')

async function protoPost(path: string, body: Uint8Array, signal?: AbortSignal) {
  const token = localStorage.getItem('yh_token') || ''
  const resp = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-protobuf', 'token': token },
    body: body as BodyInit | null,
    signal,
  })
  const buf = await resp.arrayBuffer()
  return new Uint8Array(buf)
}

export async function getBotInfo(botId: string, signal?: AbortSignal) {
  const encoded = BotInfoReq.encode({ id: botId }).finish()
  const buf = await protoPost('/v1/bot/bot-info', encoded, signal)
  return BotInfoResp.toObject(BotInfoResp.decode(buf), { defaults: true })
}