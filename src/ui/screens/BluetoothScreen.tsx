import { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
} from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { NeonText } from '../components/NeonText';
import { GlassButton } from '../components/GlassButton';
import { colors, spacing } from '../theme';
import { BluetoothCallManager, type BTCallState } from '../../core/bluetooth/BluetoothCallManager';

const btCallManager = new BluetoothCallManager();

export default function BluetoothScreen() {
  const [bt, setBT] = useState<BTCallState>(btCallManager.getState());

  useEffect(() => {
    btCallManager.init();
    const unsub = btCallManager.subscribe(setBT);
    return unsub;
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

  const handleBTConnect = useCallback(async (address: string) => {
    await btCallManager.connectToDevice(address);
  }, []);

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

  return (
    <View style={styles.container}>
      <NeonText size="h1" color={colors.neonBlue} style={{ textAlign: 'center' }}>
        BLUETOOTH
      </NeonText>
      <NeonText size="caption" color={colors.textSecondary} glow={false}>
        direct audio calls
      </NeonText>

      {/* Status */}
      <View style={styles.statusRow}>
        <View
          style={[
            styles.dot,
            {
              backgroundColor:
                bt.status === 'connected' || bt.status === 'incall'
                  ? colors.neonGreen
                  : bt.status === 'connecting'
                    ? colors.neonBlue
                    : bt.status === 'discovering'
                      ? colors.neonCyan
                      : colors.textMuted,
            },
          ]}
        />
        <NeonText size="caption" color={colors.textMuted} glow={false}>
          {bt.status === 'idle'
            ? 'ready'
            : bt.status === 'discovering'
              ? 'scanning...'
              : bt.status === 'connecting'
                ? 'connecting...'
                : bt.status === 'connected'
                  ? `connected: ${bt.deviceName}`
                  : bt.status === 'incall'
                    ? 'in call'
                    : ''}
        </NeonText>
      </View>

      {/* Server / Discoverable */}
      {bt.status === 'idle' && (
        <>
          <GlassCard style={{ marginTop: spacing.md }}>
            <NeonText size="h2" color={colors.neonBlue} glow={false}>
              Connect
            </NeonText>
            <View style={styles.btActions}>
              <GlassButton
                title="Scan Devices"
                onPress={handleBTDiscovery}
                variant="primary"
                style={styles.btBtn}
              />
              <GlassButton
                title="Be Discoverable"
                onPress={handleBTStartServer}
                variant="secondary"
                style={styles.btBtn}
              />
            </View>
          </GlassCard>
        </>
      )}

      {/* Scanning */}
      {bt.status === 'discovering' && (
        <GlassCard style={{ marginTop: spacing.md }}>
          <NeonText size="h2" color={colors.neonCyan} glow={false}>
            Scanning...
          </NeonText>
          <GlassButton
            title="Stop"
            onPress={handleBTStopDiscovery}
            variant="danger"
            style={{ marginTop: spacing.sm }}
          />
          {bt.devices.length > 0 && (
            <FlatList
              data={bt.devices}
              keyExtractor={(item) => item.address}
              style={{ marginTop: spacing.sm }}
              renderItem={({ item }) => (
                <View style={styles.deviceRow}>
                  <View>
                    <NeonText size="body" color={colors.text} glow={false}>
                      {item.name}
                    </NeonText>
                    <NeonText size="caption" color={colors.textMuted} glow={false}>
                      {item.address}
                    </NeonText>
                  </View>
                  <GlassButton
                    title="Connect"
                    onPress={() => handleBTConnect(item.address)}
                    variant="primary"
                    style={styles.smallBtn}
                  />
                </View>
              )}
            />
          )}
          {bt.devices.length === 0 && (
            <NeonText size="caption" color={colors.textMuted} glow={false} style={{ marginTop: spacing.md }}>
              No devices found yet...
            </NeonText>
          )}
        </GlassCard>
      )}

      {/* Connecting */}
      {bt.status === 'connecting' && (
        <GlassCard style={{ marginTop: spacing.md }}>
          <NeonText size="h2" color={colors.neonBlue} glow={false}>
            Connecting...
          </NeonText>
        </GlassCard>
      )}

      {/* Connected */}
      {bt.status === 'connected' && (
        <GlassCard borderColor={colors.neonGreenDim} glowColor={colors.neonGreen} style={{ marginTop: spacing.md }}>
          <NeonText size="h2" color={colors.neonGreen} glow={false}>
            Connected
          </NeonText>
          <NeonText size="caption" color={colors.text} glow={false}>
            Device: {bt.deviceName}
          </NeonText>
          <View style={styles.btActions}>
            <GlassButton
              title="Call"
              onPress={handleBTCall}
              variant="primary"
              style={styles.btBtn}
            />
            <GlassButton
              title="Disconnect"
              onPress={handleBTDisconnect}
              variant="danger"
              style={styles.btBtn}
            />
          </View>
        </GlassCard>
      )}

      {/* In-call */}
      {bt.status === 'incall' && (
        <GlassCard borderColor={colors.neonPinkDim} glowColor={colors.neonPink} style={{ marginTop: spacing.md }}>
          <NeonText size="h2" color={colors.neonPink} glow={false}>
            In Call
          </NeonText>
          <NeonText size="caption" color={colors.text} glow={false}>
            {bt.deviceName} {bt.muted ? '(muted)' : ''}
          </NeonText>
          <View style={styles.btActions}>
            <GlassButton
              title={bt.muted ? 'Unmute' : 'Mute'}
              onPress={handleBTMute}
              variant="secondary"
              style={styles.btBtn}
            />
            <GlassButton
              title="Hang Up"
              onPress={handleBTStopCall}
              variant="danger"
              style={styles.btBtn}
            />
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
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  btActions: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  btBtn: {
    flex: 1,
    minWidth: 120,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  smallBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 32,
  },
});
