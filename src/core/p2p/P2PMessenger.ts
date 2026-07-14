import { P2PBridge } from '../../native/P2PBridge'
import { CryptoBridge } from '../../native/CryptoBridge'
import type { Store, MessageRecord } from '../../storage/Store'

let _id = 0
function uid(): string {
  return `${Date.now().toString(36)}_${(++_id).toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

export interface P2PState {
  peerId: string
  serverInfo: { serverId: string; localIp: string; port: number } | null
  connectedPeers: Map<string, { host: string; port: number }>
  messages: MessageRecord[]
  status: 'idle' | 'starting' | 'running' | 'error'
}

export type StateListener = (state: P2PState) => void

export class P2PMessenger {
  private p2p: P2PBridge
  private crypto: CryptoBridge
  private store: Store
  private state: P2PState
  private listeners: Set<StateListener> = new Set()
  private cleanupFns: (() => void)[] = []

  constructor(store: Store) {
    this.p2p = new P2PBridge()
    this.crypto = new CryptoBridge()
    this.store = store
    this.state = {
      peerId: '',
      serverInfo: null,
      connectedPeers: new Map(),
      messages: [],
      status: 'idle',
    }
  }

  getState(): P2PState {
    return { ...this.state, connectedPeers: new Map(this.state.connectedPeers) }
  }

  subscribe(cb: StateListener): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  async init(): Promise<void> {
    this.state = { ...this.state, status: 'starting' }
    this.notify()

    try {
      const peerId = await this.p2p.init()

      const unsubMessage = this.p2p.onMessage(async (event) => {
        try {
          const parsed = JSON.parse(event.data)
          if (parsed.type === 'encrypted_msg') {
            const plaintext = await this.crypto.decrypt(
              hexToBytes(parsed.ciphertext),
              hexToBytes(parsed.nonce),
              hexToBytes(parsed.key),
            )
            const decoded = new TextDecoder().decode(plaintext)
            const record: MessageRecord = {
              id: uid(),
              channelId: parsed.channelId || 'default',
              senderPeerId: parsed.senderPeerId || event.connectionId,
              ciphertext: plaintext,
              nonce: hexToBytes(parsed.nonce),
              createdAt: Date.now(),
              expiresAt: Date.now() + 86400000 * 7,
              sizeBytes: plaintext.length,
            }
            await this.store.saveMessage(record)
            this.state.messages.unshift(record)
            if (this.state.messages.length > 100) this.state.messages.length = 100
            this.notify()
          }
        } catch {
          // unparseable message
        }
      })

      this.cleanupFns.push(unsubMessage)

      this.state = { ...this.state, peerId, status: 'running' }
      this.notify()
    } catch (e) {
      this.state = { ...this.state, status: 'error' }
      this.notify()
      throw e
    }
  }

  async startServer(port = 0): Promise<void> {
    const info = await this.p2p.startServer(port)
    this.state = { ...this.state, serverInfo: info }
    this.notify()
  }

  async connect(host: string, port: number): Promise<void> {
    const connId = await this.p2p.connect(host, port)
    this.state.connectedPeers.set(connId, { host, port })
    this.notify()
  }

  async sendMessage(text: string, connId: string, channelId = 'default'): Promise<void> {
    const { publicKey, secretKey } = await this.crypto.generateKeyPair()
    const nonce = await this.crypto.generateNonce()
    const plaintext = new TextEncoder().encode(text)

    const ciphertext = await this.crypto.encrypt(plaintext, secretKey, nonce)

    const payload = JSON.stringify({
      type: 'encrypted_msg',
      ciphertext: bytesToHex(ciphertext),
      nonce: bytesToHex(nonce),
      key: bytesToHex(publicKey),
      senderPeerId: this.state.peerId,
      channelId,
    })

    await this.p2p.sendMessage(connId, payload)

    const record: MessageRecord = {
      id: uid(),
      channelId,
      senderPeerId: this.state.peerId,
      ciphertext: plaintext,
      nonce,
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000 * 7,
      sizeBytes: plaintext.length,
    }
    await this.store.saveMessage(record)
    this.state.messages.unshift(record)
    if (this.state.messages.length > 100) this.state.messages.length = 100
    this.notify()
  }

  async disconnect(connId: string): Promise<void> {
    this.p2p.disconnect(connId)
    this.state.connectedPeers.delete(connId)
    this.notify()
  }

  async destroy(): Promise<void> {
    this.cleanupFns.forEach((fn) => fn())
    this.cleanupFns = []
    this.p2p.stopAll()
    this.state = {
      peerId: '',
      serverInfo: null,
      connectedPeers: new Map(),
      messages: [],
      status: 'idle',
    }
    this.notify()
  }

  private notify(): void {
    const snapshot = this.getState()
    this.listeners.forEach((cb) => cb(snapshot))
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}
