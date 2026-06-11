import protobuf from 'protobufjs'

const protoStr = `
syntax = "proto3";

message Status {
  uint64 number = 1;
  uint64 code = 2;
  string msg = 3;
}

message list_message_send {
  uint64 msg_count = 2;
  string msg_id = 3;
  uint64 chat_type = 4;
  string chat_id = 5;
}

message list_message {
  Status status = 1;
  repeated Msg msg = 2;
  message Msg {
    string msg_id = 1;
    Sender sender = 2;
    string direction = 3;
    uint64 content_type = 4;
    Content content = 5;
    uint64 send_time = 6;
    Cmd cmd = 7;
    uint64 msg_delete_time = 8;
    string quote_msg_id = 9;
    uint64 msg_seq = 10;
    uint64 edit_time = 12;
    message Sender {
      string chat_id = 1; uint64 chat_type = 2; string name = 3; string avatar_url = 4;
      repeated string tag_old = 6; repeated Tag tag = 7;
    }
    message Cmd { uint64 cmd_id = 1; string name = 2; uint64 type = 4; }
    message Content {
      string text = 1; string buttons = 2; string image_url = 3; string file_name = 4;
      string file_url = 5; repeated string at = 6; string form = 7; string quote_msg_text = 8;
      string sticker_url = 9; string post_id = 10; string post_title = 11; string post_content = 12;
      string post_content_type = 13; string expression_id = 15; string quote_image_url = 16;
      string quote_image_name = 17; uint64 file_size = 18; string video_url = 19; string audio_url = 21;
      uint64 audio_time = 22; string quote_video_url = 23; uint64 quote_video_time = 24;
      uint64 sticker_item_id = 25; uint64 sticker_pack_id = 26; string call_text = 29;
      string call_status_text = 32; uint64 width = 33; uint64 height = 34; string tip = 37;
    }
    message Tag { uint64 id = 1; string text = 3; string color = 4; }
  }
}

message send_message_send {
  string msg_id = 2;
  string chat_id = 3;
  uint64 chat_type = 4;
  SendData data = 5;
  message SendData {
    string text = 1; string buttons = 2; string file_name = 4; string file_key = 5;
    repeated string mentioned_id = 6; string form = 7; string quote_msg_text = 8;
    string image = 9; string post_id = 10; string post_title = 11; string post_content = 12;
    string post_type = 13; string expression_id = 15; string quote_image_url = 16;
    string quote_image_name = 17; uint64 file_size = 18; string video = 19; string audio = 21;
    uint64 audio_time = 22; string quote_video_url = 23; uint64 quote_video_time = 24;
    uint64 sticker_item_id = 25; uint64 sticker_pack_id = 26; string room_name = 29;
  }
  uint64 content_type = 6;
  uint64 command_id = 7;
  string quote_msg_id = 8;
}

message send_message { Status status = 1; }
message button_report_send { string msg_id = 2; uint64 chat_type = 3; string chat_id = 4; string user_id = 5; string button_value = 6; }
message button_report { Status status = 1; }
message recall_msg_send { string msg_id = 2; string chat_id = 3; uint64 chat_type = 4; }
message recall_msg { Status status = 1; }
message recall_msg_batch_send { repeated string msg_id = 2; string chat_id = 3; uint64 chat_type = 4; }
message recall_msg_batch { Status status = 1; }
`

const root = protobuf.parse(protoStr).root

const ListMessageReq = root.lookupType('list_message_send')
const ListMessageResp = root.lookupType('list_message')
const SendMessageReq = root.lookupType('send_message_send')
const SendMessageResp = root.lookupType('send_message')
const ButtonReportReq = root.lookupType('button_report_send')
const RecallReq = root.lookupType('recall_msg_send')
const RecallBatchReq = root.lookupType('recall_msg_batch_send')

async function protoPost(path: string, body: Uint8Array | null) {
  const token = localStorage.getItem('yh_token') || ''
  const resp = await fetch(`https://chat-go.jwzhd.com${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-protobuf', 'token': token },
    body: body as BodyInit | null,
  })
  return new Uint8Array(await resp.arrayBuffer())
}

export async function getMessages(chatId: string, chatType: number, msgCount: number = 30, msgId?: string) {
  const msg: any = { msgCount, chatType, chatId }
  if (msgId) msg.msgId = msgId
  const encoded = ListMessageReq.encode(msg).finish()
  const buf = await protoPost('/v1/msg/list-message', encoded)
  return ListMessageResp.decode(buf)
}

export interface SendMessageOptions {
  chatId: string
  chatType: number
  contentType: number
  text?: string
  image?: string
  fileKey?: string
  fileName?: string
  fileSize?: number
  video?: string
  quoteMsgId?: string
  quoteMsgText?: string
  quoteImageUrl?: string
  quoteImageName?: string
  quoteVideoUrl?: string
  quoteVideoTime?: number
}

export async function sendMessage(opts: SendMessageOptions) {
  const msgId = crypto.randomUUID().replace(/-/g, '')
  const data: any = {}

  if (opts.text) data.text = opts.text
  if (opts.image) data.image = opts.image
  if (opts.fileKey) { data.fileKey = opts.fileKey; data.fileName = opts.fileName; data.fileSize = opts.fileSize }
  if (opts.video) data.video = opts.video
  if (opts.quoteMsgText) data.quoteMsgText = opts.quoteMsgText
  if (opts.quoteImageUrl) { data.quoteImageUrl = opts.quoteImageUrl; data.quoteImageName = opts.quoteImageName }
  if (opts.quoteVideoUrl) { data.quoteVideoUrl = opts.quoteVideoUrl; data.quoteVideoTime = opts.quoteVideoTime }

  const msg: any = { msgId, chatId: opts.chatId, chatType: opts.chatType, data, contentType: opts.contentType }
  if (opts.quoteMsgId) msg.quoteMsgId = opts.quoteMsgId

  const encoded = SendMessageReq.encode(msg).finish()
  const buf = await protoPost('/v1/msg/send-message', encoded)
  return SendMessageResp.decode(buf)
}

export async function reportButtonClick(msgId: string, chatId: string, chatType: number, userId: string, buttonValue: string) {
  await protoPost('/v1/msg/button-report', ButtonReportReq.encode({ msgId, chatId, chatType, userId, buttonValue }).finish())
}

export async function recallMessage(msgId: string, chatId: string, chatType: number) {
  await protoPost('/v1/msg/recall-msg', RecallReq.encode({ msgId, chatId, chatType }).finish() as any)
}

export async function batchRecallMessages(msgIds: string[], chatId: string, chatType: number) {
  await protoPost('/v1/msg/recall-msg-batch', RecallBatchReq.encode({ msgId: msgIds, chatId, chatType }).finish() as any)
}