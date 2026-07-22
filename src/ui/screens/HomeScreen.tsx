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
import { CallManager } from '../../core/call/CallManager';
import { CallScreen } from './CallScreen';
import type { CallState } from '../../core/call/types';
import { BluetoothCallManager, type BTCallState } from '../../core/bluetooth/BluetoothCallManager';

const store = new AsyncStorageAdapter();
const messenger = new P2PMessenger(store);
const callManager = new CallManager();
const btCallManager = new BluetoothCallManager();

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const [p2p, setP2P] = useState<P2PState>(messenger.getState());
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [message, setMessage] = useState('');
  const [targetConn, setTargetConn] = useState('');
  const [call, setCall] = useState<CallState>(callManager.getState());
  const [bt, setBT] = useState<BTCallState>(btCallManager.getState());
  const [tab, setTab] = useState<'mesh' | 'bt'>('mesh');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    const unsubP2P = messenger.subscribe(setP2P);
    callManager.init();
    const unsubCall = callManager.subscribe(setCall);
    btCallManager.init();
    const unsubBT = btCallManager.subscribe(setBT);
    return () => {
      unsubP2P();
      unsubCall();
      unsubBT();
    };
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

  const handleCall = useCallback(
    async (connId: string, peerId: string) => {
      await callManager.startCall(connId, peerId);
    },
    [],
  );

  const handleAcceptCall = useCallback(async () => {
    await callManager.acceptCall();
  }, []);

  const handleRejectCall = useCallback(async () => {
    await callManager.rejectCall();
  }, []);

  const handleEndCall = useCallback(async () => {
    await callManager.endCall();
  }, []);

  const handleToggleMute = useCallback(async () => {
    await callManager.toggleMute();
  }, []);

  const handleBTDiscovery = useCallback(async () => {
    await btCallManager.startDiscovery();
  }, []);

  const handleBTStopDiscovery = useCallback(() => {
    btCallManager.stopDiscovery();
  }, []);

  const handleBTStartServer = useCallback(async () => {
    btCallManager.makeDiscoverable();
    await btCallManager.startServer();
  }, []);

  const handleBTConnect = useCallback(
    async (address: string) => {
      await btCallManager.connectToDevice(address);
    },
    [],
  );

  const handleBTCall = useCallback(async () => {
    await btCallManager.startCall();
  }, []);

  const handleBTStopCall = useCallback(() => {
    btCallManager.stopCall();
  }, []);

  const handleBTMute = useCallback(() => {
    btCallManager.toggleMute();
  }, []);

  const handleBTDisconnect = useCallback(() => {
    btCallManager.disconnect();
  }, []);

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

        {/* Tab toggle */}
        <View style={styles.tabRow}>
          <GlassButton
            title="Mesh"
            onPress={() => setTab('mesh')}
            variant={tab === 'mesh' ? 'primary' : 'secondary'}
            style={styles.tabBtn}
          />
          <GlassButton
            title="Bluetooth"
            onPress={() => setTab('bt')}
            variant={tab === 'bt' ? 'primary' : 'secondary'}
            style={styles.tabBtn}
          />
        </View>

        {/* Init button */}
        {p2p.status === 'idle' && tab === 'mesh' && (
          <GlassButton title="Create Identity" onPress={handleInit} variant="primary" />
        )}

        {/* Server & Connect controls */}
        {p2p.status === 'running' && tab === 'mesh' && (
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
                    <View style={styles.peerActions}>
                      <GlassButton
                        title="Call"
                        onPress={() => handleCall(connId, connId)}
                        variant="primary"
                        style={styles.smallBtn}
                      />
                      <GlassButton
                        title="X"
                        onPress={() => handleDisconnect(connId)}
                        variant="danger"
                        style={styles.smallBtn}
                      />
                    </View>
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
                        {decodeBytes(item.ciphertext).slice(0, 120)}
                      </NeonText>
                    </View>
                  )}
                />
              </GlassCard>
            )}
          </>
        )}

        {/* Bluetooth tab */}
        {tab === 'bt' && (
          <>
            {/* Server / Discoverable */}
            {bt.status === 'idle' && (
              <View style={styles.btActions}>
                <GlassButton title="Scan Devices" onPress={handleBTDiscovery} variant="primary" style={styles.btBtn} />
                <GlassButton title="Be Discoverable" onPress={handleBTStartServer} variant="secondary" style={styles.btBtn} />
              </View>
            )}

            {/* Scanning */}
            {bt.status === 'discovering' && (
              <GlassCard style={{ marginTop: spacing.md }}>
                <NeonText size="h2" color={colors.neonCyan} glow={false}>Scanning...</NeonText>
                <GlassButton title="Stop" onPress={handleBTStopDiscovery} variant="danger" style={{ marginTop: spacing.sm }} />
                {bt.devices.length > 0 && (
                  <>
                    {bt.devices.map((d) => (
                      <View key={d.address} style={styles.deviceRow}>
                        <NeonText size="caption" color={colors.text} glow={false}>{d.name}</NeonText>
                        <GlassButton title="Connect" onPress={() => handleBTConnect(d.address)} variant="primary" style={styles.smallBtn} />
                      </View>
                    ))}
                  </>
                )}
              </GlassCard>
            )}

            {/* Connecting */}
            {bt.status === 'connecting' && (
              <NeonText size="h2" color={colors.neonBlue} glow={false}>Connecting...</NeonText>
            )}

            {/* Connected */}
            {bt.status === 'connected' && (
              <GlassCard borderColor={colors.neonGreenDim} glowColor={colors.neonGreen} style={{ marginTop: spacing.md }}>
                <NeonText size="h2" color={colors.neonGreen} glow={false}>Bluetooth</NeonText>
                <NeonText size="caption" color={colors.text} glow={false}>Connected to: {bt.deviceName}</NeonText>
                <View style={styles.btActions}>
                  {!bt.callActive && (
                    <GlassButton title="Call" onPress={handleBTCall} variant="primary" style={styles.btBtn} />
                  )}
                  {bt.callActive && (
                    <>
                      <GlassButton title={bt.muted ? 'Unmute' : 'Mute'} onPress={handleBTMute} variant="secondary" style={styles.btBtn} />
                      <GlassButton title="Hang Up" onPress={handleBTStopCall} variant="danger" style={styles.btBtn} />
                    </>
                  )}
                  <GlassButton title="Disconnect" onPress={handleBTDisconnect} variant="danger" style={styles.btBtn} />
                </View>
              </GlassCard>
            )}

            {/* In-call status */}
            {bt.status === 'incall' && (
              <GlassCard borderColor={colors.neonPinkDim} glowColor={colors.neonPink} style={{ marginTop: spacing.md }}>
                <NeonText size="h2" color={colors.neonPink} glow={false}>In Call</NeonText>
                <NeonText size="caption" color={colors.text} glow={false}>{bt.muted ? '(muted)' : ''}</NeonText>
                <View style={styles.btActions}>
                  <GlassButton title={bt.muted ? 'Unmute' : 'Mute'} onPress={handleBTMute} variant="secondary" style={styles.btBtn} />
                  <GlassButton title="Hang Up" onPress={handleBTStopCall} variant="danger" style={styles.btBtn} />
                </View>
              </GlassCard>
            )}
          </>
        )}
      </Animated.View>
      <StatusBar style="light" />

      {call.status !== 'idle' && (
        <CallScreen
          call={call}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
          onEnd={handleEndCall}
          onToggleMute={handleToggleMute}
        />
      )}
    </View>
  );
}

function decodeBytes(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i]);
  }
  return result;
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
  peerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  smallBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 32,
  },
  msgRow: {
    marginBottom: spacing.xs,
  },
  tabRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    minHeight: 40,
  },
  btActions: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  btBtn: {
    flex: 1,
    minWidth: 100,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: 40,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
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
