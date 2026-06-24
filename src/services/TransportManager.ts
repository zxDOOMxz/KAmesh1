import type { ITransport } from './transports/ITransport';
import { BleTransport } from './transports/BleTransport';
import { WifiTransport } from './transports/WifiTransport';
import { GsmTransport } from './transports/GsmTransport';
import type { NodeId } from '../types';

type DataHandler = (data: string, peerId: NodeId) => void;
type ConnectionHandler = (peerId: NodeId, connected: boolean) => void;

class TransportManagerClass {
  private initialized = false;
  private transports: ITransport[] = [];
  private dataCleanups: (() => void)[] = [];
  private connectionCleanups: (() => void)[] = [];
  private dataHandlers: DataHandler[] = [];
  private connectionHandlers: ConnectionHandler[] = [];

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.transports = [GsmTransport, WifiTransport, BleTransport];

    for (const t of this.transports) {
      try { await t.init(); } catch { /* ignore */ }
    }

    for (const t of this.transports) {
      const cleanup = t.onData((data, peerId) => {
        for (const handler of this.dataHandlers) { try { handler(data, peerId); } catch { /* ignore */ } }
      });
      this.dataCleanups.push(cleanup);
    }

    for (const t of this.transports) {
      const cleanup = t.onConnection((peerId, connected) => {
        for (const handler of this.connectionHandlers) { try { handler(peerId, connected); } catch { /* ignore */ } }
      });
      this.connectionCleanups.push(cleanup);
    }

    this.initialized = true;
  }

  destroy(): void {
    for (const cleanup of this.dataCleanups) cleanup();
    for (const cleanup of this.connectionCleanups) cleanup();
    for (const t of this.transports) t.destroy();
    this.dataCleanups = [];
    this.connectionCleanups = [];
    this.dataHandlers = [];
    this.connectionHandlers = [];
    this.initialized = false;
  }

  async send(peerId: NodeId, data: string): Promise<void> {
    const sorted = [...this.transports].sort((a, b) => a.priority - b.priority);
    for (const t of sorted) {
      try {
        if (await t.isAvailable()) { await t.send(peerId, data); return; }
      } catch { /* try next */ }
    }
  }

  async broadcast(data: string): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const t of this.transports) {
      try {
        if (await t.isAvailable()) promises.push(t.broadcast(data).catch(() => {}));
      } catch { /* ignore */ }
    }
    await Promise.all(promises);
  }

  async sendVia(transportName: string, peerId: NodeId, data: string): Promise<void> {
    const transport = this.transports.find(t => t.name === transportName);
    if (!transport) throw new Error(`Transport ${transportName} not found`);
    await transport.send(peerId, data);
  }

  getConnectedPeers(): NodeId[] {
    const peers = new Set<NodeId>();
    for (const t of this.transports) { for (const p of t.getConnectedPeers()) peers.add(p); }
    return Array.from(peers);
  }

  isConnected(peerId: NodeId): boolean { return this.transports.some(t => t.isConnected(peerId)); }
  getSignalStrength(peerId: NodeId): number { return Math.max(...this.transports.map(t => t.getSignalStrength(peerId))); }
  getTransportsForPeer(peerId: NodeId): string[] { return this.transports.filter(t => t.isConnected(peerId)).map(t => t.name); }

  onData(handler: DataHandler): () => void {
    this.dataHandlers.push(handler);
    return () => { this.dataHandlers = this.dataHandlers.filter(h => h !== handler); };
  }

  onConnection(handler: ConnectionHandler): () => void {
    this.connectionHandlers.push(handler);
    return () => { this.connectionHandlers = this.connectionHandlers.filter(h => h !== handler); };
  }

  isInitialized(): boolean { return this.initialized; }
}

export const TransportManager = new TransportManagerClass();
