import { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { NeonText } from '../components/NeonText';
import { GlassButton } from '../components/GlassButton';
import { colors, spacing } from '../theme';
import { P2PMessenger, type P2PState } from '../../core/p2p/P2PMessenger';
import { AsyncStorageAdapter } from '../../storage/AsyncStorageAdapter';

const store = new AsyncStorageAdapter();
const messenger = new P2PMessenger(store);

interface PeerInfo {
  connectionId: string;
  host: string;
  port: number;
  status: 'connected' | 'connecting' | 'disconnected';
  lastSeen: number;
}

export default function PeersScreen() {
  const [p2p, setP2P] = useState<P2PState>(messenger.getState());
  const [peers, setPeers] = useState<PeerInfo[]>([]);

  useEffect(() => {
    const unsub = messenger.subscribe(setP2P);
    return unsub;
  }, []);

  useEffect(() => {
    const peerList: PeerInfo[] = Array.from(p2p.connectedPeers.entries()).map(([connId, info]) => ({
      connectionId: connId,
      host: info.host,
      port: info.port,
      status: 'connected',
      lastSeen: Date.now(),
    }));
    setPeers(peerList);
  }, [p2p.connectedPeers]);

  const handleDisconnect = (connectionId: string) => {
    messenger.disconnect(connectionId);
  };

  const renderPeer = ({ item }: { item: PeerInfo }) => (
    <GlassCard style={styles.peerCard}>
      <View style={styles.peerHeader}>
        <View style={styles.peerInfo}>
          <View style={styles.statusDot}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor:
                    item.status === 'connected'
                      ? colors.neonGreen
                      : item.status === 'connecting'
                        ? colors.neonCyan
                        : colors.textMuted,
                },
              ]}
            />
          </View>
          <View>
            <NeonText size="body" color={colors.text} glow={false}>
              {item.host}:{item.port}
            </NeonText>
            <NeonText size="caption" color={colors.textMuted} glow={false}>
              {item.status} • Last seen: {new Date(item.lastSeen).toLocaleTimeString()}
            </NeonText>
          </View>
        </View>
        <GlassButton
          title="X"
          onPress={() => handleDisconnect(item.connectionId)}
          variant="danger"
          style={styles.disconnectBtn}
        />
      </View>

      <View style={styles.peerActions}>
        <GlassButton
          title="Message"
          onPress={() => {}}
          variant="secondary"
          style={styles.actionBtn}
        />
        <GlassButton
          title="Call"
          onPress={() => {}}
          variant="primary"
          style={styles.actionBtn}
        />
      </View>
    </GlassCard>
  );

  return (
    <View style={styles.container}>
      <NeonText size="h1" color={colors.neonPink} style={{ textAlign: 'center' }}>
        PEERS
      </NeonText>
      <NeonText size="caption" color={colors.textSecondary} glow={false}>
        {peers.length} connected device{peers.length !== 1 ? 's' : ''}
      </NeonText>

      {/* Status */}
      <View style={styles.statusRow}>
        <View
          style={[
            styles.dot,
            {
              backgroundColor:
                p2p.status === 'running'
                  ? colors.neonGreen
                  : p2p.status === 'error'
                    ? colors.error
                    : colors.textMuted,
            },
          ]}
        />
        <NeonText size="caption" color={colors.textMuted} glow={false}>
          {p2p.status === 'idle'
            ? 'not initialized'
            : p2p.status === 'starting'
              ? 'initializing...'
              : p2p.status === 'error'
                ? 'error'
                : p2p.peerId
                  ? `ID: ${p2p.peerId.slice(0, 16)}...`
                  : 'running'}
        </NeonText>
      </View>

      {/* Peers List */}
      {peers.length > 0 ? (
        <FlatList
          data={peers}
          keyExtractor={(item) => item.connectionId}
          renderItem={renderPeer}
          style={{ marginTop: spacing.md }}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <GlassCard style={{ marginTop: spacing.md }}>
          <NeonText size="h2" color={colors.textMuted} glow={false} style={{ textAlign: 'center' }}>
            No peers connected
          </NeonText>
          <NeonText size="caption" color={colors.textMuted} glow={false} style={{ textAlign: 'center', marginTop: spacing.sm }}>
            Go to Mesh tab to discover and connect peers
          </NeonText>
        </GlassCard>
      )}

      {/* Peer Statistics */}
      {peers.length > 0 && (
        <GlassCard style={{ marginTop: spacing.md }}>
          <NeonText size="h2" color={colors.neonCyan} glow={false}>
            Statistics
          </NeonText>
          <View style={styles.statRow}>
            <NeonText size="caption" color={colors.textMuted} glow={false}>
              Total Connected:
            </NeonText>
            <NeonText size="caption" color={colors.neonCyan} glow>
              {peers.length}
            </NeonText>
          </View>
          <View style={styles.statRow}>
            <NeonText size="caption" color={colors.textMuted} glow={false}>
              Server Status:
            </NeonText>
            <NeonText size="caption" color={p2p.serverInfo ? colors.neonGreen : colors.textMuted} glow={false}>
              {p2p.serverInfo ? `${p2p.serverInfo.localIp}:${p2p.serverInfo.port}` : 'Not running'}
            </NeonText>
          </View>
        </GlassCard>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  statusDot: {
    marginRight: spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  peerCard: {
    marginBottom: spacing.sm,
  },
  peerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  peerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  peerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    minHeight: 40,
  },
  disconnectBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 32,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
});
