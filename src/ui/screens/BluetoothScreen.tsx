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
import { useLocale } from '../../i18n/LocaleContext';

const btCallManager = new BluetoothCallManager();

export default function BluetoothScreen() {
  const { t } = useLocale();
  const [bt, setBT] = useState<BTCallState>(btCallManager.getState());

  useEffect(() => {
    btCallManager.init().catch((e) => {
      console.error('BluetoothCallManager init error:', e);
    });
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

  const handleBTCancelConnect = useCallback(() => {
    btCallManager.disconnect();
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
        {t('bt_title')}
      </NeonText>
      <NeonText size="caption" color={colors.textSecondary} glow={false}>
        {t('bt_subtitle')}
      </NeonText>

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
            ? t('bt_status_ready')
            : bt.status === 'discovering'
              ? t('bt_status_scanning')
              : bt.status === 'connecting'
                ? t('bt_status_connecting')
                : bt.status === 'connected'
                  ? `${t('bt_status_connected')}: ${bt.deviceName}`
                  : bt.status === 'incall'
                    ? t('bt_status_incall')
                    : ''}
        </NeonText>
      </View>

      {bt.status === 'idle' && (
        <GlassCard style={{ marginTop: spacing.md }}>
          <NeonText size="h2" color={colors.neonBlue} glow={false}>
            {t('bt_connect')}
          </NeonText>
          <View style={styles.btActions}>
            <GlassButton
              title={t('bt_scan_devices')}
              onPress={handleBTDiscovery}
              variant="primary"
              style={styles.btBtn}
            />
            <GlassButton
              title={t('bt_be_discoverable')}
              onPress={handleBTStartServer}
              variant="secondary"
              style={styles.btBtn}
            />
          </View>
        </GlassCard>
      )}

      {bt.status === 'discovering' && (
        <GlassCard style={{ marginTop: spacing.md }}>
          <NeonText size="h2" color={colors.neonCyan} glow={false}>
            {t('bt_scanning')}
          </NeonText>
          <GlassButton
            title={t('bt_stop')}
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
                    title={t('bt_connect')}
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
              {t('bt_no_devices')}
            </NeonText>
          )}
        </GlassCard>
      )}

      {bt.status === 'connecting' && (
        <GlassCard style={{ marginTop: spacing.md }}>
          <NeonText size="h2" color={colors.neonBlue} glow={false}>
            {t('bt_connecting')}
          </NeonText>
          <GlassButton
            title={t('bt_disconnect')}
            onPress={handleBTCancelConnect}
            variant="danger"
            style={{ marginTop: spacing.sm }}
          />
        </GlassCard>
      )}

      {bt.status === 'connected' && (
        <GlassCard borderColor={colors.neonGreenDim} glowColor={colors.neonGreen} style={{ marginTop: spacing.md }}>
          <NeonText size="h2" color={colors.neonGreen} glow={false}>
            {t('bt_connected')}
          </NeonText>
          <NeonText size="caption" color={colors.text} glow={false}>
            {t('bt_device')}: {bt.deviceName}
          </NeonText>
          <View style={styles.btActions}>
            <GlassButton
              title={t('bt_call')}
              onPress={handleBTCall}
              variant="primary"
              style={styles.btBtn}
            />
            <GlassButton
              title={t('bt_disconnect')}
              onPress={handleBTDisconnect}
              variant="danger"
              style={styles.btBtn}
            />
          </View>
        </GlassCard>
      )}

      {bt.status === 'incall' && (
        <GlassCard borderColor={colors.neonPinkDim} glowColor={colors.neonPink} style={{ marginTop: spacing.md }}>
          <NeonText size="h2" color={colors.neonPink} glow={false}>
            {t('bt_in_call')}
          </NeonText>
          <NeonText size="caption" color={colors.text} glow={false}>
            {bt.deviceName} {bt.muted ? t('call_muted') : ''}
          </NeonText>
          <View style={styles.btActions}>
            <GlassButton
              title={bt.muted ? t('bt_unmute') : t('bt_mute')}
              onPress={handleBTMute}
              variant="secondary"
              style={styles.btBtn}
            />
            <GlassButton
              title={t('bt_hang_up')}
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
