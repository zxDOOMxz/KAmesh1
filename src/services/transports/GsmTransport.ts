import type { ITransport, TransportDataHandler, TransportConnectionHandler } from './ITransport';
import type { NodeId } from '../../types';
import { withTimeout } from '../../utils/timeout';
import { RELAY_CONNECT_TIMEOUT_MS, WIFI_TCP_PORT } from '../../constants';
import { getNodeId, getRelayUrl } from '../StorageService';

let _NetInfo: any = null;
function getNetInfo() {
  if (!_NetInfo) {
    _NetInfo = require('@react-native-community/netinfo');
  }
  return _NetInfo;
}

let _TcpSocket: any = null;
function getTcpSocket() {
  if (!_TcpSocket) {
    _TcpSocket = require('react-native-tcp-socket');
  }
  return _TcpSocket;
}

const RELAY_RECONNECT_MS = 10_000;
const PING_INTERVAL_MS = 30_000;
const DIRECT_TCP_TIMEOUT_MS = 8_000;

interface PeerAddr { ip: string; tcpPort: number; }

class GsmTransportImpl implements ITransport {
  readonly name = 'gsm';
  readonly priority = 2;

  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setInterval> | null = null;
  private myPeerId: NodeId = '';
  private connected = false;
  private intentionalClose = false;
  private dataHandlers: TransportDataHandler[] = [];
  private connectionHandlers: TransportConnectionHandler[] = [];
  private onlinePeers: NodeId[] = [];
  private peerAddrs = new Map<NodeId, PeerAddr>();
  private directSockets = new Map<NodeId, any>();
  private connectTimers = new Map<NodeId, ReturnType<typeof setTimeout>>();

  async init(): Promise<void> {
    this.myPeerId = this.getMyPeerId();
    this.intentionalClose = false;
    try { await this.connectToRelay(); } catch { this.startReconnectLoop(); }
  }

  getP2pPort(): number { return WIFI_TCP_PORT; }

  destroy(): void {
    this.intentionalClose = true;
    this.disconnectFromRelay();
    if (this.reconnectTimer) { clearInterval(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
    this.closeAllDirectSockets();
    this.dataHandlers = [];
    this.connectionHandlers = [];
  }

  async isAvailable(): Promise<boolean> {
    try { const state = await getNetInfo().fetch(); return !!(state.isConnected && state.isInternetReachable !== false); }
    catch { return false; }
  }

  async send(peerId: NodeId, data: string): Promise<void> {
    const direct = this.directSockets.get(peerId);
    if (direct) {
      try { await this.writeToTcpSocket(direct, data); return; } catch { this.closeDirectSocket(peerId); }
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error('WebSocket not connected');
    this.ws.send(JSON.stringify({ type: 'relay_send', targetPeerId: peerId, payload: data, senderId: this.myPeerId, timestamp: Date.now() }));
  }

  async broadcast(data: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'relay_broadcast', payload: data, senderId: this.myPeerId, timestamp: Date.now() }));
  }

  getConnectedPeers(): NodeId[] {
    const peers = new Set<NodeId>();
    for (const p of this.onlinePeers) if (p !== this.myPeerId) peers.add(p);
    for (const p of this.directSockets.keys()) if (p !== this.myPeerId) peers.add(p);
    return Array.from(peers);
  }
  isConnected(peerId: NodeId): boolean {
    return (this.connected && this.onlinePeers.includes(peerId)) || this.directSockets.has(peerId);
  }
  getSignalStrength(peerId: NodeId): number {
    if (this.directSockets.has(peerId)) return 90;
    return this.isConnected(peerId) ? 80 : -1;
  }

  isRelayConnected(): boolean { return this.connected && this.ws?.readyState === WebSocket.OPEN; }
  getOnlinePeerCount(): number { return this.onlinePeers.filter(p => p !== this.myPeerId).length; }
  getCurrentRelayUrl(): string { return getRelayUrl(); }

  async reconnect(): Promise<void> {
    this.intentionalClose = true;
    this.disconnectFromRelay();
    if (this.reconnectTimer) { clearInterval(this.reconnectTimer); this.reconnectTimer = null; }
    this.intentionalClose = false;
    await this.connectToRelay();
    if (!this.connected) this.startReconnectLoop();
  }

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
      this.ws = new WebSocket(getRelayUrl());

      await withTimeout(new Promise<void>((resolve, reject) => {
        const ws = this.ws!;
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new Error('WebSocket error'));
        ws.onclose = () => reject(new Error('WebSocket closed'));
      }), RELAY_CONNECT_TIMEOUT_MS, 'WebSocket connect');

      const ws = this.ws!;

      ws.onmessage = (event: WebSocketMessageEvent) => this.handleRelayMessage(event.data);
      ws.onerror = () => {};
      ws.onclose = () => {
        this.connected = false;
        this.stopPingLoop();
        for (const pid of this.onlinePeers) {
          if (pid !== this.myPeerId && !this.directSockets.has(pid)) this.notifyConnection(pid, false);
        }
        this.onlinePeers = [];
        if (!this.intentionalClose) this.startReconnectLoop();
      };

      ws.send(JSON.stringify({ type: 'relay_register', peerId: this.myPeerId, p2pPort: this.getP2pPort() }));
      this.connected = true;
      this.startPingLoop();
      if (this.reconnectTimer) { clearInterval(this.reconnectTimer); this.reconnectTimer = null; }
    } catch {
      this.ws?.close();
      this.ws = null;
    }
  }

  private disconnectFromRelay(): void {
    try { this.ws?.close(); } catch { /* ignore */ }
    this.ws = null;
    this.connected = false;
    this.onlinePeers = [];
    this.peerAddrs.clear();
  }

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
        case 'relay_peer_list': {
          const peerList: { peerId: string; addr?: PeerAddr }[] = msg.peers || [];
          this.onlinePeers = peerList.map(p => p.peerId);
          for (const p of peerList) {
            if (p.addr) { this.peerAddrs.set(p.peerId, p.addr); this.tryDirectConnect(p.peerId, p.addr); }
          }
          break;
        }
        case 'relay_peer_online':
          if (!this.onlinePeers.includes(msg.peerId)) {
            this.onlinePeers.push(msg.peerId);
            if (msg.addr) { this.peerAddrs.set(msg.peerId, msg.addr); this.tryDirectConnect(msg.peerId, msg.addr); }
            this.notifyConnection(msg.peerId, true);
          }
          break;
        case 'relay_peer_offline':
          this.onlinePeers = this.onlinePeers.filter(p => p !== msg.peerId);
          this.peerAddrs.delete(msg.peerId);
          if (!this.directSockets.has(msg.peerId)) {
            this.notifyConnection(msg.peerId, false);
          }
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

  private tryDirectConnect(peerId: NodeId, addr: PeerAddr): void {
    if (this.directSockets.has(peerId) || this.connectTimers.has(peerId)) return;
    if (addr.ip === '127.0.0.1' || addr.ip === '::1' || addr.ip === '0.0.0.0') return;
    const timer = setTimeout(() => {
      this.connectTimers.delete(peerId);
    }, DIRECT_TCP_TIMEOUT_MS);
    this.connectTimers.set(peerId, timer);
    try {
      const client = getTcpSocket().createConnection({ host: addr.ip, port: addr.tcpPort }, () => {
        if (timer) clearTimeout(timer);
        this.connectTimers.delete(peerId);
        this.directSockets.set(peerId, client);
        this.setupDirectSocket(client, peerId);
        this.notifyConnection(peerId, true);
      });
      client.on('error', () => {
        if (timer) clearTimeout(timer);
        this.connectTimers.delete(peerId);
        this.closeDirectSocket(peerId);
      });
      client.on('close', () => {
        this.connectTimers.delete(peerId);
        this.closeDirectSocket(peerId);
      });
    } catch {
      if (timer) clearTimeout(timer);
      this.connectTimers.delete(peerId);
    }
  }

  private setupDirectSocket(client: any, peerId: NodeId): void {
    let recvBuf = Buffer.alloc(0);
    client.on('data', (chunk: Buffer) => {
      recvBuf = Buffer.concat([recvBuf, chunk]);
      let offset = 0;
      while (offset + 4 <= recvBuf.length) {
        const msgLen = recvBuf.readUInt32BE(offset);
        const totalLen = 4 + msgLen;
        if (offset + totalLen > recvBuf.length) break;
        const data = recvBuf.subarray(offset + 4, offset + totalLen).toString('utf-8');
        for (const handler of this.dataHandlers) { try { handler(data, peerId); } catch { /* ignore */ } }
        offset += totalLen;
      }
      recvBuf = offset > 0 ? recvBuf.subarray(offset) : recvBuf;
    });
    client.on('error', () => this.closeDirectSocket(peerId));
    client.on('close', () => this.closeDirectSocket(peerId));
  }

  private async writeToTcpSocket(socket: any, data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const payload = Buffer.from(data, 'utf-8');
        const header = Buffer.alloc(4);
        header.writeUInt32BE(payload.length, 0);
        socket.write(Buffer.concat([header, payload]), (err?: Error | null) => { err ? reject(err) : resolve(); });
      } catch (err) { reject(err); }
    });
  }

  private closeDirectSocket(peerId: NodeId): void {
    const sock = this.directSockets.get(peerId);
    if (sock) { try { sock.destroy(); } catch { /* ignore */ } this.directSockets.delete(peerId); }
    const timer = this.connectTimers.get(peerId);
    if (timer) { clearTimeout(timer); this.connectTimers.delete(peerId); }
  }

  private closeAllDirectSockets(): void {
    for (const peerId of this.directSockets.keys()) this.closeDirectSocket(peerId);
    for (const [peerId, timer] of this.connectTimers) { clearTimeout(timer); this.connectTimers.delete(peerId); }
  }

  private getMyPeerId(): NodeId {
    try { return getNodeId() || 'unknown'; }
    catch { return 'unknown'; }
  }
}

export const GsmTransport = new GsmTransportImpl();
