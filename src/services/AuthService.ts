import { getJson, setJson, containsKey, getNodeId, setNodeId } from './StorageService';
import { ContactService } from './ContactService';
import type { NodeId } from '../types';

const PROFILE_KEY = 'user_profile';

export interface UserProfile {
  nickname: string;
  nodeId: NodeId;
}

class AuthServiceClass {
  isRegistered(): boolean {
    return containsKey(PROFILE_KEY);
  }

  getProfile(): UserProfile | null {
    return getJson<UserProfile>(PROFILE_KEY);
  }

  getNickname(): string | null {
    const profile = this.getProfile();
    return profile ? profile.nickname : null;
  }

  saveProfile(nickname: string): boolean {
    const trimmed = nickname.trim();
    if (!trimmed) return false;

    let nodeId = getNodeId();
    if (!nodeId) {
      nodeId = `anon_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
      setNodeId(nodeId);
    }

    const profile: UserProfile = { nickname: trimmed, nodeId };
    setJson(PROFILE_KEY, profile);

    try { ContactService.registerNickname(trimmed); } catch { /* ignore */ }

    return true;
  }

  resolveNickname(nodeId: NodeId): string {
    const profile = this.getProfile();
    if (profile && profile.nodeId === nodeId) return profile.nickname;

    const contact = ContactService.getByNodeId(nodeId);
    if (contact) return contact.nickname;

    return 'Неизвестный пользователь';
  }
}

export const AuthService = new AuthServiceClass();
