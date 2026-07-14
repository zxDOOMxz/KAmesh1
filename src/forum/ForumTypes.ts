import { PeerId } from '../core/p2p/PeerId';

export interface Channel {
  id: string
  name: string
  type: 'text' | 'voice'
  creatorPeerId: PeerId
  createdAt: number
  memberCount: number
  isPrivate: boolean
  encryptionKey: Uint8Array // shared symmetric key for the channel
}

export interface TextPost {
  id: string
  channelId: string
  parentId?: string // for replies
  senderPeerId: PeerId
  content: Uint8Array // encrypted
  nonce: Uint8Array
  createdAt: number
  editedAt?: number
}
