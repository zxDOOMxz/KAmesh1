import { MeshService } from './MeshService';
import { getJson, setJson, deleteKey, containsKey, getNodeId } from './StorageService';
import { MessageType, NodeId, ContactEntry, NicknameRegistration, NicknameResponse, NicknameQuery, NicknameList, MeshPacket } from '../types';
import { NICKNAME_KEY, NICKNAME_REGISTER_TIMEOUT_MS, NICKNAME_ANNOUNCE_INTERVAL_MS, CONTACT_OFFLINE_TIMEOUT_MS, RESERVED_NICKNAMES, DOOM_NICKNAME, DOOM_NICKNAME_PASSWORD } from '../constants';

type ContactsChangeHandler = () => void;

class ContactServiceClass {
  private initialized = false;
  private myNodeId: NodeId = '';
  private contacts: ContactEntry[] = [];
  private announceTimer: ReturnType<typeof setInterval> | null = null;
  private changeHandlers: ContactsChangeHandler[] = [];

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.myNodeId = getNodeId() || '';
    this.loadContacts();
    MeshService.onPacket(this.handlePacket.bind(this));
    this.startAnnounceLoop();
    this.initialized = true;
  }

  destroy(): void {
    if (this.announceTimer) { clearInterval(this.announceTimer); this.announceTimer = null; }
    this.contacts = [];
    this.changeHandlers = [];
  }

  getMyNickname(): string | null { return getJson<string>(NICKNAME_KEY); }
  hasNickname(): boolean { return containsKey(NICKNAME_KEY); }

  async registerNickname(nickname: string): Promise<boolean> {
    const trimmed = nickname.trim();
    if (!trimmed || trimmed.length < 2 || trimmed.length > 20) return false;
    if (this.hasNickname()) return false;
    if (this.contacts.some(c => c.nickname.toLowerCase() === trimmed.toLowerCase())) return false;
    const lowerNick = trimmed.toLowerCase();
    if (RESERVED_NICKNAMES.includes(lowerNick)) return false;
    let password: string | undefined;
    if (lowerNick === DOOM_NICKNAME) password = DOOM_NICKNAME_PASSWORD;

    const registration: NicknameRegistration = { nickname: trimmed, nodeId: this.myNodeId, timestamp: Date.now(), password };
    let rejected = false;
    const unsub = MeshService.onPacket((packet: MeshPacket) => {
      if (packet.type === MessageType.NICKNAME_REJECT) {
        try { const resp: NicknameResponse = JSON.parse(packet.payload); if (resp.nickname.toLowerCase() === trimmed.toLowerCase()) rejected = true; } catch { /* ignore */ }
      }
    });
    await MeshService.sendMessage(MessageType.NICKNAME_REGISTER, JSON.stringify(registration), 'broadcast');
    await new Promise(resolve => setTimeout(resolve, NICKNAME_REGISTER_TIMEOUT_MS));
    unsub();
    if (rejected) return false;
    setJson(NICKNAME_KEY, trimmed);
    return true;
  }

  getContacts(): ContactEntry[] { this.updateOnlineStatus(); return [...this.contacts]; }
  getOnlineContacts(): ContactEntry[] { this.updateOnlineStatus(); return this.contacts.filter(c => c.isOnline && c.nickname !== this.getMyNickname()); }
  getByNickname(nickname: string): ContactEntry | null { return this.contacts.find(c => c.nickname.toLowerCase() === nickname.toLowerCase()) || null; }
  resolveNickname(nickname: string): NodeId | null { const contact = this.getByNickname(nickname); return contact ? contact.nodeId : null; }

  async queryNicknames(): Promise<void> {
    await MeshService.sendMessage(MessageType.NICKNAME_QUERY, JSON.stringify({ requesterId: this.myNodeId, timestamp: Date.now() } as NicknameQuery), 'broadcast');
  }

  onChange(handler: ContactsChangeHandler): () => void {
    this.changeHandlers.push(handler);
    return () => { this.changeHandlers = this.changeHandlers.filter(h => h !== handler); };
  }

  private async handlePacket(packet: MeshPacket): Promise<void> {
    switch (packet.type) {
      case MessageType.NICKNAME_REGISTER: await this.handleRegistration(packet); break;
      case MessageType.NICKNAME_ANNOUNCE: await this.handleAnnounce(packet); break;
      case MessageType.NICKNAME_QUERY: await this.handleQuery(packet); break;
      case MessageType.NICKNAME_LIST: await this.handleNicknameList(packet); break;
    }
  }

  private async handleRegistration(packet: MeshPacket): Promise<void> {
    try {
      const reg: NicknameRegistration = JSON.parse(packet.payload);
      if (reg.nodeId === this.myNodeId) return;
      const lowerNick = reg.nickname.toLowerCase();
      if (RESERVED_NICKNAMES.includes(lowerNick)) { this.sendReject(reg); return; }
      if (lowerNick === DOOM_NICKNAME && reg.password !== DOOM_NICKNAME_PASSWORD) { this.sendReject(reg); return; }
      const alreadyTaken = this.contacts.some(c => c.nickname.toLowerCase() === lowerNick && c.nodeId !== reg.nodeId);
      const selfNickname = this.getMyNickname();
      const selfTaken = selfNickname && selfNickname.toLowerCase() === lowerNick;
      if (alreadyTaken || selfTaken) {
        await MeshService.sendMessage(MessageType.NICKNAME_REJECT, JSON.stringify({ nickname: reg.nickname, nodeId: reg.nodeId, accepted: false, reason: 'Nickname already taken', timestamp: Date.now() } as NicknameResponse), reg.nodeId);
        return;
      }
      this.addOrUpdateContact(reg.nickname, reg.nodeId);
    } catch { /* ignore */ }
  }

  private async handleAnnounce(packet: MeshPacket): Promise<void> {
    try {
      const reg: NicknameRegistration = JSON.parse(packet.payload);
      if (reg.nodeId === this.myNodeId) return;
      this.addOrUpdateContact(reg.nickname, reg.nodeId);
    } catch { /* ignore */ }
  }

  private async handleQuery(packet: MeshPacket): Promise<void> {
    try {
      const query: NicknameQuery = JSON.parse(packet.payload);
      if (query.requesterId === this.myNodeId) return;
      this.updateOnlineStatus();
      const myNickname = this.getMyNickname();
      const list: NicknameList = {
        entries: this.contacts.filter(c => c.nickname !== myNickname).map(c => ({ nickname: c.nickname, nodeId: c.nodeId, isOnline: c.isOnline })),
        responderId: this.myNodeId, timestamp: Date.now(),
      };
      if (myNickname) list.entries.push({ nickname: myNickname, nodeId: this.myNodeId, isOnline: true });
      await MeshService.sendMessage(MessageType.NICKNAME_LIST, JSON.stringify(list), query.requesterId);
    } catch { /* ignore */ }
  }

  private async handleNicknameList(packet: MeshPacket): Promise<void> {
    try {
      const list: NicknameList = JSON.parse(packet.payload);
      for (const entry of list.entries) this.addOrUpdateContact(entry.nickname, entry.nodeId);
    } catch { /* ignore */ }
  }

  private async sendReject(reg: NicknameRegistration): Promise<void> {
    await MeshService.sendMessage(MessageType.NICKNAME_REJECT, JSON.stringify({ nickname: reg.nickname, nodeId: reg.nodeId, accepted: false, reason: 'Nickname reserved', timestamp: Date.now() } as NicknameResponse), reg.nodeId);
  }

  private startAnnounceLoop(): void {
    if (this.announceTimer) return;
    setTimeout(() => this.broadcastAnnounce(), 2000);
    this.announceTimer = setInterval(() => this.broadcastAnnounce(), NICKNAME_ANNOUNCE_INTERVAL_MS);
  }

  private async broadcastAnnounce(): Promise<void> {
    const myNickname = this.getMyNickname();
    if (!myNickname) return;
    await MeshService.sendMessage(MessageType.NICKNAME_ANNOUNCE, JSON.stringify({ nickname: myNickname, nodeId: this.myNodeId, timestamp: Date.now() } as NicknameRegistration), 'broadcast');
  }

  private addOrUpdateContact(nickname: string, nodeId: NodeId): void {
    const existing = this.contacts.findIndex(c => c.nodeId === nodeId);
    const now = Date.now();
    if (existing !== -1) { this.contacts[existing] = { ...this.contacts[existing], nickname, lastSeen: now, isOnline: true }; }
    else { this.contacts.push({ nickname, nodeId, lastSeen: now, isOnline: true }); }
    this.saveContacts();
    this.notifyChange();
  }

  private updateOnlineStatus(): void {
    const now = Date.now();
    let changed = false;
    for (const c of this.contacts) { const wasOnline = c.isOnline; c.isOnline = (now - c.lastSeen) < CONTACT_OFFLINE_TIMEOUT_MS; if (wasOnline !== c.isOnline) changed = true; }
    if (changed) this.notifyChange();
  }

  private loadContacts(): void { const raw = getJson<ContactEntry[]>('contacts_directory'); this.contacts = raw || []; this.updateOnlineStatus(); }
  private saveContacts(): void { setJson('contacts_directory', this.contacts); }
  private notifyChange(): void { for (const handler of this.changeHandlers) { try { handler(); } catch { /* ignore */ } } }
  isInitialized(): boolean { return this.initialized; }
}

export const ContactService = new ContactServiceClass();
