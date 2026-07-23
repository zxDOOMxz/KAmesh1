import AsyncStorage from '@react-native-async-storage/async-storage';

export type UserStatus = 'online' | 'busy' | 'offline';

export interface OnlineUser {
  nickname: string;
  host: string;
  port: number;
  status: UserStatus;
  isFavorite: boolean;
  lastSeen: number;
}

const USERS_KEY = 'known_users';
const FAVORITES_KEY = 'favorite_users';
const MY_STATUS_KEY = 'my_status';

type UsersListener = () => void;

class UserStore {
  private users: OnlineUser[] = [];
  private favorites: Set<string> = new Set();
  private listeners: Set<UsersListener> = new Set();

  async load(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(USERS_KEY);
      if (raw) { this.users = JSON.parse(raw); }
      const fav = await AsyncStorage.getItem(FAVORITES_KEY);
      if (fav) { this.favorites = new Set(JSON.parse(fav)); }
    } catch {}
  }

  getAll(): OnlineUser[] {
    return this.users.map((u) => ({
      ...u,
      isFavorite: this.favorites.has(u.nickname),
    }));
  }

  async addOrUpdate(user: OnlineUser): Promise<void> {
    const idx = this.users.findIndex((u) => u.nickname === user.nickname);
    if (idx >= 0) {
      this.users[idx] = { ...this.users[idx], ...user };
    } else {
      this.users.push(user);
    }
    await this.save();
    this.notify();
  }

  async toggleFavorite(nickname: string): Promise<void> {
    if (this.favorites.has(nickname)) {
      this.favorites.delete(nickname);
    } else {
      this.favorites.add(nickname);
    }
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify([...this.favorites]));
    this.notify();
  }

  async setMyStatus(status: UserStatus): Promise<void> {
    await AsyncStorage.setItem(MY_STATUS_KEY, status);
  }

  async getMyStatus(): Promise<UserStatus> {
    const raw = await AsyncStorage.getItem(MY_STATUS_KEY);
    return (raw as UserStatus) || 'online';
  }

  subscribe(cb: UsersListener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private async save(): Promise<void> {
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(this.users));
  }

  private notify(): void {
    this.listeners.forEach((cb) => cb());
  }
}

export const userStore = new UserStore();
