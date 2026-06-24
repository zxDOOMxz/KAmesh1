import TcpSocket from 'react-native-tcp-socket';
import UdpSockets from 'react-native-udp';
import type { ITransport, TransportDataHandler, TransportConnectionHandler } from './ITransport';
import type { NodeId } from '../../types';
import { getNodeId } from '../StorageService';
import { WIFI_TCP_CONNECT_TIMEOUT_MS } from '../../constants';

const TCP_PORT = 4404;
const UDP_PORT = 4405;
const UDP_BROADCAST_ADDR = '255.255.255.255';
const DISCOVERY_INTERVAL_MS = 10_000;
const RECONNECT_INTERVAL_MS = 30_000;

interface DiscoveryPacket {
  type: 'sofilink_wifi_discovery';
  peerId: NodeId;
  tcpPort: number;
  timestamp: number;
}

class WifiTransportImpl implements ITransport {
  readonly name = 'wifi';
  readonly priority = 1;

  private server: TcpSocket.Server | null = null;
  private udpSocket: any = null;
  private clients = new Map<NodeId, any>();
  private pendingConnections = new Set<string>();
  private myPeerId: NodeId = '';
  private discoveryTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setInterval> | null = null;
  private recvBuffers = new Map<any, Buffer>();
  private dataHandlers: TransportDataHandler[] = [];
  private connectionHandlers: TransportConnectionHandler[] = [];
  private knownPeers = new Map<NodeId, { host: string; port: number; lastSeen: number }>();

  async init(): Promise<void> {
    this.myPeerId = this.getMyPeerId();
    this.startTcpServer();
    this.startUdpDiscovery();
    this.startBroadcastLoop();
    this.startReconnectLoop();
  }

  destroy(): void {
    if (this.discoveryTimer) { clearInterval(this.discoveryTimer); this.discoveryTimer = null; }
    if (this.reconnectTimer) { clearInterval(this.reconnectTimer); this.reconnectTimer = null; }
    this.stopUdpSocket();
    this.stopTcpServer();
    this.closeAllClients();
    this.dataHandlers = [];
    this.connectionHandlers = [];
    this.knownPeers.clear();
  }

  async isAvailable(): Promise<boolean> { return this.server !== null; }

  async send(peerId: NodeId, data: string): Promise<void> {
    const client = this.clients.get(peerId);
    if (!client) throw new Error(`No TCP connection to ${peerId}`);
    await this.writeToSocket(client, data);
  }

  async broadcast(data: string): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const [peerId, client] of this.clients) {
      promises.push(this.writeToSocket(client, data).catch(() => {
        this.clients.delete(peerId);
        this.notifyConnection(peerId, false);
      }));
    }
    await Promise.all(promises);
  }

  getConnectedPeers(): NodeId[] { return Array.from(this.clients.keys()); }
  isConnected(peerId: NodeId): boolean { return this.clients.has(peerId); }
  getSignalStrength(peerId: NodeId): number { return this.clients.has(peerId) ? 50 : -1; }

  onData(handler: TransportDataHandler): () => void {
    this.dataHandlers.push(handler);
    return () => { this.dataHandlers = this.dataHandlers.filter(h => h !== handler); };
  }

  onConnection(handler: TransportConnectionHandler): () => void {
    this.connectionHandlers.push(handler);
    return () => { this.connectionHandlers = this.connectionHandlers.filter(h => h !== handler); };
  }

  private startTcpServer(): void {
    try {
      this.server = TcpSocket.createServer((client) => {
        client.on('data', (rawData: string | Buffer) => {
          const chunk = typeof rawData === 'string' ? Buffer.from(rawData, 'utf-8') : rawData;
          this.onSocketData(client, chunk);
        });
        client.on('close', () => { this.removeClientBySocket(client); });
        client.on('error', () => { this.removeClientBySocket(client); });
      });
      this.server.listen({ port: TCP_PORT, host: '0.0.0.0' });
    } catch { /* ignore */ }
  }

  private stopTcpServer(): void { try { this.server?.close(); } catch { /* ignore */ } this.server = null; }

  private startUdpDiscovery(): void {
    try {
      this.udpSocket = UdpSockets.createSocket({ type: 'udp4' });
      this.udpSocket.on('message', (rawData: Buffer, rinfo: { address: string }) => {
        try {
          const packet: DiscoveryPacket = JSON.parse(rawData.toString());
          if (packet.type !== 'sofilink_wifi_discovery' || packet.peerId === this.myPeerId) return;
          if (!this.knownPeers.has(packet.peerId)) {
            this.knownPeers.set(packet.peerId, { host: rinfo.address, port: packet.tcpPort, lastSeen: Date.now() });
            this.connectToPeer(packet.peerId, rinfo.address, packet.tcpPort);
          }
        } catch { /* ignore */ }
      });
      this.udpSocket.bind(UDP_PORT);
    } catch { /* ignore */ }
  }

  private stopUdpSocket(): void { try { this.udpSocket?.close(); } catch { /* ignore */ } this.udpSocket = null; }

  private startBroadcastLoop(): void {
    if (this.discoveryTimer) return;
    this.discoveryTimer = setInterval(() => this.broadcastDiscovery(), DISCOVERY_INTERVAL_MS);
  }

  private broadcastDiscovery(): void {
    if (!this.udpSocket) return;
    const packet: DiscoveryPacket = { type: 'sofilink_wifi_discovery', peerId: this.myPeerId, tcpPort: TCP_PORT, timestamp: Date.now() };
    const message = Buffer.from(JSON.stringify(packet));
    this.udpSocket.send(message, 0, message.length, UDP_PORT, UDP_BROADCAST_ADDR, () => {});
  }

  private connectToPeer(peerId: NodeId, host: string, port: number): void {
    if (this.clients.has(peerId)) return;
    const connKey = `${peerId}@${host}:${port}`;
    if (this.pendingConnections.has(connKey)) return;
    this.pendingConnections.add(connKey);

    try {
      const client = TcpSocket.createConnection({ host, port }, () => {
        this.pendingConnections.delete(connKey);
        this.clients.set(peerId, client);
        this.notifyConnection(peerId, true);
      });
      const connectTimer = setTimeout(() => {
        client.destroy();
        this.pendingConnections.delete(connKey);
      }, WIFI_TCP_CONNECT_TIMEOUT_MS);

      client.on('data', (rawData: string | Buffer) => {
        this.onSocketData(client, typeof rawData === 'string' ? Buffer.from(rawData, 'utf-8') : rawData);
      });
      client.on('close', () => {
        clearTimeout(connectTimer);
        this.pendingConnections.delete(connKey);
        if (this.clients.get(peerId) === client) { this.clients.delete(peerId); this.notifyConnection(peerId, false); }
      });
      client.on('error', () => {
        clearTimeout(connectTimer);
        this.pendingConnections.delete(connKey);
        if (this.clients.get(peerId) === client) { this.clients.delete(peerId); this.notifyConnection(peerId, false); }
      });
    } catch { this.pendingConnections.delete(connKey); }
  }

  private startReconnectLoop(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setInterval(() => {
      const now = Date.now();
      for (const [peerId, info] of this.knownPeers) {
        if ((now - info.lastSeen) > 120_000) { this.knownPeers.delete(peerId); continue; }
        if (!this.clients.has(peerId)) {
          this.connectToPeer(peerId, info.host, info.port);
        }
      }
    }, RECONNECT_INTERVAL_MS);
  }

  private onSocketData(socket: any, chunk: Buffer): void {
    try {
      if (!this.recvBuffers.has(socket)) this.recvBuffers.set(socket, Buffer.alloc(0));
      this.recvBuffers.set(socket, Buffer.concat([this.recvBuffers.get(socket)!, chunk]));

      const peerId = this.findPeerIdBySocket(socket);
      if (!peerId) return;

      const buf = this.recvBuffers.get(socket)!;
      let offset = 0;
      while (offset + 4 <= buf.length) {
        const msgLen = buf.readUInt32BE(offset);
        const totalLen = 4 + msgLen;
        if (offset + totalLen > buf.length) break;
        const data = buf.subarray(offset + 4, offset + totalLen).toString('utf-8');
        for (const handler of this.dataHandlers) { try { handler(data, peerId); } catch { /* ignore */ } }
        offset += totalLen;
      }
      if (offset > 0) this.recvBuffers.set(socket, buf.subarray(offset));
    } catch { /* ignore */ }
  }

  private async writeToSocket(socket: any, data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const payload = Buffer.from(data, 'utf-8');
        const header = Buffer.alloc(4);
        header.writeUInt32BE(payload.length, 0);
        socket.write(Buffer.concat([header, payload]), (err?: Error | null) => { err ? reject(err) : resolve(); });
      } catch (err) { reject(err); }
    });
  }

  private findPeerIdBySocket(socket: any): NodeId | null {
    for (const [peerId, s] of this.clients) { if (s === socket) return peerId; }
    return null;
  }

  private removeClientBySocket(socket: any): void {
    this.recvBuffers.delete(socket);
    for (const [peerId, s] of this.clients) {
      if (s === socket) { this.clients.delete(peerId); this.notifyConnection(peerId, false); try { socket.destroy(); } catch { /* ignore */ } return; }
    }
  }

  private closeAllClients(): void {
    for (const [peerId, client] of this.clients) { try { client.destroy(); } catch { /* ignore */ } this.notifyConnection(peerId, false); }
    this.clients.clear();
  }

  private notifyConnection(peerId: NodeId, connected: boolean): void {
    for (const handler of this.connectionHandlers) { try { handler(peerId, connected); } catch { /* ignore */ } }
  }

  private getMyPeerId(): NodeId {
    try { return getNodeId() || 'unknown'; }
    catch { return 'unknown'; }
  }
}

export const WifiTransport = new WifiTransportImpl();
