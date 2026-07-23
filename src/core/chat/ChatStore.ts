import AsyncStorage from '@react-native-async-storage/async-storage';

const CHATS_KEY = 'chat_list';
const FAV_CHATS_KEY = 'fav_chats';

export interface ChatInfo {
  peerNick: string;
  peerId: string;
  lastMessage: string;
  lastTime: number;
  unread: number;
  isFavorite?: boolean;
}

type ChatListener = () => void;

class ChatStore {
  private chats: ChatInfo[] = [];
  private favs: Set<string> = new Set();
  private listeners: Set<ChatListener> = new Set();

  async load(): Promise<void> {
    const raw = await AsyncStorage.getItem(CHATS_KEY);
    if (raw) { this.chats = JSON.parse(raw); }
    const fav = await AsyncStorage.getItem(FAV_CHATS_KEY);
    if (fav) { this.favs = new Set(JSON.parse(fav)); }
  }

  getAll(): ChatInfo[] {
    const result = this.chats.map((c) => ({
      ...c,
      isFavorite: this.favs.has(c.peerNick),
    }));
    result.sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) { return a.isFavorite ? -1 : 1; }
      return b.lastTime - a.lastTime;
    });
    return result;
  }

  async addOrUpdate(peerNick: string, peerId: string, message: string): Promise<void> {
    const idx = this.chats.findIndex((c) => c.peerNick === peerNick);
    if (idx >= 0) {
      this.chats[idx] = { ...this.chats[idx], lastMessage: message, lastTime: Date.now(), unread: this.chats[idx].unread + 1 };
    } else {
      this.chats.push({ peerNick, peerId, lastMessage: message, lastTime: Date.now(), unread: 1 });
    }
    await AsyncStorage.setItem(CHATS_KEY, JSON.stringify(this.chats));
    this.notify();
  }

  async markRead(peerNick: string): Promise<void> {
    const idx = this.chats.findIndex((c) => c.peerNick === peerNick);
    if (idx >= 0) { this.chats[idx].unread = 0; }
    await AsyncStorage.setItem(CHATS_KEY, JSON.stringify(this.chats));
    this.notify();
  }

  async toggleFavorite(peerNick: string): Promise<void> {
    if (this.favs.has(peerNick)) { this.favs.delete(peerNick); }
    else { this.favs.add(peerNick); }
    await AsyncStorage.setItem(FAV_CHATS_KEY, JSON.stringify([...this.favs]));
    this.notify();
  }

  subscribe(cb: ChatListener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(): void { this.listeners.forEach((cb) => cb()); }
}

export const chatStore = new ChatStore();
