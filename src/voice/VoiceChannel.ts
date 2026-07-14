export interface VoiceChannelConfig {
  channelId: string
  maxParticipants: number // 5-8 for P2P mesh
  audioBitrate: number // 16-32 kbps
  echoCancellation: boolean
  noiseSuppression: boolean
}

export interface VoiceParticipant {
  peerId: string
  speaking: boolean
  audioLevel: number
  joinedAt: number
}

export interface VoiceChannel {
  join(config: VoiceChannelConfig): Promise<void>
  leave(): Promise<void>
  mute(): void
  unmute(): void
  isMuted(): boolean
  setAudioBitrate(kbps: number): void
  onParticipantJoined(cb: (p: VoiceParticipant) => void): void
  onParticipantLeft(cb: (p: VoiceParticipant) => void): void
  onSpeakingStatus(cb: (peerId: string, speaking: boolean) => void): void
  getParticipants(): VoiceParticipant[]
}
