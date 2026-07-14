import { PeerId, PeerInfo } from './PeerId'

export interface P2PNodeConfig {
  listenPort: number
  bootstrapPeers: string[]
  enableDHT: boolean
  enableMDNS: boolean
}

export interface P2PNode {
  start(): Promise<void>
  stop(): Promise<void>
  getPeerId(): PeerId
  connect(peerId: PeerId, addrs: string[]): Promise<void>
  disconnect(peerId: PeerId): Promise<void>
  sendMessage(peerId: PeerId, data: Uint8Array): Promise<void>
  onPeerConnected(cb: (peer: PeerInfo) => void): void
  onPeerDisconnected(cb: (peer: PeerInfo) => void): void
  onMessage(cb: (peerId: PeerId, data: Uint8Array) => void): void
  getConnectedPeers(): PeerInfo[]
}
