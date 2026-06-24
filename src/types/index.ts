export type NodeId = string;

export enum MessageType {
  TEXT = 'text',
  VOICE_MAIL = 'voice_mail',
  VOICE_MAIL_CHUNK = 'voice_mail_chunk',
  SDP_OFFER = 'sdp_offer',
  SDP_ANSWER = 'sdp_answer',
  ICE_CANDIDATE = 'ice_candidate',
  KEY_EXCHANGE = 'key_exchange',
  PING = 'ping',
  PONG = 'pong',
  DELIVERY_ACK = 'delivery_ack',
  INTERCOM_AUDIO = 'intercom_audio',
  UPDATE_MANIFEST = 'update_manifest',
  UPDATE_CHUNK = 'update_chunk',
  UPDATE_CHUNK_REQUEST = 'update_chunk_request',
  NICKNAME_REGISTER = 'nickname_register',
  NICKNAME_ACCEPT = 'nickname_accept',
  NICKNAME_REJECT = 'nickname_reject',
  NICKNAME_ANNOUNCE = 'nickname_announce',
  NICKNAME_QUERY = 'nickname_query',
  NICKNAME_LIST = 'nickname_list',
  CONFERENCE_CREATE = 'conference_create',
  CONFERENCE_JOIN = 'conference_join',
  CONFERENCE_INVITE = 'conference_invite',
  CONFERENCE_LEAVE = 'conference_leave',
  CONFERENCE_PARTICIPANTS = 'conference_participants',
  CONFERENCE_AUDIO = 'conference_audio',
  SHARE_APK_REQUEST = 'share_apk_request',
  SHARE_APK_ACCEPT = 'share_apk_accept',
  SHARE_APK_REJECT = 'share_apk_reject',
  SHARE_APK_CHUNK = 'share_apk_chunk',
  SHARE_APK_DONE = 'share_apk_done',
  LOBBY_MESSAGE = 'lobby_message',
}

export enum DeliveryStatus {
  PENDING = 'pending',
  SENDING = 'sending',
  DELIVERED = 'delivered',
  FAILED = 'failed',
}

export interface MeshPacket {
  packetId: string;
  type: MessageType;
  sourceId: NodeId;
  targetId: NodeId;
  relayId: NodeId;
  ttl: number;
  payload: string;
  timestamp: number;
  isBroadcast: boolean;
  fragmentIndex?: number;
  fragmentTotal?: number;
  fragmentSessionId?: string;
}

export interface RouteEntry {
  nodeId: NodeId;
  nextHop: NodeId;
  rssi: number;
  lastSeen: number;
  hops: number;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: NodeId;
  text?: string;
  voiceMailUri?: string;
  voiceMailDuration?: number;
  type: MessageType;
  status: DeliveryStatus;
  timestamp: number;
  isIncoming: boolean;
  downloadProgress?: number;
}

export interface Peer {
  nodeId: NodeId;
  displayName: string;
  lastSeen: number;
  isOnline: boolean;
  rssi: number;
}

export enum CallState {
  IDLE = 'idle',
  CALLING = 'calling',
  RINGING = 'ringing',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ENDED = 'ended',
}

export interface CallNotification {
  callerId: NodeId;
  callType: 'audio';
  sdp: string;
  timestamp: number;
}

export interface KeySession {
  peerId: NodeId;
  rootKey: string;
  sendKey: string;
  recvKey: string;
  sendCounter: number;
  recvCounter: number;
  createdAt: number;
  pendingExchange?: KeyExchangePayload;
}

export interface KeyExchangePayload {
  identityKey: string;
  signedPreKey: string;
  signature: string;
  ephemeralPublicKey: string;
  peerId: NodeId;
  opkIndex?: number;
  opk?: string;
}

export interface KeyBundle {
  identityKey: string;
  identityPrivateKey: string;
  signedPreKey: string;
  signedPreKeyPrivate: string;
  signature: string;
  oneTimePreKeys: string[];
}

export interface UpdateManifest {
  version: string;
  versionCode: number;
  totalSize: number;
  chunkSize: number;
  totalChunks: number;
  fileHash: string;
  changelog: string[];
  timestamp: number;
  senderId: NodeId;
  packageName: string;
  downloadUrl?: string;
}

export interface UpdateChunk {
  manifestVersionCode: number;
  chunkIndex: number;
  data: string;
  totalChunks: number;
  senderId: NodeId;
}

export interface UpdateChunkRequest {
  manifestVersionCode: number;
  fromIndex: number;
  toIndex: number;
  requesterId: NodeId;
}

export interface ChangelogEntry {
  version: string;
  versionCode: number;
  changelog: string[];
  installedAt: number;
}

export interface NicknameRegistration {
  nickname: string;
  nodeId: NodeId;
  pubKey: string;
  signature: string;
  timestamp: number;
  password?: string;
}

export interface NicknameResponse {
  nickname: string;
  nodeId: NodeId;
  accepted: boolean;
  reason?: string;
  timestamp: number;
}

export interface ContactEntry {
  nickname: string;
  nodeId: NodeId;
  pubKey: string;
  lastSeen: number;
  isOnline: boolean;
}

export interface NicknameQuery {
  requesterId: NodeId;
  timestamp: number;
}

export interface NicknameList {
  entries: { nickname: string; nodeId: NodeId; pubKey: string; isOnline: boolean }[];
  responderId: NodeId;
  timestamp: number;
}

export interface ConferenceInfo {
  conferenceId: string;
  name: string;
  creatorId: NodeId;
  hasPassword: boolean;
  participantCount: number;
  participants?: ConferenceParticipant[];
  createdAt: number;
}

export interface ConferenceParticipant {
  nickname: string;
  nodeId: NodeId;
  isSpeaking: boolean;
  joinedAt: number;
}

export interface LobbyMessage {
  id: string;
  senderId: NodeId;
  senderNickname: string;
  text: string;
  timestamp: number;
  signature: string;
}

export interface ConferenceInvite {
  conferenceId: string;
  conferenceName: string;
  hostId: NodeId;
  hostNickname: string;
  hasPassword: boolean;
  timestamp: number;
}

export interface ConferenceJoinRequest {
  conferenceId: string;
  requesterId: NodeId;
  requesterNickname: string;
  password?: string;
}

export interface ConferenceJoinResponse {
  conferenceId: string;
  accepted: boolean;
  reason?: string;
  participants: ConferenceParticipant[];
}

export interface ConferenceAudio {
  conferenceId: string;
  speakerId: NodeId;
  speakerNickname: string;
  audioData: string;
  sequence: number;
  speaking?: boolean;
}

export const BLE_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const BLE_TX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
export const BLE_RX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
