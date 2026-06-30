import { Platform } from 'react-native';
import { getJson, setJson, deleteKey } from './StorageService';
import { SERVER_URL, SERVER_URL_ANDROID, SERVER_URL_STORAGE_KEY } from '../constants';

const KEYS = {
  ACCESS_TOKEN: 'api_access_token',
  REFRESH_TOKEN: 'api_refresh_token',
  USER: 'api_user',
};

interface ApiUser {
  id: number;
  login: string;
  full_name: string;
  phone: string;
  email: string | null;
  avatar_url: string | null;
  role: string;
}

interface AuthResponse {
  user: ApiUser;
  accessToken: string;
  refreshToken: string;
}

interface ApiChat {
  id: number;
  name: string | null;
  type: 'direct' | 'group' | 'department';
  description: string | null;
  created_by: number;
}

interface ApiMessage {
  id: number;
  chat_id: number;
  sender_id: number;
  sender_name: string;
  content: string | null;
  content_type: string;
  created_at: string;
}

export type ConnectionState = 'connected' | 'disconnected' | 'connecting' | 'error';

class ApiClientClass {
  private baseUrl: string = Platform.OS === 'android' ? SERVER_URL_ANDROID : SERVER_URL;
  private accessToken: string | null = null;
  private refreshTokenVal: string | null = null;
  private user: ApiUser | null = null;
  private initialized = false;
  private refreshPromise: Promise<void> | null = null;
  private _connectionState: ConnectionState = 'disconnected';

  initialize(): void {
    if (this.initialized) return;
    const stored = getJson<string>(SERVER_URL_STORAGE_KEY);
    if (stored) this.baseUrl = stored;
    this.accessToken = getJson<string>(KEYS.ACCESS_TOKEN);
    this.refreshTokenVal = getJson<string>(KEYS.REFRESH_TOKEN);
    this.user = getJson<ApiUser>(KEYS.USER);
    this.initialized = true;
    this._connectionState = this.accessToken ? 'connected' : 'disconnected';
  }

  isInitialized(): boolean { return this.initialized; }
  isAuthenticated(): boolean { return !!this.accessToken; }
  getBaseUrl(): string { return this.baseUrl; }
  getUser(): ApiUser | null { return this.user; }
  getConnectionState(): ConnectionState { return this._connectionState; }
  getAccessToken(): string | null { return this.accessToken; }

  setServerUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, '');
    setJson(SERVER_URL_STORAGE_KEY, this.baseUrl);
  }

  async login(login: string, password: string): Promise<AuthResponse> {
    this._connectionState = 'connecting';
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      });
    } catch (e) {
      this._connectionState = 'error';
      throw new Error(`Сервер недоступен (${this.baseUrl}). Убедитесь, что сервер запущен на порту 8080.`);
    }
    if (!res.ok) {
      this._connectionState = 'error';
      const err = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(err.error || 'Login failed');
    }
    const data: AuthResponse = await res.json();
    this.accessToken = data.accessToken;
    this.refreshTokenVal = data.refreshToken;
    this.user = data.user;
    setJson(KEYS.ACCESS_TOKEN, data.accessToken);
    setJson(KEYS.REFRESH_TOKEN, data.refreshToken);
    setJson(KEYS.USER, data.user);
    this._connectionState = 'connected';
    return data;
  }

  async register(login: string, password: string, phone: string, fullName: string, email?: string): Promise<AuthResponse> {
    this._connectionState = 'connecting';
    const res = await fetch(`${this.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password, phone, full_name: fullName, email: email || undefined }),
    });
    if (!res.ok) {
      this._connectionState = 'error';
      const err = await res.json().catch(() => ({ error: 'Registration failed' }));
      throw new Error(err.error || 'Registration failed');
    }
    const data: AuthResponse = await res.json();
    this.accessToken = data.accessToken;
    this.refreshTokenVal = data.refreshToken;
    this.user = data.user;
    setJson(KEYS.ACCESS_TOKEN, data.accessToken);
    setJson(KEYS.REFRESH_TOKEN, data.refreshToken);
    setJson(KEYS.USER, data.user);
    this._connectionState = 'connected';
    return data;
  }

  private async refreshAccessToken(): Promise<void> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      if (!this.refreshTokenVal) throw new Error('No refresh token');
      const res = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshTokenVal }),
      });
      if (!res.ok) {
        this.logout();
        throw new Error('Session expired');
      }
      const data = await res.json();
      this.accessToken = data.accessToken;
      this.refreshTokenVal = data.refreshToken;
      setJson(KEYS.ACCESS_TOKEN, data.accessToken);
      setJson(KEYS.REFRESH_TOKEN, data.refreshToken);
    })();
    try { await this.refreshPromise; } finally { this.refreshPromise = null; }
  }

  private async request(path: string, options: RequestInit = {}): Promise<Response> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(`${this.baseUrl}${path}`, { ...options, headers });
    if (res.status === 401 && this.refreshTokenVal) {
      try {
        await this.refreshAccessToken();
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        return fetch(`${this.baseUrl}${path}`, { ...options, headers });
      } catch {
        throw new Error('Session expired');
      }
    }
    return res;
  }

  private async requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await this.request(path, options);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async sendMessage(chatId: number, encryptedContent: string, contentType: string = 'text'): Promise<ApiMessage> {
    return this.requestJson<{ message: ApiMessage }>(
      `/api/chats/${chatId}/messages`,
      { method: 'POST', body: JSON.stringify({ content: encryptedContent, content_type: contentType }) }
    ).then(r => r.message);
  }

  async getMessages(chatId: number, limit: number = 50, offset: number = 0): Promise<ApiMessage[]> {
    return this.requestJson<{ messages: ApiMessage[] }>(
      `/api/chats/${chatId}/messages?limit=${limit}&offset=${offset}`
    ).then(r => r.messages);
  }

  async getChats(): Promise<ApiChat[]> {
    return this.requestJson<{ chats: ApiChat[] }>('/api/chats').then(r => r.chats);
  }

  async createChat(type: string, name: string | undefined, memberIds: number[]): Promise<ApiChat> {
    return this.requestJson<{ chat: ApiChat }>('/api/chats', {
      method: 'POST',
      body: JSON.stringify({ type, name, member_ids: memberIds }),
    }).then(r => r.chat);
  }

  async getMe(): Promise<ApiUser> {
    return this.requestJson<{ user: ApiUser }>('/api/auth/me').then(r => r.user);
  }

  async forgotPassword(email: string): Promise<void> {
    const res = await this.request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Request failed');
    }
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    const res = await this.request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, code, newPassword }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Reset failed' }));
      throw new Error(err.error || 'Reset failed');
    }
  }

  async isServerReachable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${this.baseUrl}/health`, { method: 'GET', signal: controller.signal });
      clearTimeout(timer);
      return res.ok;
    } catch {
      return false;
    }
  }

  logout(): void {
    this.accessToken = null;
    this.refreshTokenVal = null;
    this.user = null;
    deleteKey(KEYS.ACCESS_TOKEN);
    deleteKey(KEYS.REFRESH_TOKEN);
    deleteKey(KEYS.USER);
    this._connectionState = 'disconnected';
  }
}

export const ApiClient = new ApiClientClass();
