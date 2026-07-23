export interface MessageRecord {
  id: string
  channelId: string
  senderPeerId: string
  ciphertext: Uint8Array
  nonce: Uint8Array
  createdAt: number
  expiresAt: number
  sizeBytes: number
}

export interface ForumThread {
  id: string
  title: string
  creatorPeerId: string
  createdAt: number
  lastActivityAt: number
  postCount: number
  visibility: 'public' | 'private'
}

export interface ForumPost {
  id: string
  threadId: string
  senderPeerId: string
  ciphertext: Uint8Array
  nonce: Uint8Array
  createdAt: number
  expiresAt: number
}

export interface Store {
  // Messages
  saveMessage(msg: MessageRecord): Promise<void>
  getMessages(channelId: string, limit: number, before?: number): Promise<MessageRecord[]>
  deleteExpiredMessages(): Promise<number>

  // Forum
  createThread(thread: ForumThread): Promise<void>
  getThreads(): Promise<ForumThread[]>
  deleteThread(threadId: string): Promise<void>
  savePost(post: ForumPost): Promise<void>
  getPosts(threadId: string, limit: number, offset: number): Promise<ForumPost[]>
  deletePost(postId: string, threadId: string): Promise<void>

  // Maintenance
  getTotalStorageBytes(): Promise<number>
  purgeOldData(maxAgeDays: number): Promise<number>
}
