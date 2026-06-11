/** 统一的消息类型，历史和 WS 推送都用这个 */
export interface Message {
  msgId: string
  senderId: string
  senderName: string
  senderAvatar: string
  content: string
  contentType: number
  sendTime: number
  direction: string
  quoteMsgText: string
  quoteImageUrl: string
  quoteImageName: string
  quoteVideoUrl: string
  quoteVideoTime: number
  msgSeq: number
  imageUrl: string
  imageWidth: number
  imageHeight: number
  fileUrl: string
  fileName: string
  fileSize: number
  videoUrl: string
  stickerUrl: string
  expressionId: string
  stickerItemId: number
  stickerPackId: number
  buttons: string
  audioUrl: string
  audioTime: number
}

export const CONTENT_TYPE = {
  TEXT: 1,
  IMAGE: 2,
  MARKDOWN: 3,
  FILE: 4,
  EXPRESSION: 7,
  VIDEO: 10,
  AUDIO: 11,
} as const

/** 从 protobuf 解码的原始消息对象转为统一 Message */
export function parseMessage(raw: any, selfUserId: string): Message {
  const senderId = String(raw.sender?.chatId || raw.senderId || '')
  return {
    msgId: String(raw.msgId || raw.msg_id || ''),
    senderId,
    senderName: String(raw.sender?.name || raw.senderName || ''),
    senderAvatar: String(raw.sender?.avatarUrl || raw.sender?.avatar_url || raw.senderAvatar || ''),
    content: String(raw.content?.text || raw.content || ''),
    contentType: typeof raw.contentType === 'object' ? raw.contentType.toNumber() : (raw.contentType || raw.content_type || 0),
    sendTime: typeof raw.sendTime === 'object' ? raw.sendTime.toNumber() : (raw.sendTime || raw.send_time || raw.timestamp || 0),
    direction: senderId === selfUserId ? 'right' : (raw.direction || 'left'),
    quoteMsgText: String(raw.content?.quoteMsgText || raw.content?.quote_msg_text || raw.quoteMsgText || ''),
    quoteImageUrl: String(raw.content?.quoteImageUrl || raw.content?.quote_image_url || raw.quoteImageUrl || ''),
    quoteImageName: String(raw.content?.quoteImageName || raw.content?.quote_image_name || raw.quoteImageName || ''),
    quoteVideoUrl: String(raw.content?.quoteVideoUrl || raw.content?.quote_video_url || raw.quoteVideoUrl || ''),
    quoteVideoTime: typeof raw.content?.quoteVideoTime === 'object' ? raw.content.quoteVideoTime.toNumber() : (raw.content?.quoteVideoTime || raw.content?.quote_video_time || raw.quoteVideoTime || 0),
    msgSeq: typeof raw.msgSeq === 'object' ? raw.msgSeq.toNumber() : (raw.msgSeq || raw.msg_seq || 0),
    imageUrl: String(raw.content?.imageUrl || raw.content?.image_url || raw.imageUrl || ''),
    imageWidth: typeof raw.content?.width === 'object' ? raw.content.width.toNumber() : (raw.content?.width || raw.imageWidth || 0),
    imageHeight: typeof raw.content?.height === 'object' ? raw.content.height.toNumber() : (raw.content?.height || raw.imageHeight || 0),
    fileUrl: String(raw.content?.fileUrl || raw.content?.file_url || raw.fileUrl || ''),
    fileName: String(raw.content?.fileName || raw.content?.file_name || raw.fileName || ''),
    fileSize: typeof raw.content?.fileSize === 'object' ? raw.content.fileSize.toNumber() : (raw.content?.fileSize || raw.content?.file_size || raw.fileSize || 0),
    videoUrl: String(raw.content?.videoUrl || raw.content?.video_url || raw.videoUrl || ''),
    stickerUrl: String(raw.content?.stickerUrl || raw.content?.sticker_url || raw.stickerUrl || ''),
    expressionId: String(raw.content?.expressionId || raw.content?.expression_id || raw.expressionId || ''),
    stickerItemId: typeof raw.content?.stickerItemId === 'object' ? raw.content.stickerItemId.toNumber() : (raw.content?.stickerItemId || raw.content?.sticker_item_id || raw.stickerItemId || 0),
    stickerPackId: typeof raw.content?.stickerPackId === 'object' ? raw.content.stickerPackId.toNumber() : (raw.content?.stickerPackId || raw.content?.sticker_pack_id || raw.stickerPackId || 0),
    buttons: String(raw.content?.buttons || raw.buttons || ''),
    audioUrl: String(raw.content?.audioUrl || raw.content?.audio_url || raw.audioUrl || ''),
    audioTime: typeof raw.content?.audioTime === 'object' ? raw.content.audioTime.toNumber() : (raw.content?.audioTime || raw.content?.audio_time || raw.audioTime || 0),
  }
}

export interface QuoteMsg {
  msgId: string
  text: string
  quoteImageUrl?: string
  quoteImageName?: string
  quoteVideoUrl?: string
  quoteVideoTime?: number
}