import { WebRTCBridge } from '../native/WebRTCBridge';
import { P2PBridge } from '../native/P2PBridge';


export type SignalingState = {
  status: 'idle' | 'calling' | 'ringing' | 'connected' | 'failed'
  peerId: string
  connectionId: string | null
}

export class VoiceSignaling {
  private webrtc: WebRTCBridge;
  private p2p: P2PBridge;
  private state: SignalingState = {
    status: 'idle',
    peerId: '',
    connectionId: null,
  };
  private cleanupFns: (() => void)[] = [];
  private onStateChange?: (s: SignalingState) => void;

  constructor(p2p: P2PBridge) {
    this.webrtc = new WebRTCBridge();
    this.p2p = p2p;
  }

  setOnStateChange(cb: (s: SignalingState) => void): void {
    this.onStateChange = cb;
  }

  private setState(partial: Partial<SignalingState>): void {
    this.state = { ...this.state, ...partial };
    this.onStateChange?.(this.state);
  }

  async call(peerConnId: string): Promise<void> {
    this.setState({ status: 'calling', peerId: peerConnId });

    await this.webrtc.initAudio();
    const connId = await this.webrtc.createConnection();
    this.setState({ connectionId: connId });

    const offer = await this.webrtc.createOffer(connId);

    await this.p2p.sendMessage(
      peerConnId,
      JSON.stringify({ type: 'webrtc_offer', sdp: offer.sdp }),
    );

    const unsubIce = this.webrtc.onIceCandidate((candidate) => {
      if (candidate.connectionId === connId) {
        this.p2p.sendMessage(
          peerConnId,
          JSON.stringify({ type: 'webrtc_ice', candidate }),
        );
      }
    });
    this.cleanupFns.push(unsubIce);

    const unsubMsg = this.p2p.onMessage(async (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'webrtc_answer') {
          await this.webrtc.setRemoteDescription(connId, {
            type: 'answer',
            sdp: msg.sdp,
          });
          this.setState({ status: 'connected' });
        } else if (msg.type === 'webrtc_ice') {
          await this.webrtc.addIceCandidate(connId, msg.candidate);
        }
      } catch {}
    });
    this.cleanupFns.push(unsubMsg);
  }

  async answer(peerConnId: string, offerSdp: string): Promise<void> {
    this.setState({ status: 'ringing', peerId: peerConnId });

    await this.webrtc.initAudio();
    const connId = await this.webrtc.createConnection();
    this.setState({ connectionId: connId });

    await this.webrtc.setRemoteDescription(connId, {
      type: 'offer',
      sdp: offerSdp,
    });

    const answer = await this.webrtc.createAnswer(connId);

    await this.p2p.sendMessage(
      peerConnId,
      JSON.stringify({ type: 'webrtc_answer', sdp: answer.sdp }),
    );

    const unsubIce = this.webrtc.onIceCandidate((candidate) => {
      if (candidate.connectionId === connId) {
        this.p2p.sendMessage(
          peerConnId,
          JSON.stringify({ type: 'webrtc_ice', candidate }),
        );
      }
    });
    this.cleanupFns.push(unsubIce);

    const unsubMsg = this.p2p.onMessage(async (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'webrtc_ice') {
          await this.webrtc.addIceCandidate(connId, msg.candidate);
          this.setState({ status: 'connected' });
        }
      } catch {}
    });
    this.cleanupFns.push(unsubMsg);
  }

  async hangUp(): Promise<void> {
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
    if (this.state.connectionId) {
      this.webrtc.closeConnection(this.state.connectionId);
    }
    this.webrtc.dispose();
    this.setState({ status: 'idle', connectionId: null, peerId: '' });
  }
}
