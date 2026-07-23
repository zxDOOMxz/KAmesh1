import { NativeModules, NativeEventEmitter } from 'react-native';

const { SofiLinkWebRTC } = NativeModules;
const eventEmitter = SofiLinkWebRTC ? new NativeEventEmitter(SofiLinkWebRTC) : null;

const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

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
  private nextConnectionId = 0;

  async initAudio(): Promise<void> {
    if (!SofiLinkWebRTC) { return; }
    const trackId = `audio_${Date.now()}`;
    await SofiLinkWebRTC.createAudioTrack(trackId);
  }

  async startAudioDevice(): Promise<void> {
    if (!SofiLinkWebRTC) { return; }
    await SofiLinkWebRTC.startAudioDevice();
  }

  async stopAudioDevice(): Promise<void> {
    if (!SofiLinkWebRTC) { return; }
    await SofiLinkWebRTC.stopAudioDevice();
  }

  async setSpeakerphoneOn(enabled: boolean): Promise<void> {
    if (!SofiLinkWebRTC) { return; }
    await SofiLinkWebRTC.setSpeakerphoneOn(enabled);
  }

  async createConnection(iceServers?: typeof STUN_SERVERS): Promise<string> {
    if (!SofiLinkWebRTC) { return ''; }
    const connId = `pc_${this.nextConnectionId++}`;
    await SofiLinkWebRTC.createPeerConnection(connId, iceServers ?? STUN_SERVERS);
    await SofiLinkWebRTC.addLocalAudioTrack(connId);
    return connId;
  }

  async createConnectionWithId(connId: string, iceServers?: typeof STUN_SERVERS): Promise<void> {
    if (!SofiLinkWebRTC) { return; }
    await SofiLinkWebRTC.createPeerConnection(connId, iceServers ?? STUN_SERVERS);
    await SofiLinkWebRTC.addLocalAudioTrack(connId);
  }

  async createOffer(connectionId: string): Promise<SessionDescription> {
    if (!SofiLinkWebRTC) { return { type: '', sdp: '' }; }
    return SofiLinkWebRTC.createOffer(connectionId);
  }

  async createAnswer(connectionId: string): Promise<SessionDescription> {
    if (!SofiLinkWebRTC) { return { type: '', sdp: '' }; }
    return SofiLinkWebRTC.createAnswer(connectionId);
  }

  async setRemoteDescription(connectionId: string, desc: SessionDescription): Promise<void> {
    if (!SofiLinkWebRTC) { return; }
    await SofiLinkWebRTC.setRemoteDescription(connectionId, desc.type, desc.sdp);
  }

  async addIceCandidate(connectionId: string, candidate: IceCandidate): Promise<void> {
    if (!SofiLinkWebRTC) { return; }
    await SofiLinkWebRTC.addIceCandidate(connectionId, candidate.sdpMid, candidate.sdpMLineIndex, candidate.candidate);
  }

  closeConnection(connectionId: string): void {
    if (!SofiLinkWebRTC) { return; }
    SofiLinkWebRTC.closePeerConnection(connectionId);
  }

  dispose(): void {
    if (!SofiLinkWebRTC) { return; }
    SofiLinkWebRTC.dispose();
  }

  onIceCandidate(cb: (candidate: IceCandidate) => void): () => void {
    if (!eventEmitter) { return () => {}; }
    const sub = eventEmitter.addListener('onIceCandidate', cb);
    return () => sub.remove();
  }

  onIceConnectionState(cb: (state: PeerConnectionState) => void): () => void {
    if (!eventEmitter) { return () => {}; }
    const sub = eventEmitter.addListener('onIceConnectionState', cb);
    return () => sub.remove();
  }
}
