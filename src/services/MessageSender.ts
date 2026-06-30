import { ApiClient } from './ApiClient';
import { E2EEService } from './E2EEService';
import { MeshService } from './MeshService';
import { getNodeId } from './StorageService';
import { MessageType, NodeId, ChatMessage, DeliveryStatus } from '../types';

export type SendResult = { success: true; via: 'internet' | 'mesh'; messageId: string } | { success: false; error: string };

type MessageHandler = (message: ChatMessage) => void;

class MessageSenderClass {
  private handlers: MessageHandler[] = [];
  private initialized = false;

  initialize(): void {
    if (this.initialized) return;
    E2EEService.initialize();
    ApiClient.initialize();

    // Listen for incoming mesh messages
    MeshService.onPacket((packet) => {
      if (packet.type !== MessageType.TEXT && packet.type !== MessageType.LOBBY_MESSAGE) return;
      const msg: ChatMessage = {
        id: packet.packetId,
        chatId: packet.sourceId,
        senderId: packet.sourceId,
        text: packet.payload,
        type: packet.type as unknown as ChatMessage['type'],
        status: DeliveryStatus.DELIVERED,
        timestamp: packet.timestamp,
        isIncoming: true,
      };
      for (const handler of this.handlers) {
        try { handler(msg); } catch { /* ignore */ }
      }
    });

    this.initialized = true;
  }

  isInitialized(): boolean { return this.initialized; }

  // Check if server is reachable
  async isInternetAvailable(): Promise<boolean> {
    if (!ApiClient.isAuthenticated()) return false;
    try {
      return await ApiClient.isServerReachable();
    } catch {
      return false;
    }
  }

  // Send message: Internet → Mesh fallback → E2E encrypted
  async sendMessage(
    content: string,
    chatId: string,
    options?: {
      contentType?: string;
      meshTargetId?: NodeId;
      chatMembers?: string[];
    },
  ): Promise<SendResult> {
    const contentType = options?.contentType || 'text';
    const meshTargetId = options?.meshTargetId || chatId;

    // Ensure E2E key exists for this chat
    if (!E2EEService.hasChatKey(chatId) && options?.chatMembers) {
      try {
        await E2EEService.setupChatKey(chatId, options.chatMembers);
      } catch { /* key setup failed, continue without E2E */ }
    }

    // Encrypt message content
    let encryptedContent: string;
    try {
      encryptedContent = await E2EEService.encryptMessage(chatId, content);
    } catch {
      encryptedContent = content; // Fallback to plaintext
    }

    // 1. Try Internet (REST API)
    const serverChatId = parseInt(chatId, 10);
    if (!isNaN(serverChatId) && ApiClient.isAuthenticated()) {
      try {
        const result = await ApiClient.sendMessage(serverChatId, encryptedContent, contentType);
        return { success: true, via: 'internet', messageId: String(result.id) };
      } catch {
        // Internet failed, fall through to mesh
      }
    }

    // 2. Fallback: Mesh network
    try {
      await MeshService.sendMessage(MessageType.TEXT, encryptedContent, meshTargetId);
      return { success: true, via: 'mesh', messageId: '' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Send failed' };
    }
  }

  // Decrypt incoming message
  async decryptMessage(chatId: string, encryptedContent: string, senderPubKey?: string): Promise<string> {
    if (E2EEService.hasChatKey(chatId)) {
      try {
        return await E2EEService.decryptMessage(chatId, encryptedContent, senderPubKey);
      } catch { /* fallback */ }
    }
    return encryptedContent; // Return as-is if not encrypted
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.push(handler);
    return () => { this.handlers = this.handlers.filter(h => h !== handler); };
  }
}

export const MessageSender = new MessageSenderClass();
