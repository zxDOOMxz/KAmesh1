import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GlassCard } from '../components/GlassCard';
import { NeonText } from '../components/NeonText';
import { GlassButton } from '../components/GlassButton';
import { GlassInput } from '../components/GlassInput';
import { colors, spacing } from '../theme';
import { P2PMessenger, type P2PState } from '../../core/p2p/P2PMessenger';
import { AsyncStorageAdapter } from '../../storage/AsyncStorageAdapter';

const store = new AsyncStorageAdapter();
const messenger = new P2PMessenger(store);

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const [p2p, setP2P] = useState<P2PState>(messenger.getState());
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [message, setMessage] = useState('');
  const [targetConn, setTargetConn] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    const unsub = messenger.subscribe(setP2P);
    return unsub;
  }, []);

  const handleInit = useCallback(async () => {
    try {
      await messenger.init();
    } catch (e) {
      console.error('Init failed', e);
    }
  }, []);

  const handleStartServer = useCallback(async () => {
    try {
      await messenger.startServer(0);
    } catch (e) {
      console.error('Server start failed', e);
    }
  }, []);

  const handleConnect = useCallback(async () => {
    const p = Number(port);
    if (!host || !p) {return;}
    try {
      await messenger.connect(host, p);
    } catch (e) {
      console.error('Connect failed', e);
    }
  }, [host, port]);

  const handleSend = useCallback(async () => {
    if (!message || !targetConn) {return;}
    try {
      await messenger.sendMessage(message, targetConn);
      setMessage('');
    } catch (e) {
      console.error('Send failed', e);
    }
  }, [message, targetConn]);

  const handleDisconnect = useCallback(
    async (connId: string) => {
      await messenger.disconnect(connId);
    },
    [],
  );

  const peerList = Array.from(p2p.connectedPeers.entries());

  return (
    <View style={[styles.container, { width, height }]}>
      <View style={[styles.bgGlowTop, { left: width * 0.3 }]} />
      <View style={[styles.bgGlowBottom, { right: width * 0.2 }]} />

      <Animated.View style={[styles.scroll, { opacity: fadeAnim }]}>
        {/* Header */}
        <NeonText size="h1" color={colors.neonCyan} style={{ textAlign: 'center' }}>
          SOFILINK
        </NeonText>
        <NeonText size="caption" color={colors.textSecondary} glow={false}>
          encrypted P2P messenger
        </NeonText>

        {/* Status badge */}
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

        {/* Init button */}
        {p2p.status === 'idle' && (
          <GlassButton title="Create Identity" onPress={handleInit} variant="primary" />
        )}

        {/* Server & Connect controls */}
        {p2p.status === 'running' && (
          <>
            {!p2p.serverInfo && (
              <GlassButton
                title="Start Server"
                onPress={handleStartServer}
                variant="secondary"
                style={{ marginTop: spacing.sm }}
              />
            )}
            {p2p.serverInfo && (
              <GlassCard
                borderColor={colors.neonCyanDim}
                glowColor={colors.neonCyan}
                style={{ marginTop: spacing.md }}
              >
                <NeonText size="caption" color={colors.neonCyan} glow={false}>
                  Server: {p2p.serverInfo.localIp}:{p2p.serverInfo.port}
                </NeonText>
              </GlassCard>
            )}

            {/* Connect form */}
            <GlassCard style={{ marginTop: spacing.md }}>
              <NeonText size="h2" color={colors.neonGreen} glow={false}>
                Connect to peer
              </NeonText>
              <GlassInput
                placeholder="Host (e.g. 192.168.1.5)"
                value={host}
                onChangeText={setHost}
                style={{ marginTop: spacing.sm }}
              />
              <GlassInput
                placeholder="Port"
                value={port}
                onChangeText={setPort}
                keyboardType="numeric"
                style={{ marginTop: spacing.sm }}
              />
              <GlassButton
                title="Connect"
                onPress={handleConnect}
                variant="primary"
                style={{ marginTop: spacing.sm }}
              />
            </GlassCard>

            {/* Connected peers */}
            {peerList.length > 0 && (
              <GlassCard
                borderColor={colors.neonPinkDim}
                glowColor={colors.neonPink}
                style={{ marginTop: spacing.md }}
              >
                <NeonText size="h2" color={colors.neonPink} glow={false}>
                  Peers ({peerList.length})
                </NeonText>
                {peerList.map(([connId, info]) => (
                  <View key={connId} style={styles.peerRow}>
                    <NeonText size="caption" color={colors.text} glow={false}>
                      {info.host}:{info.port}
                    </NeonText>
                    <GlassButton
                      title="Disconnect"
                      onPress={() => handleDisconnect(connId)}
                      variant="danger"
                      style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, minHeight: 32 }}
                    />
                  </View>
                ))}
              </GlassCard>
            )}

            {/* Message form */}
            {peerList.length > 0 && (
              <GlassCard style={{ marginTop: spacing.md }}>
                <NeonText size="h2" color={colors.neonCyan} glow={false}>
                  Send message
                </NeonText>
                <GlassInput
                  placeholder="Target connection ID"
                  value={targetConn}
                  onChangeText={setTargetConn}
                  style={{ marginTop: spacing.sm }}
                />
                <GlassInput
                  placeholder="Message"
                  value={message}
                  onChangeText={setMessage}
                  style={{ marginTop: spacing.sm }}
                  multiline
                />
                <GlassButton
                  title="Send Encrypted"
                  onPress={handleSend}
                  variant="primary"
                  style={{ marginTop: spacing.sm }}
                />
              </GlassCard>
            )}

            {/* Messages */}
            {p2p.messages.length > 0 && (
              <GlassCard style={{ marginTop: spacing.md, maxHeight: 200 }}>
                <NeonText size="h2" color={colors.neonGreen} glow={false}>
                  Messages ({p2p.messages.length})
                </NeonText>
                <FlatList
                  data={p2p.messages}
                  keyExtractor={(item) => item.id}
                  style={{ marginTop: spacing.sm }}
                  renderItem={({ item }) => (
                    <View style={styles.msgRow}>
                      <NeonText size="caption" color={colors.textMuted} glow={false}>
                        [{new Date(item.createdAt).toLocaleTimeString()}]
                      </NeonText>
                      <NeonText size="caption" color={colors.text} glow={false}>
                        {new TextDecoder().decode(item.ciphertext).slice(0, 120)}
                      </NeonText>
                    </View>
                  )}
                />
              </GlassCard>
            )}
          </>
        )}
      </Animated.View>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  peerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  msgRow: {
    marginBottom: spacing.xs,
  },
  bgGlowTop: {
    position: 'absolute',
    top: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.neonCyanDim,
    opacity: 0.4,
  },
  bgGlowBottom: {
    position: 'absolute',
    bottom: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.neonPinkDim,
    opacity: 0.3,
  },
});
