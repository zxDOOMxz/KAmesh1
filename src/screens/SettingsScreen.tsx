import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { COLORS } from '../constants';
import { AuthService } from '../services/AuthService';
import { ApiClient } from '../services/ApiClient';
import { GsmTransport } from '../services/transports/GsmTransport';
import { WifiTransport } from '../services/transports/WifiTransport';
import { BleService } from '../services/BleService';
import { getRelayUrl, setRelayUrl } from '../services/StorageService';

interface Props { onBack: () => void; onLogout?: () => void; onShareApp?: () => void; }

export function SettingsScreen({ onBack, onLogout, onShareApp }: Props) {
  const [relayUrl, setRelayUrlState] = useState(getRelayUrl());
  const [gsmConnected, setGsmConnected] = useState(false);
  const [gsmPeers, setGsmPeers] = useState(0);
  const [wifiPeers, setWifiPeers] = useState(0);
  const [blePeers, setBlePeers] = useState(0);
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);
  const [serverUrl, setServerUrlState] = useState(ApiClient.getBaseUrl());
  const [savingServer, setSavingServer] = useState(false);

  useEffect(() => {
    setNickname(AuthService.getNickname() || '');
    const tick = setInterval(() => {
      setGsmConnected(GsmTransport.isRelayConnected());
      setGsmPeers(GsmTransport.getOnlinePeerCount());
      setWifiPeers(WifiTransport.getConnectedPeers().length);
      setBlePeers(BleService.getConnectedDevices().length);
    }, 2000);
    return () => clearInterval(tick);
  }, []);

  const handleSaveUrl = async () => {
    if (!relayUrl.trim()) return;
    setSaving(true);
    setRelayUrl(relayUrl.trim());
    await GsmTransport.reconnect();
    setSaving(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><Text style={styles.back}>{'< Назад'}</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Настройки</Text>
        <View style={{ width: 50 }} />
      </View>
      <ScrollView style={styles.body}>
        <Text style={styles.sectionTitle}>Профиль</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Никнейм</Text>
          <Text style={styles.value}>{nickname || '—'}</Text>
        </View>

        <Text style={styles.sectionTitle}>Подключение</Text>
        <View style={styles.statusCard}>
          <StatusRow icon="🌐" name="Интернет (Relay)" connected={gsmConnected} count={gsmPeers} />
          <StatusRow icon="📶" name="WiFi" connected={wifiPeers > 0} count={wifiPeers} />
          <StatusRow icon="🔵" name="BLE" connected={blePeers > 0} count={blePeers} />
        </View>

        <Text style={styles.sectionTitle}>Relay Сервер</Text>
        <TextInput
          style={styles.input}
          value={relayUrl}
          onChangeText={setRelayUrlState}
          placeholder="wss://your-relay-server.com"
          placeholderTextColor={COLORS.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <TouchableOpacity
          style={[styles.button, (!relayUrl.trim() || saving) && styles.buttonDisabled]}
          onPress={handleSaveUrl}
          disabled={!relayUrl.trim() || saving}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>{saving ? 'Подключение...' : 'Сохранить и переподключиться'}</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>API Сервер</Text>
        <TextInput
          style={styles.input}
          value={serverUrl}
          onChangeText={setServerUrlState}
          placeholder="http://localhost:8080"
          placeholderTextColor={COLORS.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <TouchableOpacity
          style={[styles.button, (!serverUrl.trim() || savingServer) && styles.buttonDisabled]}
          onPress={async () => {
            if (!serverUrl.trim()) return;
            setSavingServer(true);
            ApiClient.setServerUrl(serverUrl.trim());
            ApiClient.logout();
            setSavingServer(false);
          }}
          disabled={!serverUrl.trim() || savingServer}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>{savingServer ? 'Сохранение...' : 'Сменить сервер'}</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Приложение</Text>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => onShareApp?.()}>
          <Text style={styles.settingsBtnText}>📤  Поделиться приложением</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: COLORS.error, marginTop: 32 }]}
          onPress={() => {
            ApiClient.logout();
            onLogout?.();
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>🚪  Выход</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function StatusRow({ icon, name, connected, count }: { icon: string; name: string; connected: boolean; count: number }) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusIcon}>{icon}</Text>
      <Text style={styles.statusName}>{name}</Text>
      <View style={[styles.statusDot, { backgroundColor: connected ? COLORS.secondary : COLORS.textTertiary }]} />
      <Text style={[styles.statusCount, { color: connected ? COLORS.textPrimary : COLORS.textTertiary }]}>
        {connected ? `${count} пиров` : 'Не в сети'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  back: { color: COLORS.primary, fontSize: 14 },
  headerTitle: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary, flex: 1, textAlign: 'center' },
  body: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase', marginTop: 20, marginBottom: 10, letterSpacing: 0.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  label: { fontSize: 15, color: COLORS.textPrimary },
  value: { fontSize: 15, color: COLORS.primary, fontWeight: '600' },
  statusCard: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 8, borderWidth: 1, borderColor: COLORS.border },
  statusRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8 },
  statusIcon: { fontSize: 18, marginRight: 10 },
  statusName: { flex: 1, fontSize: 15, color: COLORS.textPrimary },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusCount: { fontSize: 13 },
  input: { backgroundColor: COLORS.surfaceVariant, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12, fontFamily: 'monospace' },
  settingsBtn: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  settingsBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  button: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 16, fontWeight: '600', color: COLORS.onPrimary },
});
