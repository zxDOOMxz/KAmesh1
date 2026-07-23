import { NativeModules, NativeEventEmitter } from 'react-native';
import type { PeerId } from '../core/p2p/PeerId';

const { SofiLinkP2P } = NativeModules;
const eventEmitter = SofiLinkP2P ? new NativeEventEmitter(SofiLinkP2P) : null;

export interface DiscoveredPeerEvent {
  peerId: string
  nickname: string
  host: string
  port: number
}

export interface MessageEvent {
  connectionId: string
  data: string
}

export interface ServerInfo {
  serverId: string
  localIp: string
  port: number
}

export class P2PBridge {
  private _peerId: PeerId | null = null;

  async init(): Promise<PeerId> {
    if (!SofiLinkP2P) { throw new Error('P2P native module not available'); }
    const id = await SofiLinkP2P.init();
    this._peerId = id;
    return id;
  }

  getPeerId(): PeerId | null {
    return this._peerId;
  }

  async startServer(port = 0): Promise<ServerInfo> {
    if (!SofiLinkP2P) { throw new Error('P2P native module not available'); }
    return SofiLinkP2P.startServer(port);
  }

  async startDiscovery(nickname: string): Promise<void> {
    if (!SofiLinkP2P) { return; }
    const serviceType = '_sofilink._tcp.';
    await SofiLinkP2P.startDiscovery(serviceType, nickname);
  }

  stopDiscovery(): void {
    if (!SofiLinkP2P) { return; }
    SofiLinkP2P.stopDiscovery();
  }

  async connect(host: string, port: number): Promise<string> {
    if (!SofiLinkP2P) { throw new Error('P2P native module not available'); }
    return SofiLinkP2P.connect(host, port);
  }

  async sendMessage(connectionId: string, data: string): Promise<void> {
    if (!SofiLinkP2P) { throw new Error('P2P native module not available'); }
    await SofiLinkP2P.sendMessage(connectionId, data);
  }

  disconnect(connectionId: string): void {
    if (!SofiLinkP2P) { return; }
    SofiLinkP2P.disconnect(connectionId);
  }

  disconnectAll(): void {
    if (!SofiLinkP2P) { return; }
    SofiLinkP2P.disconnectAll();
  }

  stopAll(): void {
    if (!SofiLinkP2P) { return; }
    SofiLinkP2P.stopAll();
  }

  onMessage(cb: (event: MessageEvent) => void): () => void {
    if (!eventEmitter) { return () => {}; }
    const sub = eventEmitter.addListener('onMessage', cb);
    return () => sub.remove();
  }

  onPeerDiscovered(cb: (event: DiscoveredPeerEvent) => void): () => void {
    if (!eventEmitter) { return () => {}; }
    const sub = eventEmitter.addListener('onPeerDiscovered', cb);
    return () => sub.remove();
  }
}
