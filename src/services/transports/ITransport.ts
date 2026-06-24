import type { NodeId } from '../../types';

export type TransportDataHandler = (data: string, peerId: NodeId) => void;
export type TransportConnectionHandler = (peerId: NodeId, connected: boolean) => void;

export interface ITransport {
  readonly name: string;
  readonly priority: number;
  init(): Promise<void>;
  destroy(): void;
  isAvailable(): Promise<boolean>;
  send(peerId: NodeId, data: string): Promise<void>;
  broadcast(data: string): Promise<void>;
  getConnectedPeers(): NodeId[];
  isConnected(peerId: NodeId): boolean;
  getSignalStrength(peerId: NodeId): number;
  onData(handler: TransportDataHandler): () => void;
  onConnection(handler: TransportConnectionHandler): () => void;
}
