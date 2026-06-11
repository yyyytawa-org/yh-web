import { apiClient } from './client'

export async function getStickerDetail(stickerPackId: number) {
  const { data } = await apiClient.post('/v1/sticker/detail', { id: stickerPackId })
  return data
}

export async function addStickerPack(stickerPackId: number) {
  const { data } = await apiClient.post('/v1/sticker/add', { id: stickerPackId })
  return data
}