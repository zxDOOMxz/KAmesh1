import AsyncStorage from '@react-native-async-storage/async-storage';
import { validateNickname, sanitizeNickname } from './nickname';

const IDENTITY_KEY = 'user_identity';

export interface UserIdentity {
  nickname: string;
  peerId: string;
  createdAt: number;
}

type IdentityListener = (identity: UserIdentity | null) => void;

class IdentityManager {
  private _identity: UserIdentity | null = null;
  private listeners: Set<IdentityListener> = new Set();

  async load(): Promise<UserIdentity | null> {
    try {
      const raw = await AsyncStorage.getItem(IDENTITY_KEY);
      if (raw) {
      this._identity = JSON.parse(raw);
      return this._identity;
    }
    } catch {}
    return null;
  }

  get(): UserIdentity | null {
    return this._identity;
  }

  async register(nickname: string, peerId: string): Promise<string | null> {
    const clean = sanitizeNickname(nickname);
    const error = validateNickname(clean);
    if (error) return error;

    this._identity = {
      nickname: clean,
      peerId,
      createdAt: Date.now(),
    };

    await AsyncStorage.setItem(IDENTITY_KEY, JSON.stringify(this._identity));
    this.notify();
    return null;
  }

  subscribe(cb: IdentityListener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(): void {
    const snap = this._identity;
    this.listeners.forEach((cb) => cb(snap));
  }
}

export const identityManager = new IdentityManager();
