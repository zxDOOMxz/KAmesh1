export interface DHTConfig {
  kBucketSize: number // Kademlia k = 20
  maxPeers: number
  refreshIntervalMs: number
}

export interface DHTNode {
  start(): Promise<void>
  stop(): Promise<void>
  findPeer(peerId: string): Promise<string[]> // returns multiaddrs
  announce(peerId: string, addrs: string[]): Promise<void>
}
