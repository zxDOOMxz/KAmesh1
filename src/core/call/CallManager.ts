import { P2PBridge } from '../../native/P2PBridge';
import { WebRTCBridge, type IceCandidate, type SessionDescription } from '../../native/WebRTCBridge';
import type { CallState, VoiceSignal, RingPayload, AnswerPayload, IcePayload } from './types';

export class CallManager {
  private p2p: P2PBridge;
  private webrtc: WebRTCBridge;
  private _state: CallState;
  private listeners: Set<(state: CallState) => void> = new Set();
  private unsubMessage: (() => void) | null = null;
  private unsubIceCandidate: (() => void) | null = null;
  private unsubIceState: (() => void) | null = null;

  private connId: string = '';
  private pendingOffer: SessionDescription | null = null;

  constructor() {
    this.p2p = new P2PBridge();
    this.webrtc = new WebRTCBridge();
    this._state = {
      status: 'idle',
      peerId: '',
      connectionId: '',
      direction: 'outgoing',
      mute: false,
    };
  }

  getState(): CallState {
    return { ...this._state };
  }

  subscribe(cb: (state: CallState) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  async init(): Promise<void> {
    this.unsubMessage = this.p2p.onMessage((event) => {
      try {
        const data = event.data.startsWith('MSG:')
          ? event.data.slice(4)
          : event.data;
        const parsed = JSON.parse(data.trim());
        if (parsed.type === 'voice_signal') {
          this.handleSignal(event.connectionId, parsed as VoiceSignal);
        }
      } catch {
        // not a voice signal
      }
    });

    this.unsubIceCandidate = this.webrtc.onIceCandidate((candidate) => {
      if (this._state.status !== 'connected' && this._state.status !== 'calling') {return;}
      const signal: VoiceSignal = {
        type: 'voice_signal',
        subtype: 'ice',
        payload: {
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
          candidate: candidate.candidate,
        },
      };
      this.sendSignal(JSON.stringify(signal));
    });

    this.unsubIceState = this.webrtc.onIceConnectionState((state) => {
      if (state.state === 'DISCONNECTED' || state.state === 'FAILED' || state.state === 'CLOSED') {
        if (this._state.status === 'connected' || this._state.status === 'calling') {
          this.endCall();
        }
      }
    });
  }

  async startCall(targetConnId: string, peerId: string): Promise<void> {
    if (this._state.status !== 'idle') {return;}

    this.connId = targetConnId;
    this.setState({
      status: 'calling',
      peerId,
      connectionId: targetConnId,
      direction: 'outgoing',
    });

    try {
      await this.webrtc.initAudio();
      await this.webrtc.startAudioDevice();

      await this.webrtc.createConnectionWithId(this.connId);
      const offer = await this.webrtc.createOffer(this.connId);

      const signal: VoiceSignal = {
        type: 'voice_signal',
        subtype: 'ring',
        payload: { offer },
      };
      await this.sendSignal(JSON.stringify(signal));
    } catch (e) {
      this.setState({ status: 'idle', error: String(e) });
      await this.cleanupWebRTC();
    }
  }

  async acceptCall(): Promise<void> {
    if (this._state.status !== 'ringing' || !this.pendingOffer) {return;}

    this.setState({ status: 'calling', direction: 'incoming' });

    try {
      await this.webrtc.initAudio();
      await this.webrtc.startAudioDevice();

      await this.webrtc.createConnectionWithId(this.connId);
      await this.webrtc.setRemoteDescription(this.connId, this.pendingOffer);
      const answer = await this.webrtc.createAnswer(this.connId);

      const signal: VoiceSignal = {
        type: 'voice_signal',
        subtype: 'answer',
        payload: { answer },
      };
      await this.sendSignal(JSON.stringify(signal));

      this.setState({ status: 'connected' });
    } catch (e) {
      this.setState({ status: 'idle', error: String(e) });
      await this.cleanupWebRTC();
    }
  }

  async rejectCall(): Promise<void> {
    if (this._state.status !== 'ringing') {return;}

    const signal: VoiceSignal = {
      type: 'voice_signal',
      subtype: 'end',
      payload: {},
    };
    await this.sendSignal(JSON.stringify(signal));
    this.setState({ status: 'idle' });
  }

  async endCall(): Promise<void> {
    if (this._state.status === 'idle') {return;}

    if (this._state.status === 'connected' || this._state.status === 'calling') {
      const signal: VoiceSignal = {
        type: 'voice_signal',
        subtype: 'end',
        payload: {},
      };
      await this.sendSignal(JSON.stringify(signal));
    }

    await this.cleanupWebRTC();
    await this.webrtc.stopAudioDevice();
    this.setState({ status: 'idle' });
  }

  async toggleMute(): Promise<void> {
    const mute = !this._state.mute;
    this.setState({ mute });
  }

  destroy(): void {
    this.unsubMessage?.();
    this.unsubIceCandidate?.();
    this.unsubIceState?.();
    this.cleanupWebRTC();
  }

  private async handleSignal(connectionId: string, signal: VoiceSignal): Promise<void> {
    switch (signal.subtype) {
      case 'ring': {
        const payload = signal.payload as unknown as RingPayload;
        this.pendingOffer = payload.offer;
        this.connId = connectionId;
        this.setState({
          status: 'ringing',
          peerId: connectionId,
          connectionId,
          direction: 'incoming',
        });
        break;
      }
      case 'answer': {
        const payload = signal.payload as unknown as AnswerPayload;
        await this.webrtc.setRemoteDescription(this.connId, payload.answer);
        this.setState({ status: 'connected' });
        break;
      }
      case 'ice': {
        const payload = signal.payload as unknown as IcePayload;
        const iceCandidate: IceCandidate = {
          connectionId: this.connId,
          sdpMid: payload.sdpMid,
          sdpMLineIndex: payload.sdpMLineIndex,
          candidate: payload.candidate,
        };
        await this.webrtc.addIceCandidate(this.connId, iceCandidate);
        break;
      }
      case 'end': {
        await this.cleanupWebRTC();
        await this.webrtc.stopAudioDevice();
        this.setState({ status: 'idle' });
        break;
      }
    }
  }

  private async sendSignal(data: string): Promise<void> {
    if (!this.connId) {return;}
    try {
      await this.p2p.sendMessage(this.connId, data);
    } catch (e) {
      console.error('CallManager: failed to send signal', e);
    }
  }

  private async cleanupWebRTC(): Promise<void> {
    if (this.connId) {
      this.webrtc.closeConnection(this.connId);
    }
    this.pendingOffer = null;
  }

  private setState(partial: Partial<CallState>): void {
    this._state = { ...this._state, ...partial };
    const snapshot = this.getState();
    this.listeners.forEach((cb) => cb(snapshot));
  }
}
