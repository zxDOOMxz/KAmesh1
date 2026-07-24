type UserListCb = (users: Array<{ nickname: string; peerId: string }>) => void;
type SearchCb = (results: Array<{ nickname: string; peerId: string }>) => void;
type StatusCb = (status: 'connected' | 'disconnected') => void;
type NicknameCb = (ok: boolean, error?: string) => void;

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

  constructor(url: string) {
    this.url = url;
  }

  connect(nickname: string, peerId: string, deviceId?: string) {
    this.myNickname = nickname;
    this.myPeerId = peerId;
    this.disconnect();
    try {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => {
        this.send('register', { nickname, peerId, deviceId: deviceId || '' });
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
        this.statusCbs.forEach((cb) => cb('disconnected'));
        this.scheduleReconnect(nickname, peerId, deviceId);
      };
      this.ws.onerror = () => {};
    } catch {}
  }

  updateNickname(oldNickname: string, newNickname: string) {
    this.myNickname = newNickname;
    this.send('update_nickname', { oldNickname, newNickname, peerId: this.myPeerId });
  }

  search(query: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send('search', { query });
    }
  }

  disconnect() {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.ws?.close();
    this.ws = null;
  }

  onUserList(cb: UserListCb): () => void { this.userListCbs.add(cb); return () => { this.userListCbs.delete(cb); }; }
  onSearchResults(cb: SearchCb): () => void { this.searchCbs.add(cb); return () => { this.searchCbs.delete(cb); }; }
  onStatus(cb: StatusCb): () => void { this.statusCbs.add(cb); return () => { this.statusCbs.delete(cb); }; }
  onNicknameResult(cb: NicknameCb): () => void { this.nicknameCbs.add(cb); return () => { this.nicknameCbs.delete(cb); }; }

  private send(type: string, data: any) {
    this.ws?.send(JSON.stringify({ type, data }));
  }

  private scheduleReconnect(nickname: string, peerId: string, deviceId?: string) {
    this.reconnectTimer = setTimeout(() => this.connect(nickname, peerId, deviceId), 5000);
  }
}

export function createSignalingClient(url: string) {
  return new SignalingClient(url);
}

export const defaultSignalingClient = new SignalingClient('ws://localhost:8080');
