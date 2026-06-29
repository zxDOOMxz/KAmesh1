import { getJson, setJson, containsKey, getNodeId } from './StorageService';
import { ContactService } from './ContactService';
import type { NodeId } from '../types';

const PROFILE_KEY = 'user_profile';

export interface UserProfile {
  email: string;
  nickname: string;
  nodeId: NodeId;
}

function deriveNickname(email: string): string {
  return email.split('@')[0] || email;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidNickname(nick: string): boolean {
  return /^[a-zA-Z0-9а-яА-ЯёЁ_\-.]+$/.test(nick) && nick.length >= 2 && nick.length <= 20;
}

function sanitizeNickname(nick: string): string {
  return nick.replace(/[^a-zA-Z0-9а-яА-ЯёЁ_\-.]/g, '_').slice(0, 20);
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

  getEmail(): string | null {
    const profile = this.getProfile();
    return profile ? profile.email : null;
  }

  async saveProfile(email: string): Promise<boolean> {
    const trimmed = email.trim().toLowerCase();
    if (!isValidEmail(trimmed)) return false;
    const nodeId = getNodeId() || '';
    if (!nodeId) return false;

    let nickname = deriveNickname(trimmed);
    if (!isValidNickname(nickname)) nickname = sanitizeNickname(nickname);
    if (!isValidNickname(nickname)) nickname = `user_${nodeId.slice(0, 6)}`;

    const profile: UserProfile = { email: trimmed, nickname, nodeId };
    setJson(PROFILE_KEY, profile);

    try { await ContactService.registerNickname(nickname); } catch { /* ignore */ }

    return true;
  }

  resolveNickname(nodeId: NodeId): string {
    const profile = this.getProfile();
    if (profile && profile.nodeId === nodeId) return profile.nickname;

    const contact = ContactService.getByNodeId(nodeId);
    if (contact) return contact.nickname;

    return 'Неизвестный пользователь';
  }

  updateNickname(nickname: string): void {
    const profile = this.getProfile();
    if (!profile) return;
    profile.nickname = nickname;
    setJson(PROFILE_KEY, profile);
  }
}

export const AuthService = new AuthServiceClass();
