import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Vibration } from 'react-native';
import { getIcqWavBase64, ICQ_WAV_FILENAME } from '../utils/icqSound';

class SoundServiceClass {
  private sound: Audio.Sound | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: true, playThroughEarpieceAndroid: false });
      const wavBase64 = getIcqWavBase64();
      const wavPath = `${FileSystem.cacheDirectory}${ICQ_WAV_FILENAME}`;
      await FileSystem.writeAsStringAsync(wavPath, wavBase64, { encoding: FileSystem.EncodingType.Base64 });
      this.sound = new Audio.Sound();
      await this.sound.loadAsync({ uri: wavPath });
      await this.sound.setVolumeAsync(0.8);
      this.initialized = true;
    } catch { this.initialized = true; }
  }

  async playNotification(): Promise<void> {
    try {
      Vibration.vibrate(80);
      if (this.sound) { await this.sound.setPositionAsync(0); await this.sound.playAsync(); }
    } catch { /* ignore */ }
  }

  async destroy(): Promise<void> {
    if (this.sound) { await this.sound.unloadAsync(); this.sound = null; }
    this.initialized = false;
  }
}

export const SoundService = new SoundServiceClass();
