import { NativeModules, NativeEventEmitter } from 'react-native';

const { SofiLinkBluetooth } = NativeModules;
const eventEmitter = SofiLinkBluetooth ? new NativeEventEmitter(SofiLinkBluetooth) : null;

export interface BluetoothDevice {
  name: string
  address: string
}

export interface BluetoothConnection {
  connectionId: string
  deviceName: string
  deviceAddress: string
}

export class BluetoothBridge {
  async isEnabled(): Promise<boolean> {
    if (!SofiLinkBluetooth) {return false;}
    return SofiLinkBluetooth.isEnabled();
  }

  async enableBluetooth(): Promise<void> {
    if (!SofiLinkBluetooth) {return;}
    await SofiLinkBluetooth.enableBluetooth();
  }

  async startDiscovery(): Promise<void> {
    if (!SofiLinkBluetooth) {return;}
    await SofiLinkBluetooth.startDiscovery();
  }

  stopDiscovery(): void {
    if (!SofiLinkBluetooth) {return;}
    SofiLinkBluetooth.stopDiscovery();
  }

  makeDiscoverable(duration: number): void {
    if (!SofiLinkBluetooth) {return;}
    SofiLinkBluetooth.makeDiscoverable(duration);
  }

  async connect(deviceAddress: string): Promise<string> {
    if (!SofiLinkBluetooth) {throw new Error('Bluetooth module not available');}
    return SofiLinkBluetooth.connect(deviceAddress);
  }

  async startServer(): Promise<string> {
    if (!SofiLinkBluetooth) {throw new Error('Bluetooth module not available');}
    return SofiLinkBluetooth.startServer();
  }

  async startCall(connectionId: string): Promise<void> {
    if (!SofiLinkBluetooth) {return;}
    await SofiLinkBluetooth.startCall(connectionId);
  }

  stopCall(): void {
    if (!SofiLinkBluetooth) {return;}
    SofiLinkBluetooth.stopCall();
  }

  setMuted(muted: boolean): void {
    if (!SofiLinkBluetooth) {return;}
    SofiLinkBluetooth.setMuted(muted);
  }

  disconnect(connectionId: string): void {
    if (!SofiLinkBluetooth) {return;}
    SofiLinkBluetooth.disconnect(connectionId);
  }

  stopAll(): void {
    if (!SofiLinkBluetooth) {return;}
    SofiLinkBluetooth.stopAll();
  }

  onDeviceDiscovered(cb: (device: BluetoothDevice) => void): () => void {
    if (!eventEmitter) {
      return () => {};
    }
    const sub = eventEmitter.addListener('onBluetoothDeviceDiscovered', cb);
    return () => sub.remove();
  }

  onDiscoveryFinished(cb: () => void): () => void {
    if (!eventEmitter) {
      return () => {};
    }
    const sub = eventEmitter.addListener('onBluetoothDiscoveryFinished', cb);
    return () => sub.remove();
  }

  onConnected(cb: (conn: BluetoothConnection) => void): () => void {
    if (!eventEmitter) {
      return () => {};
    }
    const sub = eventEmitter.addListener('onBluetoothConnected', cb);
    return () => sub.remove();
  }

  onCallState(cb: (state: { state: string }) => void): () => void {
    if (!eventEmitter) {
      return () => {};
    }
    const sub = eventEmitter.addListener('onBluetoothCallState', cb);
    return () => sub.remove();
  }
}
