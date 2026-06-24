import uuidv4 from 'react-native-uuid';
import { MeshService } from './MeshService';
import { getNodeId } from './StorageService';
import { ContactService } from './ContactService';
import { MessageType, NodeId, MeshPacket, ConferenceInfo, ConferenceParticipant, ConferenceJoinRequest, ConferenceJoinResponse, ConferenceAudio } from '../types';

type ConferenceHandler = (event: ConferenceEvent) => void;

interface ConferenceEvent {
  type: 'created' | 'joined' | 'left' | 'participant_joined' | 'participant_left' | 'speaker_changed' | 'audio' | 'discovered' | 'error';
  conference?: ConferenceInfo;
  participant?: ConferenceParticipant;
  audio?: ConferenceAudio;
  error?: string;
}

class ConferenceServiceClass {
  private initialized = false;
  private myNodeId: NodeId = '';
  private knownConferences = new Map<string, ConferenceInfo>();
  private activeConferenceId: string | null = null;
  private conferencePasswords = new Map<string, string>();
  private participants = new Map<NodeId, ConferenceParticipant>();
  private handlers: ConferenceHandler[] = [];

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.myNodeId = getNodeId() || '';
    MeshService.onPacket(this.handlePacket.bind(this));
    this.initialized = true;
  }

  destroy(): void {
    if (this.activeConferenceId) this.leave(this.activeConferenceId);
    this.knownConferences.clear();
    this.participants.clear();
    this.conferencePasswords.clear();
    this.handlers = [];
  }

  async create(name: string, password?: string): Promise<ConferenceInfo> {
    if (this.activeConferenceId) throw new Error('Already in a conference');
    const conferenceId = uuidv4.v4();
    const myNickname = ContactService.getMyNickname() || 'unknown';
    const conference: ConferenceInfo = {
      conferenceId, name, creatorId: this.myNodeId, hasPassword: !!password, participantCount: 1,
      participants: [{ nickname: myNickname, nodeId: this.myNodeId, isSpeaking: false, joinedAt: Date.now() }],
      createdAt: Date.now(),
    };
    this.knownConferences.set(conferenceId, conference);
    this.activeConferenceId = conferenceId;
    this.participants.set(this.myNodeId, conference.participants![0]);
    if (password) this.conferencePasswords.set(conferenceId, password);
    await MeshService.sendMessage(MessageType.CONFERENCE_CREATE, JSON.stringify(conference), 'broadcast');
    this.notify({ type: 'created', conference });
    return conference;
  }

  async join(conferenceId: string, password?: string): Promise<boolean> {
    const conference = this.knownConferences.get(conferenceId);
    if (!conference) { this.notify({ type: 'error', error: 'Conference not found' }); return false; }
    if (conference.hasPassword && !password) { this.notify({ type: 'error', error: 'Password required' }); return false; }
    const myNickname = ContactService.getMyNickname() || 'unknown';
    const request: ConferenceJoinRequest = { conferenceId, requesterId: this.myNodeId, requesterNickname: myNickname, password };
    await MeshService.sendMessage(MessageType.CONFERENCE_JOIN, JSON.stringify(request), conference.creatorId);
    this.activeConferenceId = conferenceId;
    this.participants.set(this.myNodeId, { nickname: myNickname, nodeId: this.myNodeId, isSpeaking: false, joinedAt: Date.now() });
    this.notify({ type: 'joined', conference });
    return true;
  }

  async leave(conferenceId: string): Promise<void> {
    if (this.activeConferenceId !== conferenceId) return;
    await MeshService.sendMessage(MessageType.CONFERENCE_LEAVE, JSON.stringify({ conferenceId, leaverId: this.myNodeId, leaverNickname: ContactService.getMyNickname() || 'unknown' }), 'broadcast');
    this.activeConferenceId = null;
    this.participants.clear();
    this.conferencePasswords.delete(conferenceId);
    this.notify({ type: 'left' });
  }

  async sendAudio(audioData: string, sequence: number): Promise<void> {
    if (!this.activeConferenceId) return;
    await MeshService.sendMessage(MessageType.CONFERENCE_AUDIO, JSON.stringify({ conferenceId: this.activeConferenceId, speakerId: this.myNodeId, speakerNickname: ContactService.getMyNickname() || 'unknown', audioData, sequence } as ConferenceAudio), 'broadcast');
  }

  async setSpeaking(speaking: boolean): Promise<void> {
    if (!this.activeConferenceId) return;
    const me = this.participants.get(this.myNodeId);
    if (me) me.isSpeaking = speaking;
  }

  getOpenConferences(): ConferenceInfo[] { return Array.from(this.knownConferences.values()).filter(c => !c.hasPassword); }
  getKnownConferences(): ConferenceInfo[] { return Array.from(this.knownConferences.values()); }
  getActiveConferenceId(): string | null { return this.activeConferenceId; }
  getActiveConference(): ConferenceInfo | null { return this.activeConferenceId ? this.knownConferences.get(this.activeConferenceId) || null : null; }
  getParticipants(): ConferenceParticipant[] { return Array.from(this.participants.values()); }

  onEvent(handler: ConferenceHandler): () => void {
    this.handlers.push(handler);
    return () => { this.handlers = this.handlers.filter(h => h !== handler); };
  }

  private async handlePacket(packet: MeshPacket): Promise<void> {
    switch (packet.type) {
      case MessageType.CONFERENCE_CREATE: await this.handleConferenceCreate(packet); break;
      case MessageType.CONFERENCE_JOIN: await this.handleJoinRequest(packet); break;
      case MessageType.CONFERENCE_LEAVE: await this.handleLeave(packet); break;
      case MessageType.CONFERENCE_PARTICIPANTS: await this.handleParticipantsUpdate(packet); break;
      case MessageType.CONFERENCE_AUDIO: await this.handleAudio(packet); break;
    }
  }

  private async handleConferenceCreate(packet: MeshPacket): Promise<void> {
    try {
      const conf: ConferenceInfo = JSON.parse(packet.payload);
      if (this.knownConferences.has(conf.conferenceId) || conf.creatorId === this.myNodeId) return;
      this.knownConferences.set(conf.conferenceId, conf);
      this.notify({ type: 'discovered', conference: conf });
    } catch { /* ignore */ }
  }

  private async handleJoinRequest(packet: MeshPacket): Promise<void> {
    try {
      const request: ConferenceJoinRequest = JSON.parse(packet.payload);
      if (request.requesterId === this.myNodeId || this.activeConferenceId !== request.conferenceId) return;
      const conference = this.knownConferences.get(request.conferenceId);
      if (!conference) return;
      if (conference.hasPassword) {
        const myPassword = this.conferencePasswords.get(request.conferenceId);
        if (!myPassword || request.password !== myPassword) {
          await MeshService.sendMessage(MessageType.CONFERENCE_PARTICIPANTS, JSON.stringify({ conferenceId: request.conferenceId, accepted: false, participants: [] } as ConferenceJoinResponse), request.requesterId);
          return;
        }
      }
      const participant: ConferenceParticipant = { nickname: request.requesterNickname, nodeId: request.requesterId, isSpeaking: false, joinedAt: Date.now() };
      this.participants.set(request.requesterId, participant);
      conference.participantCount = this.participants.size;
      this.notify({ type: 'participant_joined', participant });
      await MeshService.sendMessage(MessageType.CONFERENCE_PARTICIPANTS, JSON.stringify({ conferenceId: request.conferenceId, accepted: true, participants: this.getParticipants() } as ConferenceJoinResponse), request.requesterId);
    } catch { /* ignore */ }
  }

  private async handleLeave(packet: MeshPacket): Promise<void> {
    try {
      const data = JSON.parse(packet.payload);
      if (data.leaverId === this.myNodeId) return;
      const participant = this.participants.get(data.leaverId);
      if (participant) { this.participants.delete(data.leaverId); this.notify({ type: 'participant_left', participant }); }
    } catch { /* ignore */ }
  }

  private async handleParticipantsUpdate(packet: MeshPacket): Promise<void> {
    try {
      const response: ConferenceJoinResponse = JSON.parse(packet.payload);
      if (!this.activeConferenceId) this.activeConferenceId = response.conferenceId;
      for (const p of response.participants) this.participants.set(p.nodeId, p);
      const conf = this.knownConferences.get(response.conferenceId);
      if (conf) conf.participantCount = response.participants.length;
      this.notify({ type: 'participant_joined', conference: conf || undefined });
    } catch { /* ignore */ }
  }

  private async handleAudio(packet: MeshPacket): Promise<void> {
    try {
      const audio: ConferenceAudio = JSON.parse(packet.payload);
      if (audio.conferenceId !== this.activeConferenceId || audio.speakerId === this.myNodeId) return;
      for (const [, p] of this.participants) p.isSpeaking = p.nodeId === audio.speakerId;
      this.notify({ type: 'audio', audio });
      this.notify({ type: 'speaker_changed' });
    } catch { /* ignore */ }
  }

  private notify(event: ConferenceEvent): void {
    for (const handler of this.handlers) { try { handler(event); } catch { /* ignore */ } }
  }

  isInitialized(): boolean { return this.initialized; }
}

export const ConferenceService = new ConferenceServiceClass();
