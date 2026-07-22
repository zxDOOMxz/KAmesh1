import { BluetoothBridge, type BluetoothDevice } from '../../native/BluetoothBridge';

export type BTCallStatus = 'idle' | 'discovering' | 'connecting' | 'connected' | 'incall';

export interface BTCallState {
  status: BTCallStatus
  devices: BluetoothDevice[]
  connectionId: string
  deviceName: string
  callActive: boolean
  muted: boolean
}

export class BluetoothCallManager {
  private bt: BluetoothBridge;
  private _state: BTCallState;
  private listeners: Set<(state: BTCallState) => void> = new Set();
  private unsubDevice: (() => void) | null = null;
  private unsubDiscovery: (() => void) | null = null;
  private unsubConnected: (() => void) | null = null;
  private unsubCallState: (() => void) | null = null;

  constructor() {
    this.bt = new BluetoothBridge();
    this._state = {
      status: 'idle',
      devices: [],
      connectionId: '',
      deviceName: '',
      callActive: false,
      muted: false,
    };
  }

  getState(): BTCallState {
    return { ...this._state, devices: [...this._state.devices] };
  }

  subscribe(cb: (state: BTCallState) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  async init(): Promise<void> {
    this.unsubDevice = this.bt.onDeviceDiscovered((device) => {
      const exists = this._state.devices.some((d) => d.address === device.address);
      if (!exists) {
        this._state.devices = [...this._state.devices, device];
        this.notify();
      }
    });

    this.unsubDiscovery = this.bt.onDiscoveryFinished(() => {
      this.setState({ status: this._state.connectionId ? 'connected' : 'idle' });
    });

    this.unsubConnected = this.bt.onConnected((conn) => {
      this.setState({
        status: 'connected',
        connectionId: conn.connectionId,
        deviceName: conn.deviceName,
      });
    });

    this.unsubCallState = this.bt.onCallState((state) => {
      if (state.state === 'connected') {
        this.setState({ callActive: true });
      } else if (state.state === 'disconnected') {
        this.setState({ callActive: false, status: 'connected' });
      }
    });
  }

  async startDiscovery(): Promise<void> {
    this.setState({ status: 'discovering', devices: [] });
    try {
      await this.bt.startDiscovery();
    } catch (e) {
      this.setState({ status: 'idle' });
    }
  }

  stopDiscovery(): void {
    this.bt.stopDiscovery();
    this.setState({ status: 'idle' });
  }

  makeDiscoverable(duration = 120): void {
    this.bt.makeDiscoverable(duration);
  }

  async startServer(): Promise<void> {
    this.setState({ status: 'connecting' });
    try {
      await this.bt.startServer();
    } catch (e) {
      this.setState({ status: 'idle' });
    }
  }

  async connectToDevice(address: string): Promise<void> {
    this.setState({ status: 'connecting' });
    try {
      await this.bt.connect(address);
    } catch (e) {
      this.setState({ status: 'idle' });
    }
  }

  async startCall(): Promise<void> {
    if (!this._state.connectionId) {return;}
    try {
      await this.bt.startCall(this._state.connectionId);
      this.setState({ callActive: true, status: 'incall' });
    } catch (e) {
      console.error('BTCall: start call failed', e);
    }
  }

  stopCall(): void {
    this.bt.stopCall();
    this.bt.setMuted(false);
    this.setState({ callActive: false, muted: false, status: 'connected' });
  }

  toggleMute(): void {
    const muted = !this._state.muted;
    this.bt.setMuted(muted);
    this.setState({ muted });
  }

  disconnect(): void {
    if (this._state.connectionId) {
      this.bt.disconnect(this._state.connectionId);
    }
    this.setState({
      status: 'idle',
      connectionId: '',
      deviceName: '',
      callActive: false,
      muted: false,
    });
  }

  destroy(): void {
    this.unsubDevice?.();
    this.unsubDiscovery?.();
    this.unsubConnected?.();
    this.unsubCallState?.();
    this.bt.stopAll();
  }

  private setState(partial: Partial<BTCallState>): void {
    this._state = { ...this._state, ...partial };
    this.notify();
  }

  private notify(): void {
    const snapshot = this.getState();
    this.listeners.forEach((cb) => cb(snapshot));
  }
}
