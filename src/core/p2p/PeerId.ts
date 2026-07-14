export type PeerId = string // Ed25519 public key hex

export interface PeerInfo {
  peerId: PeerId
  multiaddrs: string[]
  connectedAt: number
  lastSeen: number
  signalQuality: number // 0-100
}
