import { NativeModules, NativeEventEmitter } from 'react-native';
import type { PeerId } from '../core/p2p/PeerId';

const { SofiLinkP2P } = NativeModules;
const eventEmitter = new NativeEventEmitter(SofiLinkP2P);

export interface DiscoveredPeerEvent {
  peerId: string
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
    const id = await SofiLinkP2P.init();
    this._peerId = id;
    return id;
  }

  getPeerId(): PeerId | null {
    return this._peerId;
  }

  async startServer(port = 0): Promise<ServerInfo> {
    return SofiLinkP2P.startServer(port);
  }

  async connect(host: string, port: number): Promise<string> {
    return SofiLinkP2P.connect(host, port);
  }

  async sendMessage(connectionId: string, data: string): Promise<void> {
    await SofiLinkP2P.sendMessage(connectionId, data);
  }

  disconnect(connectionId: string): void {
    SofiLinkP2P.disconnect(connectionId);
  }

  disconnectAll(): void {
    SofiLinkP2P.disconnectAll();
  }

  stopAll(): void {
    SofiLinkP2P.stopAll();
  }

  onMessage(cb: (event: MessageEvent) => void): () => void {
    const sub = eventEmitter.addListener('onMessage', cb);
    return () => sub.remove();
  }

  onPeerDiscovered(cb: (event: DiscoveredPeerEvent) => void): () => void {
    const sub = eventEmitter.addListener('onPeerDiscovered', cb);
    return () => sub.remove();
  }
}

export const createP2PBridge = (): P2PBridge => new P2PBridge();
