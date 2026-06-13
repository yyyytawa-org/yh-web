import { apiClient } from './client'
import protobuf from 'protobufjs'
import { API_BASE } from '../config'

const protoStr = `
syntax = "proto3";

message Status {
  uint64 number = 1;
  uint64 code = 2;
  string msg = 3;
}

message SelfData {
  string id = 1;
  string name = 2;
  string avatar_url = 4;
  uint64 avatar_id = 5;
  string phone = 6;
  string email = 7;
  double coin = 8;
  int32 is_vip = 9;
  uint64 vip_expired_time = 10;
  string invitation_code = 12;
}

message SelfInfo {
  Status status = 1;
  SelfData data = 2;
}

message get_user_send {
  string id = 2;
}

message MedalInfo {
  uint64 id = 1;
  string name = 2;
  uint64 sort = 5;
}

message RemarkInfo {
  string remark_name = 1;
  string phone_number = 2;
  string extra_remark = 3;
}

message ProfileInfo {
  string last_active_time = 1;
  string introduction = 2;
  int32 gender = 3;
  uint64 birthday_timestamp = 4;
  string city = 5;
  string district = 6;
  string address = 7;
}

message UserData {
  string id = 1;
  string name = 2;
  uint64 name_id = 3;
  string avatar_url = 4;
  uint64 avatar_id = 5;
  repeated MedalInfo medal = 6;
  string register_time = 7;
  uint64 ban_time = 10;
  uint64 online_day = 11;
  uint64 continuous_online_day = 12;
  int32 is_vip = 13;
  uint64 vip_expired_time = 14;
  RemarkInfo remark_info = 18;
  ProfileInfo profile_info = 19;
  string ipGeo = 20;
}

message get_user {
  Status status = 1;
  UserData data = 2;
}
`

const root = protobuf.parse(protoStr).root
const SelfInfo = root.lookupType('SelfInfo')
const GetUserReq = root.lookupType('get_user_send')
const GetUserResp = root.lookupType('get_user')

/** 获取自身信息（Protobuf 接口） */
export async function getSelfInfo(signal?: AbortSignal) {
  const { data } = await apiClient.get('/v1/user/info', { responseType: 'arraybuffer', signal })
  return SelfInfo.toObject(SelfInfo.decode(new Uint8Array(data)), { defaults: true })
}

/** 获取用户信息（Protobuf 接口） */
export async function getUserInfo(userId: string, signal?: AbortSignal) {
  const token = localStorage.getItem('yh_token') || ''
  const encoded = GetUserReq.encode({ id: userId }).finish()
  const resp = await fetch(`${API_BASE}/v1/user/get-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-protobuf', 'token': token },
    body: encoded as BodyInit | null,
    signal,
  })
  const buf = await resp.arrayBuffer()
  return GetUserResp.toObject(GetUserResp.decode(new Uint8Array(buf)), { defaults: true })
}