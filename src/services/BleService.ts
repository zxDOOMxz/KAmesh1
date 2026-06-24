import BleManager, { BleManagerDidUpdateValueForCharacteristicEvent, Peripheral } from 'react-native-ble-manager';
import { NativeEventEmitter, NativeModules, Platform, PermissionsAndroid } from 'react-native';
import { BLE_MTU, BLE_CONNECT_TIMEOUT_MS, BLE_PAYLOAD_LIMIT, BLE_SCAN_DURATION_MS, BLE_SCAN_INTERVAL_MS } from '../constants';
import { withTimeout } from '../utils/timeout';
import { BLE_SERVICE_UUID, BLE_TX_CHAR_UUID, BLE_RX_CHAR_UUID } from '../types';

type DataHandler = (data: string, peripheralId: string) => void;
type ConnectionHandler = (peripheralId: string, connected: boolean) => void;
type DiscoveryHandler = (peripheral: Peripheral) => void;

class BleServiceClass {
  private initialized = false;
  private connectedDevices = new Set<string>();
  private dataHandlers: DataHandler[] = [];
  private connectionHandlers: ConnectionHandler[] = [];
  private discoveryHandlers: DiscoveryHandler[] = [];
  private scanTimer: ReturnType<typeof setInterval> | null = null;
  private isScanning = false;
  private rssiMap = new Map<string, number>();
  private fragmentBuffer = new Map<string, { chunks: string[]; total: number; received: number }>();

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      if (Platform.OS === 'android') {
        await this.requestAndroidPermissions();
      }
      await BleManager.start({ showAlert: false });
      const eventEmitter = new NativeEventEmitter(NativeModules.BleManager);

      eventEmitter.addListener('BleManagerDiscoverPeripheral', this.handleDiscovery.bind(this));
      eventEmitter.addListener('BleManagerConnectPeripheral', (event: { peripheral: string }) => {
        this.connectedDevices.add(event.peripheral);
        this.notifyConnection(event.peripheral, true);
      });
      eventEmitter.addListener('BleManagerDisconnectPeripheral', (event: { peripheral: string }) => {
        this.connectedDevices.delete(event.peripheral);
        this.notifyConnection(event.peripheral, false);
      });
      eventEmitter.addListener('BleManagerDidUpdateValueForCharacteristic', this.handleIncomingData.bind(this));

      this.initialized = true;
    } catch (err) {
      console.warn('[BleService] init error:', err);
      throw err;
    }
  }

  startScanning(): void {
    if (this.scanTimer) return;
    const scan = async () => {
      try {
        if (this.isScanning) return;
        this.isScanning = true;
        await BleManager.scan({ serviceUUIDs: [BLE_SERVICE_UUID], seconds: BLE_SCAN_DURATION_MS / 1000 });
        setTimeout(() => { this.isScanning = false; }, BLE_SCAN_DURATION_MS + 500);
      } catch (err) {
        this.isScanning = false;
      }
    };
    scan();
    this.scanTimer = setInterval(scan, BLE_SCAN_INTERVAL_MS);
  }

  stopScanning(): void {
    if (this.scanTimer) { clearInterval(this.scanTimer); this.scanTimer = null; }
    this.isScanning = false;
    BleManager.stopScan().catch(() => {});
  }

  async scanOnce(durationMs: number = BLE_SCAN_DURATION_MS): Promise<void> {
    try { await BleManager.scan({ serviceUUIDs: [BLE_SERVICE_UUID], seconds: durationMs / 1000 }); }
    catch { /* ignore */ }
  }

  async connectToDevice(peripheralId: string): Promise<void> {
    try {
      if (this.connectedDevices.has(peripheralId)) return;
      await withTimeout(BleManager.connect(peripheralId), BLE_CONNECT_TIMEOUT_MS, `BLE connect ${peripheralId}`);
      await withTimeout(BleManager.retrieveServices(peripheralId), BLE_CONNECT_TIMEOUT_MS, `BLE retrieve ${peripheralId}`);
      if (Platform.OS === 'android') {
        try { await withTimeout(BleManager.requestMTU(peripheralId, BLE_MTU), 5_000, `MTU ${peripheralId}`); }
        catch { /* ignore */ }
      }
      await withTimeout(BleManager.startNotification(peripheralId, BLE_SERVICE_UUID, BLE_RX_CHAR_UUID), 5_000, `Notification ${peripheralId}`);
      this.connectedDevices.add(peripheralId);
    } catch (err) {
      console.warn(`[BleService] connect ${peripheralId} error:`, err);
      throw err;
    }
  }

  async disconnectFromDevice(peripheralId: string): Promise<void> {
    try {
      await BleManager.disconnect(peripheralId, false);
      this.connectedDevices.delete(peripheralId);
    } catch { /* ignore */ }
  }

  async sendData(peripheralId: string, data: string): Promise<void> {
    try {
      if (!this.connectedDevices.has(peripheralId)) {
        throw new Error(`Device ${peripheralId} not connected`);
      }
      const encoded = await stringToBase64(data);
      if (encoded.length <= BLE_PAYLOAD_LIMIT) {
        await this.writeCharacteristic(peripheralId, encoded);
        return;
      }
      const sessionId = `${Date.now()}_${peripheralId}`;
      const totalFragments = Math.ceil(encoded.length / BLE_PAYLOAD_LIMIT);
      for (let i = 0; i < totalFragments; i++) {
        const start = i * BLE_PAYLOAD_LIMIT;
        const end = Math.min(start + BLE_PAYLOAD_LIMIT, encoded.length);
        const chunk = encoded.slice(start, end);
        const fragmentPacket = `${sessionId}|${i}|${totalFragments}|${chunk}`;
        await this.writeCharacteristic(peripheralId, fragmentPacket);
      }
    } catch (err) {
      console.warn(`[BleService] sendData ${peripheralId}:`, err);
      throw err;
    }
  }

  async broadcastData(data: string): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const devId of this.connectedDevices) {
      promises.push(this.sendData(devId, data).catch(() => {}));
    }
    await Promise.all(promises);
  }

  onData(handler: DataHandler): () => void {
    this.dataHandlers.push(handler);
    return () => { this.dataHandlers = this.dataHandlers.filter(h => h !== handler); };
  }

  onConnection(handler: ConnectionHandler): () => void {
    this.connectionHandlers.push(handler);
    return () => { this.connectionHandlers = this.connectionHandlers.filter(h => h !== handler); };
  }

  onDiscovery(handler: DiscoveryHandler): () => void {
    this.discoveryHandlers.push(handler);
    return () => { this.discoveryHandlers = this.discoveryHandlers.filter(h => h !== handler); };
  }

  getConnectedDevices(): string[] { return Array.from(this.connectedDevices); }
  isInitialized(): boolean { return this.initialized; }
  isConnected(peripheralId: string): boolean { return this.connectedDevices.has(peripheralId); }
  getRssi(peripheralId: string): number { return this.rssiMap.get(peripheralId) ?? -100; }

  private async writeCharacteristic(peripheralId: string, base64Data: string): Promise<void> {
    const dataBytes = await base64ToArrayBuffer(base64Data);
    await BleManager.writeWithoutResponse(
      peripheralId, BLE_SERVICE_UUID, BLE_TX_CHAR_UUID,
      Array.from(new Uint8Array(dataBytes)), 512,
    );
  }

  private handleIncomingData(event: BleManagerDidUpdateValueForCharacteristicEvent): void {
    try {
      const { peripheral, value } = event;
      if (!value || !Array.isArray(value)) return;
      const uint8 = new Uint8Array(value);
      const rawData = bytesToBase64(uint8);
      const parts = rawData.split('|');
      if (parts.length === 4 && /^\d+$/.test(parts[1]) && /^\d+$/.test(parts[2])) {
        const [sessionId, indexStr, totalStr, chunkData] = parts;
        this.processFragment(sessionId, parseInt(indexStr, 10), parseInt(totalStr, 10), chunkData, peripheral);
      } else {
        const decodedBytes = base64ToBytes(rawData);
        const decoded = new TextDecoder().decode(decodedBytes);
        this.notifyDataHandlers(decoded, peripheral);
      }
    } catch { /* ignore */ }
  }

  private processFragment(sessionId: string, index: number, total: number, chunkData: string, peripheral: string): void {
    try {
      let buffer = this.fragmentBuffer.get(sessionId);
      if (!buffer) {
        buffer = { chunks: new Array(total).fill(''), total, received: 0 };
        this.fragmentBuffer.set(sessionId, buffer);
      }
      if (!buffer.chunks[index]) {
        buffer.chunks[index] = chunkData;
        buffer.received += 1;
      }
      if (buffer.received === buffer.total) {
        const assembled = buffer.chunks.join('');
        const decodedBytes = base64ToBytes(assembled);
        const decoded = new TextDecoder().decode(decodedBytes);
        this.fragmentBuffer.delete(sessionId);
        this.notifyDataHandlers(decoded, peripheral);
      }
    } catch { this.fragmentBuffer.delete(sessionId); }
  }

  private notifyDataHandlers(data: string, peripheralId: string): void {
    for (const handler of this.dataHandlers) {
      try { handler(data, peripheralId); } catch { /* ignore */ }
    }
  }

  private notifyConnection(peripheralId: string, connected: boolean): void {
    for (const handler of this.connectionHandlers) {
      try { handler(peripheralId, connected); } catch { /* ignore */ }
    }
  }

  private handleDiscovery(event: Peripheral): void {
    try {
      this.rssiMap.set(event.id, event.rssi);
      for (const handler of this.discoveryHandlers) {
        try { handler(event); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }

  private async requestAndroidPermissions(): Promise<void> {
    try {
      const apiLevel = Platform.Version;
      if (typeof apiLevel === 'number' && apiLevel >= 31) {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
      } else {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      }
    } catch { /* ignore */ }
  }
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = i + 1 < bytes.length ? bytes[i + 1] : 0, c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    result += BASE64_CHARS[a >> 2] + BASE64_CHARS[((a & 3) << 4) | (b >> 4)];
    result += i + 1 < bytes.length ? BASE64_CHARS[((b & 15) << 2) | (c >> 6)] : '=';
    result += i + 2 < bytes.length ? BASE64_CHARS[c & 63] : '=';
  }
  return result;
}

function base64ToBytes(b64: string): Uint8Array {
  const sanitized = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = Math.floor((sanitized.length * 3) / 4);
  const uint8 = new Uint8Array(len);
  let j = 0;
  for (let i = 0; i < sanitized.length; i += 4) {
    const a = BASE64_CHARS.indexOf(sanitized[i]), b = BASE64_CHARS.indexOf(sanitized[i + 1]);
    const c = BASE64_CHARS.indexOf(sanitized[i + 2]), d = BASE64_CHARS.indexOf(sanitized[i + 3]);
    uint8[j++] = (a << 2) | (b >> 4);
    if (c !== -1) uint8[j++] = ((b & 15) << 4) | (c >> 2);
    if (d !== -1) uint8[j++] = ((c & 3) << 6) | d;
  }
  return uint8.slice(0, j);
}

async function stringToBase64(str: string): Promise<string> {
  return bytesToBase64(new TextEncoder().encode(str));
}

async function base64ToArrayBuffer(b64: string): Promise<ArrayBuffer> {
  return base64ToBytes(b64).buffer;
}

export const BleService = new BleServiceClass();
