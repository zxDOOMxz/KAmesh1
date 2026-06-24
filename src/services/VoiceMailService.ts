import uuidv4 from 'react-native-uuid';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import * as FileSystem from 'expo-file-system';
import { MessageType, MeshPacket } from '../types';
import { BLE_PAYLOAD_LIMIT, VOICE_MAX_FRAGMENTS } from '../constants';
import { MeshService } from './MeshService';

const MAX_RECORDING_DURATION_MS = 30_000;
const ASSEMBLY_TIMEOUT_MS = 300_000;
const TEMP_OPUS_FILE = 'voice_temp.opus';

const audioRecorderPlayer = new AudioRecorderPlayer();
let recordingStartTime = 0;

const assemblyBuffer = new Map<string, {
  chunks: string[];
  total: number;
  received: number;
  metadata: { duration: number };
  createdAt: number;
}>();

export async function startRecording(): Promise<string> {
  const path = `${FileSystem.cacheDirectory}${TEMP_OPUS_FILE}`;
  const audioSet = { AudioEncoderAndroid: 'opus', AudioSourceAndroid: 'mic', AVEncoderAudioQualityKeyIOS: 'high', AVNumberOfChannelsKeyIOS: 1, AVSampleRateConverterAudioQualityKeyIOS: 'high', AVEncoderBitRateKeyIOS: 8000, AVSampleRateKeyIOS: 16000, AVFormatIDKeyIOS: 'opus', OutputFormatAndroid: 'opus', SampleRate: 16000, NumberOfChannels: 1, BitRate: 8000 } as Record<string, string | number>;
  await audioRecorderPlayer.startRecorder(path, audioSet);
  recordingStartTime = Date.now();
  return path;
}

export async function stopRecording(): Promise<{ path: string; duration: number }> {
  const result = await audioRecorderPlayer.stopRecorder();
  return { path: result, duration: Math.floor((Date.now() - recordingStartTime) / 1000) };
}

export async function fragmentAndSendVoiceMail(filePath: string, targetId: string, duration: number): Promise<void> {
  const base64Content = await FileSystem.readAsStringAsync(filePath, { encoding: FileSystem.EncodingType.Base64 });
  const totalBytes = base64Content.length;
  const totalFragments = Math.ceil(totalBytes / BLE_PAYLOAD_LIMIT);
  if (totalFragments > VOICE_MAX_FRAGMENTS) throw new Error(`Too many fragments: ${totalFragments}`);
  const sessionId = uuidv4.v4();

  await MeshService.sendMessage(MessageType.VOICE_MAIL, JSON.stringify({ duration, totalFragments, sessionId, fileName: 'voice.opus' }), targetId, { fragmentIndex: 0, fragmentTotal: totalFragments + 1, fragmentSessionId: sessionId });

  for (let i = 0; i < totalFragments; i++) {
    const start = i * BLE_PAYLOAD_LIMIT;
    const end = Math.min(start + BLE_PAYLOAD_LIMIT, totalBytes);
    await MeshService.sendMessage(MessageType.VOICE_MAIL_CHUNK, base64Content.slice(start, end), targetId, { fragmentIndex: i + 1, fragmentTotal: totalFragments + 1, fragmentSessionId: sessionId });
  }
}

export async function processIncomingFragment(packet: MeshPacket): Promise<string | null> {
  if (!packet.fragmentSessionId || packet.fragmentIndex === undefined || packet.fragmentTotal === undefined) return null;

  const { fragmentSessionId, fragmentIndex, fragmentTotal, payload } = packet;
  const now = Date.now();

  for (const [sid, buf] of assemblyBuffer) { if (now - buf.createdAt > ASSEMBLY_TIMEOUT_MS) assemblyBuffer.delete(sid); }

  if (!assemblyBuffer.has(fragmentSessionId)) {
    assemblyBuffer.set(fragmentSessionId, { chunks: new Array(fragmentTotal).fill(''), total: fragmentTotal, received: 0, metadata: { duration: 0 }, createdAt: now });
  }
  const buffer = assemblyBuffer.get(fragmentSessionId)!;

  if (fragmentIndex === 0) {
    try { const meta = JSON.parse(payload); buffer.metadata = { duration: meta.duration || 0 }; } catch { /* ignore */ }
    buffer.received += 1;
  } else {
    if (!buffer.chunks[fragmentIndex]) { buffer.chunks[fragmentIndex] = payload; buffer.received += 1; }
  }

  if (buffer.received === buffer.total) {
    const assembledBase64 = buffer.chunks.join('');
    const outputPath = `${FileSystem.cacheDirectory}received_voice_${fragmentSessionId}.opus`;
    await FileSystem.writeAsStringAsync(outputPath, assembledBase64, { encoding: FileSystem.EncodingType.Base64 });
    assemblyBuffer.delete(fragmentSessionId);
    return outputPath;
  }
  return null;
}

export async function playVoiceMail(filePath: string): Promise<void> { await audioRecorderPlayer.startPlayer(filePath); }
export async function stopPlayback(): Promise<void> { await audioRecorderPlayer.stopPlayer(); }
