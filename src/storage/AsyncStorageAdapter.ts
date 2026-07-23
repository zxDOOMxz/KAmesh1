import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Store, MessageRecord, ForumThread, ForumPost } from './Store';

const KEYS = {
  messages: (ch: string) => `msgs:${ch}`,
  threads: 'forum:threads',
  posts: (t: string) => `forum:posts:${t}`,
  meta: 'store:meta',
};

export class AsyncStorageAdapter implements Store {
  async saveMessage(msg: MessageRecord): Promise<void> {
    const key = KEYS.messages(msg.channelId);
    const raw = await AsyncStorage.getItem(key);
    const list: MessageRecord[] = raw ? JSON.parse(raw) : [];
    list.push(msg);
    list.sort((a, b) => b.createdAt - a.createdAt);
    if (list.length > 500) {list.length = 500;}
    await AsyncStorage.setItem(key, JSON.stringify(list));
  }

  async getMessages(
    channelId: string,
    limit: number,
    before?: number,
  ): Promise<MessageRecord[]> {
    const raw = await AsyncStorage.getItem(KEYS.messages(channelId));
    if (!raw) {return [];}
    const list: MessageRecord[] = JSON.parse(raw);
    const filtered = before
      ? list.filter((m) => m.createdAt < before)
      : list;
    return filtered.slice(0, limit);
  }

  async deleteExpiredMessages(): Promise<number> {
    const keys = await AsyncStorage.getAllKeys();
    const msgKeys = keys.filter((k) => k.startsWith('msgs:'));
    let deleted = 0;
    for (const key of msgKeys) {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) {continue;}
      const list: MessageRecord[] = JSON.parse(raw);
      const now = Date.now();
      const filtered = list.filter((m) => m.expiresAt > now);
      if (filtered.length !== list.length) {
        deleted += list.length - filtered.length;
        if (filtered.length > 0) {
          await AsyncStorage.setItem(key, JSON.stringify(filtered));
        } else {
          await AsyncStorage.removeItem(key);
        }
      }
    }
    return deleted;
  }

  async createThread(thread: ForumThread): Promise<void> {
    const raw = await AsyncStorage.getItem(KEYS.threads);
    const list: ForumThread[] = raw ? JSON.parse(raw) : [];
    list.push(thread);
    await AsyncStorage.setItem(KEYS.threads, JSON.stringify(list));
  }

  async getThreads(): Promise<ForumThread[]> {
    const raw = await AsyncStorage.getItem(KEYS.threads);
    return raw ? JSON.parse(raw) : [];
  }

  async deleteThread(threadId: string): Promise<void> {
    const raw = await AsyncStorage.getItem(KEYS.threads);
    if (!raw) {return;}
    const list: ForumThread[] = JSON.parse(raw);
    const filtered = list.filter((t) => t.id !== threadId);
    await AsyncStorage.setItem(KEYS.threads, JSON.stringify(filtered));
    await AsyncStorage.removeItem(KEYS.posts(threadId));
  }

  async savePost(post: ForumPost): Promise<void> {
    const key = KEYS.posts(post.threadId);
    const raw = await AsyncStorage.getItem(key);
    const list: ForumPost[] = raw ? JSON.parse(raw) as ForumPost[] : [];
    list.push({
      ...post,
      ciphertext: Array.from(post.ciphertext) as unknown as Uint8Array,
      nonce: Array.from(post.nonce) as unknown as Uint8Array,
    });
    await AsyncStorage.setItem(key, JSON.stringify(list));
  }

  async getPosts(
    threadId: string,
    limit: number,
    offset: number,
  ): Promise<ForumPost[]> {
    const raw = await AsyncStorage.getItem(KEYS.posts(threadId));
    if (!raw) {return [];}
    const list: ForumPost[] = JSON.parse(raw);
    return list.slice(offset, offset + limit).map((p) => ({
      ...p,
      ciphertext: Array.isArray(p.ciphertext)
        ? new Uint8Array(p.ciphertext as unknown as number[])
        : new Uint8Array(Object.values(p.ciphertext ?? {})),
      nonce: Array.isArray(p.nonce)
        ? new Uint8Array(p.nonce as unknown as number[])
        : new Uint8Array(Object.values(p.nonce ?? {})),
    }));
  }

  async deletePost(postId: string, threadId: string): Promise<void> {
    const key = KEYS.posts(threadId);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {return;}
    const list: ForumPost[] = JSON.parse(raw);
    const filtered = list.filter((p) => p.id !== postId);
    if (filtered.length > 0) {
      await AsyncStorage.setItem(key, JSON.stringify(filtered));
    } else {
      await AsyncStorage.removeItem(key);
    }
  }

  async getTotalStorageBytes(): Promise<number> {
    const keys = await AsyncStorage.getAllKeys();
    let total = 0;
    for (const key of keys) {
      const raw = await AsyncStorage.getItem(key);
      if (raw) {total += raw.length * 2;}
    }
    return total;
  }

  async purgeOldData(maxAgeDays: number): Promise<number> {
    const cutoff = Date.now() - maxAgeDays * 86400000;
    const keys = await AsyncStorage.getAllKeys();
    let purged = 0;
    for (const key of keys) {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) {continue;}
      try {
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          const filtered = data.filter(
            (item: any) => item.createdAt > cutoff,
          );
          if (filtered.length !== data.length) {
            purged += data.length - filtered.length;
            if (filtered.length > 0) {
              await AsyncStorage.setItem(key, JSON.stringify(filtered));
            } else {
              await AsyncStorage.removeItem(key);
            }
          }
        }
      } catch {
        // not a JSON array, skip
      }
    }
    return purged;
  }
}
