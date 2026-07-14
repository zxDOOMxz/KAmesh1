import { VoiceChannel, VoiceChannelConfig, VoiceParticipant } from './VoiceChannel'
import { WebRTCBridge } from '../native/WebRTCBridge'

export class VoiceChannelImpl implements VoiceChannel {
  private bridge: WebRTCBridge | null = null
  private config: VoiceChannelConfig | null = null
  private participants: Map<string, VoiceParticipant> = new Map()
  private _muted = false

  private onParticipantJoinedCb?: (p: VoiceParticipant) => void
  private onParticipantLeftCb?: (p: VoiceParticipant) => void
  private onSpeakingStatusCb?: (peerId: string, speaking: boolean) => void

  async join(config: VoiceChannelConfig): Promise<void> {
    this.config = config
    this.bridge = new WebRTCBridge()
    await this.bridge.initAudio()
  }

  async createLocalConnection(): Promise<string> {
    if (!this.bridge) throw new Error('Not joined')
    return this.bridge.createConnection()
  }

  async createOffer(connectionId: string) {
    if (!this.bridge) throw new Error('Not joined')
    return this.bridge.createOffer(connectionId)
  }

  async createAnswer(connectionId: string) {
    if (!this.bridge) throw new Error('Not joined')
    return this.bridge.createAnswer(connectionId)
  }

  async setRemoteDescription(connectionId: string, type: string, sdp: string) {
    if (!this.bridge) throw new Error('Not joined')
    await this.bridge.setRemoteDescription(connectionId, { type, sdp })
  }

  async addIceCandidate(
    connectionId: string,
    sdpMid: string,
    sdpMLineIndex: number,
    candidate: string,
  ) {
    if (!this.bridge) throw new Error('Not joined')
    await this.bridge.addIceCandidate(connectionId, {
      connectionId,
      sdpMid,
      sdpMLineIndex,
      candidate,
    })
  }

  async leave(): Promise<void> {
    this.bridge?.dispose()
    this.bridge = null
    this.participants.clear()
    this.config = null
  }

  mute(): void {
    this._muted = true
  }

  unmute(): void {
    this._muted = false
  }

  isMuted(): boolean {
    return this._muted
  }

  setAudioBitrate(kbps: number): void {
    // would set via native renegotiation
  }

  onParticipantJoined(cb: (p: VoiceParticipant) => void): void {
    this.onParticipantJoinedCb = cb
  }

  onParticipantLeft(cb: (p: VoiceParticipant) => void): void {
    this.onParticipantLeftCb = cb
  }

  onSpeakingStatus(cb: (peerId: string, speaking: boolean) => void): void {
    this.onSpeakingStatusCb = cb
  }

  getParticipants(): VoiceParticipant[] {
    return Array.from(this.participants.values())
  }
}
