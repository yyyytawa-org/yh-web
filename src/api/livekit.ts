import { Room, RoomEvent } from 'livekit-client'

let currentRoom: Room | null = null

let onTrackSubscribedCallback: ((track: any, participant: any) => void) | null = null
let onTrackUnsubscribedCallback: ((participantId: string) => void) | null = null
let onDisconnectedCallback: (() => void) | null = null

export function setLiveKitCallbacks(callbacks: {
  onTrackSubscribed: (track: any, participant: any) => void
  onTrackUnsubscribed: (participantId: string) => void
  onDisconnected: () => void
}) {
  onTrackSubscribedCallback = callbacks.onTrackSubscribed
  onTrackUnsubscribedCallback = callbacks.onTrackUnsubscribed
  onDisconnectedCallback = callbacks.onDisconnected
}

export async function connectLiveKit(token: string) {
  if (currentRoom) currentRoom.disconnect()

  const room = new Room({ adaptiveStream: true, dynacast: true })
  currentRoom = room

  room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
    onTrackSubscribedCallback?.(track, participant)
  })
  room.on(RoomEvent.TrackUnsubscribed, (_track, _pub, participant) => {
    onTrackUnsubscribedCallback?.(participant.identity)
  })
  room.on(RoomEvent.Disconnected, () => {
    if (currentRoom === room) { currentRoom = null; onDisconnectedCallback?.() }
  })

  await room.connect('wss://livekit.jwznb.com', token)
  await room.startAudio()
}

export function disconnectLiveKit() {
  if (currentRoom) { currentRoom.disconnect(); currentRoom = null }
}

export function getCurrentRoom() { return currentRoom }