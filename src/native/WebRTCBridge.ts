import { NativeModules, NativeEventEmitter } from 'react-native'
import type { VoiceChannelConfig, VoiceParticipant } from '../voice/VoiceChannel'

const { SofiLinkWebRTC } = NativeModules
const eventEmitter = new NativeEventEmitter(SofiLinkWebRTC)

const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

export interface IceCandidate {
  connectionId: string
  sdpMid: string
  sdpMLineIndex: number
  candidate: string
}

export interface SessionDescription {
  type: string
  sdp: string
}

export interface PeerConnectionState {
  connectionId: string
  state: string
}

export class WebRTCBridge {
  private nextConnectionId = 0

  async initAudio(): Promise<void> {
    const trackId = `audio_${Date.now()}`
    await SofiLinkWebRTC.createAudioTrack(trackId)
  }

  async createConnection(iceServers?: typeof STUN_SERVERS): Promise<string> {
    const connId = `pc_${this.nextConnectionId++}`
    await SofiLinkWebRTC.createPeerConnection(connId, iceServers ?? STUN_SERVERS)
    await SofiLinkWebRTC.addLocalAudioTrack(connId)
    return connId
  }

  async createOffer(connectionId: string): Promise<SessionDescription> {
    return SofiLinkWebRTC.createOffer(connectionId)
  }

  async createAnswer(connectionId: string): Promise<SessionDescription> {
    return SofiLinkWebRTC.createAnswer(connectionId)
  }

  async setRemoteDescription(
    connectionId: string,
    desc: SessionDescription,
  ): Promise<void> {
    await SofiLinkWebRTC.setRemoteDescription(
      connectionId,
      desc.type,
      desc.sdp,
    )
  }

  async addIceCandidate(connectionId: string, candidate: IceCandidate): Promise<void> {
    await SofiLinkWebRTC.addIceCandidate(
      connectionId,
      candidate.sdpMid,
      candidate.sdpMLineIndex,
      candidate.candidate,
    )
  }

  closeConnection(connectionId: string): void {
    SofiLinkWebRTC.closePeerConnection(connectionId)
  }

  dispose(): void {
    SofiLinkWebRTC.dispose()
  }

  onIceCandidate(cb: (candidate: IceCandidate) => void): () => void {
    const sub = eventEmitter.addListener('onIceCandidate', cb)
    return () => sub.remove()
  }

  onIceConnectionState(cb: (state: PeerConnectionState) => void): () => void {
    const sub = eventEmitter.addListener('onIceConnectionState', cb)
    return () => sub.remove()
  }
}

export const createWebRTCBridge = (): WebRTCBridge => new WebRTCBridge()
