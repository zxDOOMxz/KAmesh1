import { BleService } from '../BleService';
import type { ITransport, TransportDataHandler, TransportConnectionHandler } from './ITransport';
import type { NodeId } from '../../types';

class BleTransportImpl implements ITransport {
  readonly name = 'ble';
  readonly priority = 0;

  private dataCleanup: (() => void) | null = null;
  private connectionCleanup: (() => void) | null = null;

  async init(): Promise<void> {}
  destroy(): void { this.dataCleanup?.(); this.connectionCleanup?.(); }
  async isAvailable(): Promise<boolean> { return BleService.isInitialized(); }
  async send(peerId: NodeId, data: string): Promise<void> { await BleService.sendData(peerId, data); }
  async broadcast(data: string): Promise<void> { await BleService.broadcastData(data); }
  getConnectedPeers(): NodeId[] { return BleService.getConnectedDevices(); }
  isConnected(peerId: NodeId): boolean { return BleService.isConnected(peerId); }
  getSignalStrength(peerId: NodeId): number {
    const rssi = BleService.getRssi(peerId);
    const normalized = Math.round((rssi + 100) / 70 * 100);
    return Math.max(0, Math.min(100, normalized));
  }
  onData(handler: TransportDataHandler): () => void {
    this.dataCleanup?.();
    this.dataCleanup = BleService.onData(handler);
    return () => { this.dataCleanup?.(); this.dataCleanup = null; };
  }
  onConnection(handler: TransportConnectionHandler): () => void {
    this.connectionCleanup?.();
    this.connectionCleanup = BleService.onConnection(handler);
    return () => { this.connectionCleanup?.(); this.connectionCleanup = null; };
  }
}

export const BleTransport = new BleTransportImpl();
