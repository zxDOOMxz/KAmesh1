import type { MediaStream, RTCSessionDescription as RTCSessionDescriptionType, RTCIceCandidate as RTCIceCandidateType } from 'react-native-webrtc';
import { CallState, MessageType, MeshPacket, NodeId } from '../types';
import { CALL_RTP_TIMEOUT_MS } from '../constants';
import { MeshService } from './MeshService';

let _webrtc: any = null;
function getWebrtc() {
  if (!_webrtc) {
    _webrtc = require('react-native-webrtc');
  }
  return _webrtc;
}

const ICE_SERVERS: { urls?: string | string[]; username?: string; credential?: string }[] = [];

class VoiceCallServiceClass {
  private peerConnection: any = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private state: CallState = CallState.IDLE;
  private currentPeerId: NodeId = '';
  private rtpTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingCall: { peerId: NodeId; sdp: string } | null = null;
  private stateHandlers: Map<string, (state: CallState) => void> = new Map();

  initialize(): void {
    MeshService.onPacket(this.handleCallPacket.bind(this));
  }

  async startCall(peerId: NodeId): Promise<void> {
    if (this.state !== CallState.IDLE) throw new Error('Already in a call');
    if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = null; }
    this.currentPeerId = peerId;
    this.setState(CallState.CALLING);
    this.peerConnection = new (getWebrtc().RTCPeerConnection)({ iceServers: ICE_SERVERS });
    this.localStream = await getWebrtc().mediaDevices.getUserMedia({ audio: true, video: false });
    this.localStream!.getTracks().forEach(track => this.peerConnection!.addTrack(track, this.localStream!));
    this.peerConnection.addEventListener('track', (event: any) => { this.remoteStream = event.streams[0]; this.startRtpWatchdog(); });
    this.peerConnection.addEventListener('icecandidate', (event: any) => { if (event.candidate) this.sendIceCandidate(event.candidate); });
    this.peerConnection.addEventListener('iceconnectionstatechange', () => {
      const state = this.peerConnection?.iceConnectionState;
      if (state === 'disconnected' || state === 'failed') { this.restartIce().catch(() => this.endCall()); }
    });
    const offer = await this.peerConnection.createOffer({ offerToReceiveAudio: true });
    await this.peerConnection.setLocalDescription(offer);
    await MeshService.sendMessage(MessageType.SDP_OFFER, JSON.stringify({ sdp: offer.sdp, type: offer.type }), peerId);
  }

  async acceptCall(peerId: NodeId, offerSdp: string): Promise<void> {
    this.currentPeerId = peerId;
    this.setState(CallState.CONNECTING);
    this.peerConnection = new (getWebrtc().RTCPeerConnection)({ iceServers: ICE_SERVERS });
    this.localStream = await getWebrtc().mediaDevices.getUserMedia({ audio: true, video: false });
    this.localStream!.getTracks().forEach(track => this.peerConnection!.addTrack(track, this.localStream!));
    this.peerConnection.addEventListener('track', (event: any) => { this.remoteStream = event.streams[0]; this.startRtpWatchdog(); });
    this.peerConnection.addEventListener('icecandidate', (event: any) => { if (event.candidate) this.sendIceCandidate(event.candidate); });
    const offer = new (getWebrtc().RTCSessionDescription)({ sdp: offerSdp, type: 'offer' });
    await this.peerConnection.setRemoteDescription(offer);
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    await MeshService.sendMessage(MessageType.SDP_ANSWER, JSON.stringify({ sdp: answer.sdp, type: answer.type }), peerId);
    this.setState(CallState.CONNECTED);
  }

  rejectCall(): void { this.endCall(); }

  endCall(): void {
    if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = null; }
    if (this.rtpTimer) { clearTimeout(this.rtpTimer); this.rtpTimer = null; }
    if (this.localStream) { this.localStream.getTracks().forEach(t => t.stop()); this.localStream = null; }
    this.remoteStream = null;
    if (this.peerConnection) { this.peerConnection.close(); this.peerConnection = null; }
    this.currentPeerId = '';
    this.setState(CallState.ENDED);
    this.idleTimer = setTimeout(() => { if (this.state === CallState.ENDED) this.setState(CallState.IDLE); }, 1000);
  }

  private async handleCallPacket(packet: MeshPacket): Promise<void> {
    try {
      switch (packet.type) {
        case MessageType.SDP_OFFER:
          if (this.state === CallState.IDLE) {
            this.setState(CallState.RINGING);
            const offerData = JSON.parse(packet.payload);
            this.pendingCall = { peerId: packet.sourceId, sdp: offerData.sdp };
            this.notifyIncomingCall(packet.sourceId, offerData.sdp);
          }
          break;
        case MessageType.SDP_ANSWER:
          if (this.peerConnection && this.state === CallState.CALLING) {
            const answerData = JSON.parse(packet.payload);
            await this.peerConnection.setRemoteDescription(new (getWebrtc().RTCSessionDescription)({ sdp: answerData.sdp, type: 'answer' }));
            this.setState(CallState.CONNECTED);
          }
          break;
        case MessageType.ICE_CANDIDATE:
          if (this.peerConnection) {
            const candidateData = JSON.parse(packet.payload);
            await this.peerConnection.addIceCandidate(new (getWebrtc().RTCIceCandidate)({ candidate: candidateData.candidate, sdpMid: candidateData.sdpMid, sdpMLineIndex: candidateData.sdpMLineIndex }));
          }
          break;
      }
    } catch { /* ignore */ }
  }

  private async sendIceCandidate(candidate: RTCIceCandidateType): Promise<void> {
    await MeshService.sendMessage(MessageType.ICE_CANDIDATE, JSON.stringify({ candidate: candidate.candidate, sdpMid: candidate.sdpMid, sdpMLineIndex: candidate.sdpMLineIndex }), this.currentPeerId);
  }

  private async restartIce(): Promise<void> {
    if (!this.peerConnection) return;
    const offer = await this.peerConnection.createOffer({ iceRestart: true });
    await this.peerConnection.setLocalDescription(offer);
    await MeshService.sendMessage(MessageType.SDP_OFFER, JSON.stringify({ sdp: offer.sdp, type: offer.type }), this.currentPeerId);
  }

  private startRtpWatchdog(): void {
    if (this.rtpTimer) clearTimeout(this.rtpTimer);
    this.rtpTimer = setTimeout(() => this.endCall(), CALL_RTP_TIMEOUT_MS);
  }

  private setState(newState: CallState): void { this.state = newState; this.notifyStateChange(newState); }
  getState(): CallState { return this.state; }
  consumePendingCall(): { peerId: NodeId; sdp: string } | null { const call = this.pendingCall; this.pendingCall = null; return call; }
  getRemoteStream(): MediaStream | null { return this.remoteStream; }
  getCurrentPeerId(): NodeId { return this.currentPeerId; }

  onStateChange(id: string, handler: (state: CallState) => void): () => void {
    this.stateHandlers.set(id, handler);
    return () => this.stateHandlers.delete(id);
  }

  private notifyStateChange(state: CallState): void {
    for (const handler of this.stateHandlers.values()) { try { handler(state); } catch { /* ignore */ } }
  }

  private incomingCallHandlers: ((peerId: NodeId, sdp: string) => void)[] = [];
  onIncomingCall(handler: (peerId: NodeId, sdp: string) => void): () => void {
    this.incomingCallHandlers.push(handler);
    return () => { this.incomingCallHandlers = this.incomingCallHandlers.filter(h => h !== handler); };
  }
  private notifyIncomingCall(peerId: NodeId, sdp: string): void {
    for (const handler of this.incomingCallHandlers) { try { handler(peerId, sdp); } catch { /* ignore */ } }
  }
}

export const VoiceCallService = new VoiceCallServiceClass();
