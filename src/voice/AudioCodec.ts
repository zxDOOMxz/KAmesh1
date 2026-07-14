export enum AudioCodecType {
  Opus = 'opus',
  PCMU = 'pcmu',
}

export interface AudioCodecConfig {
  codec: AudioCodecType
  sampleRate: 8000 | 16000 | 24000 | 48000
  channels: 1 | 2
  bitrate: number
  frameSizeMs: 20 | 40 | 60
}

// Default: Opus @ 16kHz, mono, 24kbps, 20ms frames = ~60 bytes/packet
export const DEFAULT_AUDIO_CONFIG: AudioCodecConfig = {
  codec: AudioCodecType.Opus,
  sampleRate: 16000,
  channels: 1,
  bitrate: 24000,
  frameSizeMs: 20,
}
