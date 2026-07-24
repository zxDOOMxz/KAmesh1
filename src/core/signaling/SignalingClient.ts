import AsyncStorage from '@react-native-async-storage/async-storage';

type UserListCb = (users: Array<{ nickname: string; peerId: string }>) => void;
type SearchCb = (results: Array<{ nickname: string; peerId: string }>) => void;
type StatusCb = (status: 'connected' | 'connecting' | 'disconnected') => void;
type NicknameCb = (ok: boolean, error?: string) => void;

const SERVER_URL_KEY = 'signaling_server_url';
const DEFAULT_FALLBACK = 'ws://192.168.105.144:8080';

let savedUrl = '';

export async function loadServerUrl(): Promise<string> {
  try { const v = await AsyncStorage.getItem(SERVER_URL_KEY); if (v) { savedUrl = v; return v; } } catch {}
  return DEFAULT_FALLBACK;
}

export async function saveServerUrl(url: string): Promise<void> {
  savedUrl = url;
  await AsyncStorage.setItem(SERVER_URL_KEY, url);
}

export function getServerUrl(): string { return savedUrl || DEFAULT_FALLBACK; }

export class SignalingClient {
  private ws: WebSocket | null = null;
  private url: string;
  private userListCbs: Set<UserListCb> = new Set();
  private searchCbs: Set<SearchCb> = new Set();
  private statusCbs: Set<StatusCb> = new Set();
  private nicknameCbs: Set<NicknameCb> = new Set();
  private reconnectTimer: any = null;
  private myNickname = '';
  private myPeerId = '';
  private myDeviceId = '';
  private retryCount = 0;
  private intentionalClose = false;

  constructor(url: string) { this.url = url; }

  connect(nickname: string, peerId: string, deviceId?: string) {
    this.myNickname = nickname;
    this.myPeerId = peerId;
    this.myDeviceId = deviceId || '';
    this.intentionalClose = false;
    this.disconnect();
    this.statusCbs.forEach((cb) => cb('connecting'));
    try {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => {
        this.retryCount = 0;
        this.send('register', { nickname, peerId, deviceId: this.myDeviceId });
      };
      this.ws.onmessage = (event) => {
        try {
          const { type, data } = JSON.parse(event.data);
          if (type === 'user_list') { this.userListCbs.forEach((cb) => cb(data)); }
          if (type === 'search_results') { this.searchCbs.forEach((cb) => cb(data.results)); }
          if (type === 'register_ok') { this.statusCbs.forEach((cb) => cb('connected')); }
          if (type === 'register_error') { this.statusCbs.forEach((cb) => cb('disconnected')); }
          if (type === 'nickname_ok') { this.nicknameCbs.forEach((cb) => cb(true)); }
          if (type === 'nickname_error') { this.nicknameCbs.forEach((cb) => cb(false, data.error)); }
        } catch {}
      };
      this.ws.onclose = () => {
        if (!this.intentionalClose) {
          this.statusCbs.forEach((cb) => cb('disconnected'));
          this.scheduleReconnect();
        }
      };
      this.ws.onerror = () => {
        this.statusCbs.forEach((cb) => cb('disconnected'));
      };
    } catch {
      this.statusCbs.forEach((cb) => cb('disconnected'));
      this.scheduleReconnect();
    }
  }

  updateNickname(oldNickname: string, newNickname: string) {
    this.myNickname = newNickname;
    this.send('update_nickname', { oldNickname, newNickname, peerId: this.myPeerId });
  }

  search(query: string) {
    if (this.ws?.readyState === WebSocket.OPEN) { this.send('search', { query }); }
  }

  reconnect(url?: string) {
    if (url) { this.url = url; }
    if (this.myNickname) { this.connect(this.myNickname, this.myPeerId, this.myDeviceId); }
  }

  disconnect() {
    this.intentionalClose = true;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.ws?.close();
    this.ws = null;
  }

  onUserList(cb: UserListCb): () => void { this.userListCbs.add(cb); return () => { this.userListCbs.delete(cb); }; }
  onSearchResults(cb: SearchCb): () => void { this.searchCbs.add(cb); return () => { this.searchCbs.delete(cb); }; }
  onStatus(cb: StatusCb): () => void { this.statusCbs.add(cb); return () => { this.statusCbs.delete(cb); }; }
  onNicknameResult(cb: NicknameCb): () => void { this.nicknameCbs.add(cb); return () => { this.nicknameCbs.delete(cb); }; }

  private send(type: string, data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) { this.ws.send(JSON.stringify({ type, data })); }
  }

  private scheduleReconnect() {
    if (this.retryCount >= 20) { return; }
    const delay = Math.min(2000 * Math.pow(1.5, this.retryCount), 30000);
    this.retryCount++;
    this.reconnectTimer = setTimeout(() => {
      if (this.myNickname) { this.connect(this.myNickname, this.myPeerId, this.myDeviceId); }
    }, delay);
  }
}

export const defaultSignalingClient = new SignalingClient(DEFAULT_FALLBACK);
