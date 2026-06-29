import * as FileSystem from 'expo-file-system';
import { INTERCOM_AUDIO_CHUNK_SIZE, INTERCOM_FRAME_DURATION_MS } from '../constants';
import { MessageType } from '../types';
import { MeshService } from './MeshService';

let AudioRecorderPlayer: any = null;
let _AudioSourceAndroidType: any = null;
let _AudioEncoderAndroidType: any = null;
let _OutputFormatAndroidType: any = null;

function getAudioRecorderPlayer() {
  if (!AudioRecorderPlayer) {
    const mod = require('react-native-audio-recorder-player');
    AudioRecorderPlayer = mod.default;
    _AudioSourceAndroidType = mod.AudioSourceAndroidType;
    _AudioEncoderAndroidType = mod.AudioEncoderAndroidType;
    _OutputFormatAndroidType = mod.OutputFormatAndroidType;
  }
  return AudioRecorderPlayer;
}

function micSource(): number { getAudioRecorderPlayer(); return _AudioSourceAndroidType?.MIC ?? 1; }
function opusEncoder(): number { getAudioRecorderPlayer(); return _AudioEncoderAndroidType?.OPUS ?? 7; }
function oggOutput(): number { getAudioRecorderPlayer(); return _OutputFormatAndroidType?.OGG ?? 11; }

type AudioHandler = (chunkB64: string, peerId: string) => void;
type VoxSpeakingHandler = (speaking: boolean) => void;

class IntercomServiceClass {
  private isTransmitting = false;
  private audioRecorder: any = null;
  private audioHandlers: AudioHandler[] = [];
  private activePeers = new Set<string>();
  private chunkTimer: ReturnType<typeof setInterval> | null = null;
  private lastReadPosition = 0;
  private unsubscribeMesh: (() => void) | null = null;
  private voxEnabled = false;
  private voxThreshold = 20;
  private silenceCounter = 0;
  private readonly SILENCE_FRAMES_LIMIT = 25;
  private voxTimer: ReturnType<typeof setInterval> | null = null;
  private voxHandlers: VoxSpeakingHandler[] = [];

  initialize(): void {
    if (this.unsubscribeMesh) return;
    this.unsubscribeMesh = MeshService.onPacket((packet) => { this.handleIncomingAudio(packet.payload, packet.sourceId); });
  }

  async startTransmitting(): Promise<void> {
    if (this.isTransmitting || this.voxEnabled) return;
    this.isTransmitting = true;
    try {
      const audioSet = { AudioEncoderAndroid: opusEncoder(), AudioSourceAndroid: micSource(), OutputFormatAndroid: oggOutput(), AudioSamplingRateAndroid: 16000, AudioChannelsAndroid: 1, AudioEncodingBitRateAndroid: 8000 };
      const filePath = `${FileSystem.cacheDirectory}intercom_temp.opus`;
      await FileSystem.writeAsStringAsync(filePath, '', { encoding: FileSystem.EncodingType.Base64 });
      this.lastReadPosition = 0;
      this.audioRecorder = new (getAudioRecorderPlayer())();
      await this.audioRecorder.startRecorder(filePath, audioSet);
      this.chunkTimer = setInterval(async () => {
        if (!this.isTransmitting || !this.audioRecorder) return;
        try { const chunk = await this.readAudioChunk(); if (chunk) await this.broadcastChunk(chunk); } catch { /* ignore */ }
      }, INTERCOM_FRAME_DURATION_MS);
    } catch { this.isTransmitting = false; }
  }

  async stopTransmitting(): Promise<void> {
    if (this.voxEnabled) return;
    this.isTransmitting = false;
    if (this.chunkTimer) { clearInterval(this.chunkTimer); this.chunkTimer = null; }
    try { if (this.audioRecorder) { await this.audioRecorder.stopRecorder(); this.audioRecorder = null; } } catch { /* ignore */ }
    this.lastReadPosition = 0;
    try { await FileSystem.deleteAsync(`${FileSystem.cacheDirectory}intercom_temp.opus`, { idempotent: true }); } catch { /* ignore */ }
  }

  setVoxEnabled(enabled: boolean, threshold?: number): void {
    if (threshold !== undefined) this.voxThreshold = threshold;
    if (enabled && !this.voxEnabled) { this.voxEnabled = true; this.silenceCounter = 0; this.startVoxLoop(); }
    else if (!enabled && this.voxEnabled) { this.voxEnabled = false; this.stopVoxLoop(); if (this.isTransmitting) { this.isTransmitting = false; this.notifyVoxSpeaking(false); } this.silenceCounter = 0; }
  }

  isVoxEnabled(): boolean { return this.voxEnabled; }

  onVoxSpeakingChange(handler: VoxSpeakingHandler): () => void {
    this.voxHandlers.push(handler);
    return () => { this.voxHandlers = this.voxHandlers.filter(h => h !== handler); };
  }

  private notifyVoxSpeaking(speaking: boolean): void {
    for (const handler of this.voxHandlers) { try { handler(speaking); } catch { /* ignore */ } }
  }

  private async startVoxLoop(): Promise<void> {
    try {
      const audioSet = { AudioEncoderAndroid: opusEncoder(), AudioSourceAndroid: micSource(), OutputFormatAndroid: oggOutput(), AudioSamplingRateAndroid: 16000, AudioChannelsAndroid: 1, AudioEncodingBitRateAndroid: 8000 };
      const filePath = `${FileSystem.cacheDirectory}intercom_temp.opus`;
      await FileSystem.writeAsStringAsync(filePath, '', { encoding: FileSystem.EncodingType.Base64 });
      this.lastReadPosition = 0;
      this.audioRecorder = new (getAudioRecorderPlayer())();
      await this.audioRecorder.startRecorder(filePath, audioSet);
    } catch { this.voxEnabled = false; return; }
    if (this.voxTimer) clearInterval(this.voxTimer);
    this.voxTimer = setInterval(() => this.voxTick(), INTERCOM_FRAME_DURATION_MS);
  }

  private stopVoxLoop(): void {
    if (this.voxTimer) { clearInterval(this.voxTimer); this.voxTimer = null; }
    try { if (this.audioRecorder) { this.audioRecorder.stopRecorder(); this.audioRecorder = null; } } catch { /* ignore */ }
    this.lastReadPosition = 0;
    try { FileSystem.deleteAsync(`${FileSystem.cacheDirectory}intercom_temp.opus`, { idempotent: true }); } catch { /* ignore */ }
  }

  private async voxTick(): Promise<void> {
    try {
      const filePath = `${FileSystem.cacheDirectory}intercom_temp.opus`;
      const stat = await FileSystem.getInfoAsync(filePath);
      if (!stat.exists || !stat.size) return;
      const bytesAvailable = stat.size - this.lastReadPosition;
      if (bytesAvailable < 5) return;
      const isVoice = bytesAvailable > this.voxThreshold;
      const readLength = Math.min(bytesAvailable, INTERCOM_AUDIO_CHUNK_SIZE * 4);
      const content = await FileSystem.readAsStringAsync(filePath, { encoding: FileSystem.EncodingType.Base64, position: this.lastReadPosition, length: readLength });
      this.lastReadPosition += readLength;
      if (!content) return;
      if (isVoice) {
        this.silenceCounter = 0;
        if (!this.isTransmitting) { this.isTransmitting = true; this.notifyVoxSpeaking(true); }
        await this.broadcastChunk(content);
      } else {
        if (this.isTransmitting) {
          this.silenceCounter++;
          if (this.silenceCounter >= this.SILENCE_FRAMES_LIMIT) { this.isTransmitting = false; this.notifyVoxSpeaking(false); }
          else { await this.broadcastChunk(content); }
        }
      }
    } catch { /* ignore */ }
  }

  private async broadcastChunk(b64chunk: string): Promise<void> {
    const packet = JSON.stringify({ type: 'intercom_audio', payload: b64chunk, seq: Date.now() });
    await MeshService.sendMessage(MessageType.INTERCOM_AUDIO, packet, 'broadcast');
  }

  private async readAudioChunk(): Promise<string | null> {
    try {
      const filePath = `${FileSystem.cacheDirectory}intercom_temp.opus`;
      const stat = await FileSystem.getInfoAsync(filePath);
      if (!stat.exists || !stat.size) return null;
      const bytesAvailable = stat.size - this.lastReadPosition;
      if (bytesAvailable < INTERCOM_AUDIO_CHUNK_SIZE) return null;
      const readLength = Math.min(bytesAvailable, INTERCOM_AUDIO_CHUNK_SIZE * 4);
      const content = await FileSystem.readAsStringAsync(filePath, { encoding: FileSystem.EncodingType.Base64, position: this.lastReadPosition, length: readLength });
      this.lastReadPosition += readLength;
      return content;
    } catch { return null; }
  }

  handleIncomingAudio(data: string, peerId: string): void {
    try {
      const parsed = JSON.parse(data);
      if (parsed.type !== 'intercom_audio') return;
      this.activePeers.add(peerId);
      for (const handler of this.audioHandlers) { try { handler(parsed.payload, peerId); } catch { /* ignore */ } }
    } catch { /* ignore */ }
  }

  onAudio(handler: AudioHandler): () => void {
    this.audioHandlers.push(handler);
    return () => { this.audioHandlers = this.audioHandlers.filter(h => h !== handler); };
  }

  getIsTransmitting(): boolean { return this.isTransmitting; }
  isSomeoneTransmitting(): boolean { return this.activePeers.size > 0; }
  getActivePeers(): string[] { return Array.from(this.activePeers); }
  clearPeer(peerId: string): void { this.activePeers.delete(peerId); }

  destroy(): void {
    if (this.voxEnabled) { this.stopVoxLoop(); this.voxEnabled = false; }
    if (this.isTransmitting) this.stopTransmitting();
    if (this.unsubscribeMesh) { this.unsubscribeMesh(); this.unsubscribeMesh = null; }
    this.activePeers.clear();
    this.voxHandlers = [];
  }
}

export const IntercomService = new IntercomServiceClass();
