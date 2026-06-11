import protobuf from 'protobufjs'

const protoStr = `
syntax = "proto3";

message Status {
  uint64 number = 1;
  uint64 code = 2;
  string msg = 3;
}

message info_send {
  string group_id = 2;
}

message Tag {
  uint64 id = 1;
  string text = 3;
  string color = 4;
}

message GroupData {
  string group_id = 1;
  string name = 2;
  string avatar_url = 3;
  uint64 avatar_id = 4;
  string introduction = 5;
  uint64 member = 6;
  string create_by = 7;
  uint64 direct_join = 8;
  uint64 permisson_level = 9;
  uint64 history_msg = 10;
  string category_name = 11;
  uint64 category_id = 12;
  uint64 private = 13;
  uint64 do_not_disturb = 14;
  uint64 community_id = 15;
  string community_name = 16;
  uint64 top = 19;
  repeated string admin = 20;
  uint64 create_time = 21;
  string limited_msg_type = 22;
  string owner = 23;
  uint64 recommandation = 24;
  repeated string tag_old = 26;
  repeated Tag tag = 27;
  string my_group_nickname = 28;
  string group_code = 29;
  uint64 hide_group_members = 30;
  uint64 auto_delete_message = 32;
  uint64 deny_members_upload_to_group_disk = 33;
}

message BotData {
  string id = 1;
  string name = 2;
  uint64 name_id = 3;
  string avatar_url = 4;
  uint64 avatar_id = 5;
  string introduction = 6;
  string create_by = 7;
  uint64 create_time = 8;
  uint64 user_number = 9;
  uint64 private = 10;
}

message info {
  Status status = 1;
  GroupData data = 2;
  repeated BotData history_bot = 3;
}

message edit_group_send {
  string group_id = 2;
  string name = 3;
  string introduction = 4;
  string avatarUrl = 5;
  uint64 direct_join = 6;
  uint64 history_msg = 7;
  string category_name = 8;
  uint64 category_id = 9;
  uint64 private = 10;
  uint64 hide_group_members = 11;
}

message edit_group {
  Status status = 1;
}
`

const root = protobuf.parse(protoStr).root
const InfoReq = root.lookupType('info_send')
const InfoResp = root.lookupType('info')
const EditReq = root.lookupType('edit_group_send')

async function protoPost(path: string, body: Uint8Array) {
  const token = localStorage.getItem('yh_token') || ''
  const resp = await fetch(`https://chat-go.jwzhd.com${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-protobuf', 'token': token },
    body: body as BodyInit | null,
  })
  const buf = await resp.arrayBuffer()
  return new Uint8Array(buf)
}

export async function getGroupInfo(groupId: string) {
  const encoded = InfoReq.encode({ groupId }).finish()
  const buf = await protoPost('/v1/group/info', encoded)
  return InfoResp.toObject(InfoResp.decode(buf), { defaults: true })
}

/**
 * 编辑群信息
 * @param data 完整的群信息对象（从 getGroupInfo 获取后修改），合并所有字段不会丢失数据
 */
export async function editGroup(data: any) {
  const encoded = EditReq.encode({
    groupId: data.groupId || data.group_id,
    name: data.name,
    introduction: data.introduction,
    avatarUrl: data.avatarUrl || data.avatar_url,
    directJoin: data.directJoin ?? data.direct_join,
    historyMsg: data.historyMsg ?? data.history_msg,
    categoryName: data.categoryName || data.category_name,
    categoryId: data.categoryId ?? data.category_id,
    private: data.private,
    hideGroupMembers: data.hideGroupMembers ?? data.hide_group_members,
  }).finish()
  await protoPost('/v1/group/edit-group', encoded)
}