import { useState, useEffect } from 'react';
import { View, FlatList, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { NeonText } from '../components/NeonText';
import { GlassButton } from '../components/GlassButton';
import { spacing } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { BluetoothBridge, type BluetoothDevice } from '../../native/BluetoothBridge';
import { useLocale } from '../../i18n/LocaleContext';

const btBridge = new BluetoothBridge();

interface Props {
  onClose: () => void;
}

export default function BluetoothShareScreen({ onClose }: Props) {
  const { t } = useLocale();
  const { colors } = useTheme();
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    startScan();
    const unsubDevice = btBridge.onDeviceDiscovered((device) => {
      setDevices((prev) => {
        if (prev.find((d) => d.address === device.address)) { return prev; }
        return [...prev, { ...device, name: device.name || 'Unknown device' }];
      });
    });
    const unsubFinish = btBridge.onDiscoveryFinished(() => setScanning(false));
    return () => { unsubDevice(); unsubFinish(); btBridge.stopDiscovery(); };
  }, []);

  const startScan = async () => {
    setDevices([]);
    setScanning(true);
    setSelected(null);
    try {
      const enabled = await btBridge.isEnabled();
      if (!enabled) { await btBridge.enableBluetooth(); }
      await btBridge.startDiscovery();
      setTimeout(() => { btBridge.stopDiscovery(); setScanning(false); }, 15000);
    } catch {
      setScanning(false);
    }
  };

  const handleSelect = (device: BluetoothDevice) => {
    setSelected(device.address);
    setSent(true);
    btBridge.stopDiscovery();
  };

  return (
    <View style={styles.overlay}>
      <GlassCard style={{ marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <NeonText size="h2" color={colors.neonCyan} glow={false}>{t('settings_share')}</NeonText>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: colors.error, fontSize: 22 }}>✕</Text>
          </TouchableOpacity>
        </View>
        {scanning && <NeonText size="caption" color={colors.neonCyan} glow={false} style={{ marginTop: spacing.sm }}>{t('bt_scanning')}</NeonText>}

        {sent ? (
          <View style={{ marginTop: spacing.md, alignItems: 'center' }}>
            <NeonText size="body" color={colors.neonGreen} glow={false} style={{ textAlign: 'center' }}>
              {t('share_sent_title')}
            </NeonText>
            <NeonText size="caption" color={colors.textMuted} glow={false} style={{ textAlign: 'center', marginTop: spacing.sm }}>
              {t('share_sent_desc')}
            </NeonText>
            <GlassButton title={t('share_send_more')} onPress={() => { setSent(false); setSelected(null); startScan(); }} variant="primary" style={{ marginTop: spacing.md }} />
          </View>
        ) : (
          <>
            {devices.length === 0 ? (
              <NeonText size="body" color={colors.textMuted} glow={false} style={{ textAlign: 'center', marginTop: spacing.md }}>
                {scanning ? t('bt_no_devices') : t('share_no_devices')}
              </NeonText>
            ) : (
              <FlatList
                data={devices}
                keyExtractor={(d) => d.address}
                style={{ maxHeight: 300, marginTop: spacing.sm }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => !selected && handleSelect(item)}
                    style={[styles.deviceItem, selected === item.address && { borderColor: colors.neonGreen, backgroundColor: colors.neonGreenDim }]}
                  >
                    <Text style={{ color: colors.text, fontSize: 14 }}>{item.name}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>{item.address}</Text>
                    {selected === item.address && <Text style={{ color: colors.neonGreen, fontSize: 12, marginLeft: spacing.sm }}>✓</Text>}
                  </TouchableOpacity>
                )}
              />
            )}
            <GlassButton title={t('share_scan_again')} onPress={startScan} variant="secondary" style={{ marginTop: spacing.md }} />
          </>
        )}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 200,
    justifyContent: 'center', alignItems: 'center', padding: spacing.md,
  },
  deviceItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: 8, borderWidth: 1, borderColor: '#333',
    marginBottom: spacing.xs,
  },
});
