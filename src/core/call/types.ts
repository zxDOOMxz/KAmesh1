import type { SessionDescription } from '../../native/WebRTCBridge';

export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended'

export interface CallState {
  status: CallStatus
  peerId: string
  connectionId: string
  direction: 'outgoing' | 'incoming'
  mute: boolean
  error?: string
}

export interface VoiceSignal {
  type: 'voice_signal'
  subtype: 'ring' | 'offer' | 'answer' | 'ice' | 'end'
  payload: Record<string, unknown>
}

export interface RingPayload {
  offer: SessionDescription
}

export interface AnswerPayload {
  answer: SessionDescription
}

export interface IcePayload {
  sdpMid: string
  sdpMLineIndex: number
  candidate: string
}
