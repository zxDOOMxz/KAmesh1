import { MMKV } from 'react-native-mmkv';
import { ChatMessage, KeySession, MeshPacket, RouteEntry } from '../types';
import { CACHE_CLEANUP_INTERVAL_MS, PENDING_MESSAGE_TTL_MS, ROUTE_TABLE_MAX_SIZE } from '../constants';

const storage = new MMKV({
  id: 'kamesh-storage',
  encryptionKey: 'kamesh-offline-mesh-v1',
});

const KEYS = {
  NODE_ID: 'node_id',
  KEY_BUNDLE: 'key_bundle',
  ROUTE_TABLE: 'route_table',
  PENDING_MESSAGES: 'pending_messages',
  DTN_BUNDLES: 'dtn_bundles',
  CHAT_MESSAGES_PREFIX: 'chat_msgs_',
  KEY_SESSIONS: 'key_sessions',
  LAST_CLEANUP: 'last_cleanup',
} as const;

export function getNodeId(): string | null {
  try { return storage.getString(KEYS.NODE_ID) ?? null; }
  catch { return null; }
}

export function setNodeId(id: string): void {
  try { storage.set(KEYS.NODE_ID, id); }
  catch { /* ignore */ }
}

export function getRouteTable(): RouteEntry[] {
  try {
    const raw = storage.getString(KEYS.ROUTE_TABLE);
    if (!raw) return [];
    const entries: RouteEntry[] = JSON.parse(raw);
    return entries.filter(e => Date.now() - e.lastSeen < PENDING_MESSAGE_TTL_MS);
  } catch { return []; }
}

export function saveRouteTable(entries: RouteEntry[]): void {
  try {
    const sorted = entries.sort((a, b) => b.rssi - a.rssi).slice(0, ROUTE_TABLE_MAX_SIZE);
    storage.set(KEYS.ROUTE_TABLE, JSON.stringify(sorted));
  } catch { /* ignore */ }
}

export function getPendingMessages(): MeshPacket[] {
  try {
    const raw = storage.getString(KEYS.PENDING_MESSAGES);
    if (!raw) return [];
    const msgs: MeshPacket[] = JSON.parse(raw);
    const now = Date.now();
    return msgs.filter(m => now - m.timestamp < PENDING_MESSAGE_TTL_MS);
  } catch { return []; }
}

export function savePendingMessages(msgs: MeshPacket[]): void {
  try { storage.set(KEYS.PENDING_MESSAGES, JSON.stringify(msgs)); }
  catch { /* ignore */ }
}

export function addPendingMessage(msg: MeshPacket): void {
  try {
    const pending = getPendingMessages();
    pending.push(msg);
    savePendingMessages(pending);
  } catch { /* ignore */ }
}

export function removePendingMessage(packetId: string): void {
  try {
    const pending = getPendingMessages();
    savePendingMessages(pending.filter(m => m.packetId !== packetId));
  } catch { /* ignore */ }
}

export function getRelayPackets(): MeshPacket[] {
  try {
    const raw = storage.getString(KEYS.DTN_BUNDLES);
    if (!raw) return [];
    const pkts: MeshPacket[] = JSON.parse(raw);
    const now = Date.now();
    return pkts.filter(p => now - p.timestamp < PENDING_MESSAGE_TTL_MS);
  } catch { return []; }
}

export function saveRelayPackets(pkts: MeshPacket[]): void {
  try { storage.set(KEYS.DTN_BUNDLES, JSON.stringify(pkts)); }
  catch { /* ignore */ }
}

export function addRelayPacket(packet: MeshPacket): void {
  try {
    const existing = getRelayPackets();
    if (existing.some(p => p.packetId === packet.packetId)) return;
    existing.push(packet);
    saveRelayPackets(existing);
  } catch { /* ignore */ }
}

export function removeRelayPacket(packetId: string): void {
  try {
    const existing = getRelayPackets();
    saveRelayPackets(existing.filter(p => p.packetId !== packetId));
  } catch { /* ignore */ }
}

export function getJson<T>(key: string): T | null {
  try {
    const raw = storage.getString(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch { return null; }
}

export function setJson(key: string, value: unknown): void {
  try { storage.set(key, JSON.stringify(value)); }
  catch { /* ignore */ }
}

export function deleteKey(key: string): void {
  try { storage.delete(key); }
  catch { /* ignore */ }
}

export function containsKey(key: string): boolean {
  try { return storage.contains(key); }
  catch { return false; }
}

export function getChatMessages(chatId: string): ChatMessage[] {
  try {
    const raw = storage.getString(`${KEYS.CHAT_MESSAGES_PREFIX}${chatId}`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

export function saveChatMessages(chatId: string, msgs: ChatMessage[]): void {
  try { storage.set(`${KEYS.CHAT_MESSAGES_PREFIX}${chatId}`, JSON.stringify(msgs)); }
  catch { /* ignore */ }
}

export function addChatMessage(chatId: string, msg: ChatMessage): void {
  try {
    const msgs = getChatMessages(chatId);
    msgs.push(msg);
    saveChatMessages(chatId, msgs);
  } catch { /* ignore */ }
}

export function updateChatMessageStatus(chatId: string, messageId: string, status: ChatMessage['status']): void {
  try {
    const msgs = getChatMessages(chatId);
    const idx = msgs.findIndex(m => m.id === messageId);
    if (idx !== -1) {
      msgs[idx].status = status;
      saveChatMessages(chatId, msgs);
    }
  } catch { /* ignore */ }
}

export function getKeySessions(): Record<string, KeySession> {
  try {
    const raw = storage.getString(KEYS.KEY_SESSIONS);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch { return {}; }
}

export function saveKeySession(peerId: string, session: KeySession): void {
  try {
    const sessions = getKeySessions();
    sessions[peerId] = session;
    storage.set(KEYS.KEY_SESSIONS, JSON.stringify(sessions));
  } catch { /* ignore */ }
}

export function removeKeySession(peerId: string): void {
  try {
    const sessions = getKeySessions();
    delete sessions[peerId];
    storage.set(KEYS.KEY_SESSIONS, JSON.stringify(sessions));
  } catch { /* ignore */ }
}

export function getKeyBundle(): string | null {
  try { return storage.getString(KEYS.KEY_BUNDLE) ?? null; }
  catch { return null; }
}

export function setKeyBundle(bundleJson: string): void {
  try { storage.set(KEYS.KEY_BUNDLE, bundleJson); }
  catch { /* ignore */ }
}

export function performCacheCleanupIfNeeded(): void {
  try {
    const lastCleanup = storage.getNumber(KEYS.LAST_CLEANUP) ?? 0;
    const now = Date.now();
    if (now - lastCleanup < CACHE_CLEANUP_INTERVAL_MS) return;
    const pending = getPendingMessages();
    savePendingMessages(pending);
    const routes = getRouteTable();
    saveRouteTable(routes);
    storage.set(KEYS.LAST_CLEANUP, now);
  } catch { /* ignore */ }
}
