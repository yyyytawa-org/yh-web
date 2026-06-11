import { apiClient } from './client'

export async function getLiveRooms(groupId: string) {
  const { data } = await apiClient.post('/v1/group/live-room', { groupId })
  return data
}

export async function getJoinToken(roomId: string, chatId: string) {
  const { data } = await apiClient.post('/v1/live/add', { roomId, chatId })
  return data
}

export async function closeLiveRoom(roomId: string) {
  const { data } = await apiClient.post('/v1/live/close', { roomId })
  return data
}

export async function hangUpLiveRoom(roomId: string) {
  const { data } = await apiClient.post('/v1/live/hang_up', { roomId })
  return data
}

export async function getRoomInfo(roomId: string) {
  const { data } = await apiClient.post('/v1/live/room-info', { roomId })
  return data
}

export async function getStreamKey(roomId: string) {
  const { data } = await apiClient.post('/v1/live/stream-info', { roomId })
  return data
}