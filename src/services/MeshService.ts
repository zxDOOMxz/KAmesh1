import uuidv4 from 'react-native-uuid';
import { MeshPacket, MessageType, NodeId, RouteEntry } from '../types';
import { MESH_TTL_MAX, ROUTE_TABLE_MAX_SIZE, PING_INTERVAL_MS, DTN_CHECK_INTERVAL_MS } from '../constants';
import { TransportManager } from './TransportManager';
import { addPendingMessage, addRelayPacket, getNodeId, getPendingMessages, getRelayPackets, getRouteTable, removePendingMessage, removeRelayPacket, saveRouteTable } from './StorageService';
import { encryptPacket, decryptPacket } from './CryptoService';

type PacketHandler = (packet: MeshPacket, relayId: NodeId) => void;
const processedPackets = new Set<string>();
const MAX_PROCESSED_PACKETS = 10_000;

function isDtnEligible(type: MessageType): boolean {
  return type === MessageType.TEXT || type === MessageType.VOICE_MAIL || type === MessageType.VOICE_MAIL_CHUNK || type === MessageType.UPDATE_MANIFEST;
}

function isDirectOnly(type: MessageType): boolean {
  return type === MessageType.UPDATE_CHUNK_REQUEST || type === MessageType.UPDATE_CHUNK;
}

function isControlPacket(type: MessageType): boolean {
  return type === MessageType.PING || type === MessageType.PONG || type === MessageType.DELIVERY_ACK ||
    type === MessageType.KEY_EXCHANGE || type === MessageType.UPDATE_MANIFEST ||
    type === MessageType.NICKNAME_REGISTER || type === MessageType.NICKNAME_ACCEPT ||
    type === MessageType.NICKNAME_REJECT || type === MessageType.NICKNAME_ANNOUNCE ||
    type === MessageType.NICKNAME_QUERY || type === MessageType.NICKNAME_LIST ||
    type === MessageType.CONFERENCE_CREATE || type === MessageType.CONFERENCE_LEAVE ||
    type === MessageType.CONFERENCE_AUDIO;
}

class MeshServiceClass {
  private initialized = false;
  private packetHandlers: PacketHandler[] = [];
  private routeTable: RouteEntry[] = [];
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private dtnTimer: ReturnType<typeof setInterval> | null = null;
  private pendingProcessTimer: ReturnType<typeof setInterval> | null = null;
  private processedCleanupTimers: Set<ReturnType<typeof setTimeout>> = new Set();
  private myNodeId: NodeId = '';

  async initialize(): Promise<void> {
    if (this.initialized) return;
    const nodeId = getNodeId();
    if (!nodeId) throw new Error('Node ID not set');
    this.myNodeId = nodeId;
    this.routeTable = getRouteTable();

    try { await TransportManager.initialize(); } catch { /* ignore */ }
    TransportManager.onData(this.handleIncomingPacket.bind(this));
    TransportManager.onConnection((peerId, connected) => {
      if (connected) {
        const signal = TransportManager.getSignalStrength(peerId);
        this.addOrUpdateRoute(peerId, peerId, signal, 1);
        this.flushDtnToNeighbor(peerId);
      }
    });

    this.startPingLoop();
    this.processPendingQueue();
    this.startDtnProcessingLoop();
    this.pendingProcessTimer = setInterval(() => this.processPendingQueue(), 60_000);
    this.initialized = true;
  }

  async sendMessage(type: MessageType, payload: string, targetId: NodeId, options?: { fragmentIndex?: number; fragmentTotal?: number; fragmentSessionId?: string }): Promise<MeshPacket> {
    const packet: MeshPacket = {
      packetId: uuidv4.v4(), type, sourceId: this.myNodeId, targetId, relayId: this.myNodeId,
      ttl: MESH_TTL_MAX, payload, timestamp: Date.now(),
      isBroadcast: targetId === 'broadcast', ...options,
    };

    const encryptedPacket = isControlPacket(type) ? packet : await encryptPacket(packet);
    const route = this.routeTable.find(r => r.nodeId === targetId);
    if (route && TransportManager.isConnected(route.nextHop)) {
      await TransportManager.send(route.nextHop, JSON.stringify(encryptedPacket));
      return encryptedPacket;
    }

    const connectedPeers = TransportManager.getConnectedPeers();
    const packetJson = JSON.stringify(encryptedPacket);
    for (const devId of connectedPeers) {
      if (devId === this.myNodeId) continue;
      try { await TransportManager.send(devId, packetJson); } catch { /* ignore */ }
    }

    const isTargetDirectlyConnected = connectedPeers.some(d => d === targetId);
    if (!isTargetDirectlyConnected && !packet.isBroadcast && isDtnEligible(type)) {
      addPendingMessage(encryptedPacket);
    }
    return encryptedPacket;
  }

  private async handleIncomingPacket(data: string, relayId: NodeId): Promise<void> {
    try {
      let packet: MeshPacket;
      try { packet = JSON.parse(data); } catch { return; }
      if (!packet.packetId || !packet.sourceId) return;
      if (typeof packet.ttl !== 'number' || packet.ttl < 1) return;
      if (processedPackets.has(packet.packetId)) return;
      if (processedPackets.size >= MAX_PROCESSED_PACKETS) processedPackets.clear();
      processedPackets.add(packet.packetId);
      const cleanupTimer = setTimeout(() => { processedPackets.delete(packet.packetId); this.processedCleanupTimers.delete(cleanupTimer); }, 60_000);
      this.processedCleanupTimers.add(cleanupTimer);

      packet.ttl -= 1;
      packet.relayId = this.myNodeId;
      const signal = TransportManager.getSignalStrength(relayId);
      this.addOrUpdateRoute(packet.sourceId, relayId, signal, MESH_TTL_MAX - packet.ttl);

      if (packet.type === MessageType.DELIVERY_ACK) {
        removeRelayPacket(packet.payload);
        if (packet.ttl > 0) await this.relayPacket(packet, relayId);
        return;
      }

      const isForMe = packet.targetId === this.myNodeId || (packet.isBroadcast ?? false);
      if (isForMe) {
        const decrypted = await decryptPacket(packet, this.myNodeId);
        this.notifyPacketHandlers(decrypted, relayId);
        if (isDtnEligible(packet.type) && packet.targetId === this.myNodeId) {
          await this.sendAck(packet.packetId, packet.sourceId);
        }
      }

      if (packet.targetId !== this.myNodeId && isDtnEligible(packet.type)) {
        addRelayPacket({ ...packet, relayId: this.myNodeId });
      }

      if (packet.ttl > 0 && !isDirectOnly(packet.type) && (packet.isBroadcast || packet.targetId !== this.myNodeId)) {
        await this.relayPacket(packet, relayId);
      }
    } catch { /* ignore */ }
  }

  private async sendAck(packetId: string, targetSourceId: NodeId): Promise<void> {
    const ackPacket: MeshPacket = {
      packetId: uuidv4.v4(), type: MessageType.DELIVERY_ACK, sourceId: this.myNodeId,
      targetId: targetSourceId, relayId: this.myNodeId, ttl: MESH_TTL_MAX,
      payload: packetId, timestamp: Date.now(), isBroadcast: false,
    };
    const ackJson = JSON.stringify(ackPacket);
    for (const devId of TransportManager.getConnectedPeers()) {
      if (devId === this.myNodeId) continue;
      try { await TransportManager.send(devId, ackJson); } catch { /* ignore */ }
    }
  }

  private async relayPacket(packet: MeshPacket, excludeRelayId: NodeId): Promise<void> {
    const connectedPeers = TransportManager.getConnectedPeers();
    const packetJson = JSON.stringify(packet);
    for (const devId of connectedPeers) {
      if (devId === excludeRelayId || devId === this.myNodeId || devId === packet.sourceId) continue;
      try { await TransportManager.send(devId, packetJson); } catch { /* ignore */ }
    }
  }

  private async flushDtnToNeighbor(neighborId: NodeId): Promise<void> {
    const bundles = getRelayPackets();
    if (bundles.length === 0) return;
    const targetRoute = this.routeTable.find(r => r.nodeId === neighborId);
    const neighborKnowsTarget = targetRoute && targetRoute.hops < MESH_TTL_MAX;
    for (const bundle of bundles) {
      if (bundle.sourceId === neighborId) continue;
      if (bundle.targetId === neighborId || neighborKnowsTarget) {
        try { await TransportManager.send(neighborId, JSON.stringify({ ...bundle, relayId: this.myNodeId })); } catch { /* ignore */ }
      }
    }
  }

  private startDtnProcessingLoop(): void {
    if (this.dtnTimer) return;
    this.dtnTimer = setInterval(async () => {
      const bundles = getRelayPackets();
      if (bundles.length === 0) return;
      const connectedPeers = TransportManager.getConnectedPeers();
      const now = Date.now();
      for (const bundle of bundles) {
        if (now - bundle.timestamp > DTN_CHECK_INTERVAL_MS * 72) { removeRelayPacket(bundle.packetId); continue; }
        const routeToTarget = this.routeTable.find(r => r.nodeId === bundle.targetId);
        if (routeToTarget) {
          const freshened = { ...bundle, relayId: this.myNodeId };
          const pktJson = JSON.stringify(freshened);
          for (const devId of connectedPeers) {
            if (devId === this.myNodeId || devId === bundle.sourceId) continue;
            try { await TransportManager.send(devId, pktJson); } catch { /* ignore */ }
          }
        }
      }
    }, DTN_CHECK_INTERVAL_MS);
  }

  private addOrUpdateRoute(nodeId: NodeId, nextHop: NodeId, rssi: number, hops: number): void {
    const existingIdx = this.routeTable.findIndex(r => r.nodeId === nodeId);
    const now = Date.now();
    if (existingIdx !== -1) {
      const existing = this.routeTable[existingIdx];
      if (hops <= existing.hops || rssi > existing.rssi) {
        this.routeTable[existingIdx] = { ...existing, nextHop, rssi, lastSeen: now, hops };
      } else { this.routeTable[existingIdx].lastSeen = now; }
    } else {
      if (this.routeTable.length >= ROUTE_TABLE_MAX_SIZE) {
        this.routeTable.sort((a, b) => a.lastSeen - b.lastSeen);
        this.routeTable.shift();
      }
      this.routeTable.push({ nodeId, nextHop, rssi, lastSeen: now, hops, createdAt: now });
    }
    saveRouteTable(this.routeTable);
  }

  getRouteTable(): RouteEntry[] { return [...this.routeTable]; }

  private startPingLoop(): void {
    if (this.pingTimer) return;
    this.pingTimer = setInterval(async () => {
      const ping: MeshPacket = {
        packetId: uuidv4.v4(), type: MessageType.PING, sourceId: this.myNodeId,
        targetId: 'broadcast', relayId: this.myNodeId, ttl: MESH_TTL_MAX,
        payload: '', timestamp: Date.now(), isBroadcast: true,
      };
      const pingJson = JSON.stringify(ping);
      for (const devId of TransportManager.getConnectedPeers()) {
        if (devId === this.myNodeId) continue;
        try { await TransportManager.send(devId, pingJson); } catch { /* ignore */ }
      }
    }, PING_INTERVAL_MS);
  }

  async processPendingQueue(): Promise<void> {
    const pending = getPendingMessages();
    if (pending.length === 0) return;
    const connectedPeers = TransportManager.getConnectedPeers();
    const now = Date.now();
    for (const msg of pending) {
      if (now - msg.timestamp > 72 * 60 * 60 * 1000) { removePendingMessage(msg.packetId); continue; }
      if (connectedPeers.includes(msg.targetId) || this.routeTable.some(r => r.nodeId === msg.targetId)) {
        try {
          const packetJson = JSON.stringify(msg);
          for (const devId of connectedPeers) {
            if (devId === this.myNodeId) continue;
            try { await TransportManager.send(devId, packetJson); } catch { /* ignore */ }
          }
          removePendingMessage(msg.packetId);
        } catch { /* ignore */ }
      }
    }
  }

  onPacket(handler: PacketHandler): () => void {
    this.packetHandlers.push(handler);
    return () => { this.packetHandlers = this.packetHandlers.filter(h => h !== handler); };
  }

  private notifyPacketHandlers(packet: MeshPacket, relayId: NodeId): void {
    for (const handler of this.packetHandlers) { try { handler(packet, relayId); } catch { /* ignore */ } }
  }

  isInitialized(): boolean { return this.initialized; }

  destroy(): void {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
    if (this.dtnTimer) { clearInterval(this.dtnTimer); this.dtnTimer = null; }
    if (this.pendingProcessTimer) { clearInterval(this.pendingProcessTimer); this.pendingProcessTimer = null; }
    for (const t of this.processedCleanupTimers) clearTimeout(t);
    this.processedCleanupTimers.clear();
    this.initialized = false;
    this.routeTable = [];
    this.packetHandlers = [];
    processedPackets.clear();
  }
}

export const MeshService = new MeshServiceClass();
