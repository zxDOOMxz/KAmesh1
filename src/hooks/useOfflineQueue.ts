import { useEffect, useRef } from 'react';
import { MeshService } from '../services/MeshService';
import { BleService } from '../services/BleService';

export function useOfflineQueue(): void {
  const processedRef = useRef<string[]>([]);

  useEffect(() => {
    const unsubConnection = BleService.onConnection((peripheralId, connected) => {
      if (connected && !processedRef.current.includes(peripheralId)) {
        processedRef.current.push(peripheralId);
        MeshService.processPendingQueue().catch(() => {});

        setTimeout(() => {
          processedRef.current = processedRef.current.filter(
            id => id !== peripheralId,
          );
        }, 300_000);
      }
    });

    return () => {
      unsubConnection();
    };
  }, []);
}
