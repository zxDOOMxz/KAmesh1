import NetInfo from '@react-native-community/netinfo';
import type { ITransport, TransportDataHandler, TransportConnectionHandler } from './ITransport';
import type { NodeId } from '../../types';
import { withTimeout } from '../../utils/timeout';
import { RELAY_URL, RELAY_CONNECT_TIMEOUT_MS } from '../../constants';

const RELAY_RECONNECT_MS = 10_000;
const PING_INTERVAL_MS = 30_000;

class GsmTransportImpl implements ITransport {
  readonly name = 'gsm';
  readonly priority = 0;

  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setInterval> | null = null;
  private myPeerId: NodeId = '';
  private connected = false;
  private intentionalClose = false;
  private dataHandlers: TransportDataHandler[] = [];
  private connectionHandlers: TransportConnectionHandler[] = [];
  private onlinePeers: NodeId[] = [];

  async init(): Promise<void> {
    this.myPeerId = this.getMyPeerId();
    await this.connectToRelay();
  }

  destroy(): void {
    this.intentionalClose = true;
    this.disconnectFromRelay();
    if (this.reconnectTimer) { clearInterval(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
    this.dataHandlers = [];
    this.connectionHandlers = [];
  }

  async isAvailable(): Promise<boolean> {
    try { const state = await NetInfo.fetch(); return !!(state.isConnected && state.isInternetReachable !== false); }
    catch { return false; }
  }

  async send(peerId: NodeId, data: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error('WebSocket not connected');
    this.ws.send(JSON.stringify({ type: 'relay_send', targetPeerId: peerId, payload: data, senderId: this.myPeerId, timestamp: Date.now() }));
  }

  async broadcast(data: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'relay_broadcast', payload: data, senderId: this.myPeerId, timestamp: Date.now() }));
  }

  getConnectedPeers(): NodeId[] { return this.onlinePeers.filter(p => p !== this.myPeerId); }
  isConnected(peerId: NodeId): boolean { return this.connected && this.onlinePeers.includes(peerId); }
  getSignalStrength(peerId: NodeId): number { return this.isConnected(peerId) ? 80 : -1; }

  onData(handler: TransportDataHandler): () => void {
    this.dataHandlers.push(handler);
    return () => { this.dataHandlers = this.dataHandlers.filter(h => h !== handler); };
  }

  onConnection(handler: TransportConnectionHandler): () => void {
    this.connectionHandlers.push(handler);
    return () => { this.connectionHandlers = this.connectionHandlers.filter(h => h !== handler); };
  }

  private async connectToRelay(): Promise<void> {
    try {
      if (!(await this.isAvailable())) return;
      this.intentionalClose = false;
      this.ws = new WebSocket(RELAY_URL);

      await withTimeout(new Promise<void>((resolve, reject) => {
        const ws = this.ws!;
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new Error('WebSocket error'));
        ws.onclose = () => reject(new Error('WebSocket closed'));
      }), RELAY_CONNECT_TIMEOUT_MS, 'WebSocket connect');

      this.ws.send(JSON.stringify({ type: 'relay_register', peerId: this.myPeerId }));
      this.connected = true;
      this.startPingLoop();
      this.notifyConnection(this.myPeerId, true);
      if (this.reconnectTimer) { clearInterval(this.reconnectTimer); this.reconnectTimer = null; }

      this.ws.onmessage = (event: WebSocketMessageEvent) => this.handleRelayMessage(event.data);
      this.ws.onerror = () => {};
      this.ws.onclose = () => {
        this.connected = false;
        this.stopPingLoop();
        this.notifyConnection(this.myPeerId, false);
        if (!this.intentionalClose) this.startReconnectLoop();
      };
    } catch {
      this.ws?.close();
      this.ws = null;
    }
  }

  private disconnectFromRelay(): void { try { this.ws?.close(); } catch { /* ignore */ } this.ws = null; this.connected = false; }

  private startReconnectLoop(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setInterval(async () => {
      if (this.connected || this.intentionalClose) return;
      await this.connectToRelay();
    }, RELAY_RECONNECT_MS);
  }

  private handleRelayMessage(rawData: string): void {
    try {
      const msg = JSON.parse(rawData);
      switch (msg.type) {
        case 'relay_message':
          for (const handler of this.dataHandlers) { try { handler(msg.payload, msg.senderId); } catch { /* ignore */ } }
          break;
        case 'relay_peer_list':
          this.onlinePeers = msg.peers || [];
          break;
        case 'relay_peer_online':
          if (!this.onlinePeers.includes(msg.peerId)) { this.onlinePeers.push(msg.peerId); this.notifyConnection(msg.peerId, true); }
          break;
        case 'relay_peer_offline':
          this.onlinePeers = this.onlinePeers.filter(p => p !== msg.peerId);
          this.notifyConnection(msg.peerId, false);
          break;
      }
    } catch { /* ignore */ }
  }

  private startPingLoop(): void {
    if (this.pingTimer) return;
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'relay_ping' }));
    }, PING_INTERVAL_MS);
  }

  private stopPingLoop(): void { if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; } }

  private notifyConnection(peerId: NodeId, connected: boolean): void {
    for (const handler of this.connectionHandlers) { try { handler(peerId, connected); } catch { /* ignore */ } }
  }

  private getMyPeerId(): NodeId {
    try { return require('../StorageService').getNodeId() || 'unknown'; }
    catch { return 'unknown'; }
  }
}

export const GsmTransport = new GsmTransportImpl();
