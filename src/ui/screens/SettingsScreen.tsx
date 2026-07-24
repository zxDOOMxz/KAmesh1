import { useState, useEffect } from 'react';
import { View, StyleSheet, Switch, ScrollView, TouchableOpacity, Text } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { NeonText } from '../components/NeonText';
import { GlassButton } from '../components/GlassButton';
import { GlassInput } from '../components/GlassInput';
import BluetoothShareScreen from './BluetoothShareScreen';
import { spacing } from '../theme';
import { useTheme, type ThemeName } from '../theme/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocale, type Locale } from '../../i18n/LocaleContext';
import { identityManager, type UserIdentity } from '../../core/identity/IdentityManager';
import { userStore, type UserStatus } from '../../core/identity/UserStore';
import { P2PMessenger } from '../../core/p2p/P2PMessenger';
import { AsyncStorageAdapter } from '../../storage/AsyncStorageAdapter';
import { defaultSignalingClient, loadServerUrl, saveServerUrl } from '../../core/signaling/SignalingClient';
import { BluetoothCallManager } from '../../core/bluetooth/BluetoothCallManager';

const store = new AsyncStorageAdapter();
const messenger = P2PMessenger.getInstance(store);
const btManager = new BluetoothCallManager();

const SETTINGS_KEY = 'app_settings';
const MANUAL_OPEN_KEY = 'manual_open';
const CALL_HISTORY_KEY = 'call_history';

interface AppSettings { darkMode: boolean; soundEnabled: boolean; vibrationEnabled: boolean; autoConnect: boolean; encryptionLevel: 'standard' | 'high' | 'maximum'; theme: ThemeName; userStatus: UserStatus; }

const DEFAULT_SETTINGS: AppSettings = { darkMode: true, soundEnabled: true, vibrationEnabled: true, autoConnect: false, encryptionLevel: 'high', theme: 'cyber', userStatus: 'online' };

export default function SettingsScreen() {
  const { t, locale, setLocale } = useLocale();
  const { theme: activeTheme, setTheme: applyTheme, colors } = useTheme();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);
  const [identity, setIdentity] = useState<UserIdentity | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [connected, setConnected] = useState(true);
  const [editNick, setEditNick] = useState('');
  const [nickSaved, setNickSaved] = useState(false);
  const [showBtShare, setShowBtShare] = useState(false);
  const [serverUrl, setServerUrl] = useState('wss://long-seas-own.loca.lt');

  useEffect(() => {
    loadSettings(); identityManager.load().then(setIdentity); loadHistory();
    AsyncStorage.getItem(MANUAL_OPEN_KEY).then((v) => setManualOpen(v === '1'));
    loadServerUrl().then(setServerUrl);
  }, []);

  useEffect(() => {
    if (identity?.peerId && serverUrl) {
      defaultSignalingClient.reconnect(serverUrl);
    }
    return () => { defaultSignalingClient.disconnect(); };
  }, [identity?.peerId, serverUrl]);

  const loadHistory = async () => { const raw = await AsyncStorage.getItem(CALL_HISTORY_KEY); if (raw) { setHistory(JSON.parse(raw)); } };
  const loadSettings = async () => { try { const saved = await AsyncStorage.getItem(SETTINGS_KEY); if (saved) { setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) }); } } catch {} finally { setLoading(false); } };
  const saveSettings = async (s: AppSettings) => { setSettings(s); await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); };
  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => { saveSettings({ ...settings, [key]: value }); if (key === 'userStatus') { userStore.setMyStatus(value as UserStatus); } };
  const toggleConnection = async () => {
    if (connected) {
      await messenger.destroy();
    } else {
      await messenger.init();
      const id = await identityManager.load();
      if (id) { await messenger.startDiscovery(id.nickname); await messenger.startServer(0); }
    }
    setConnected(!connected);
  };

  if (loading) { return <View style={styles.cont}><NeonText size="h1" color={colors.neonCyan} style={{ textAlign: 'center' }}>{t('settings_title')}</NeonText></View>; }

  const fm = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  const encLabels = ['standard','high','maximum'] as const;
  const encDesc: Record<string,string> = { standard: t('settings_enc_standard'), high: t('settings_enc_high'), maximum: t('settings_enc_max') };
  const themes: Array<{key:ThemeName;label:string}> = [{key:'cyber',label:t('settings_theme_cyber')},{key:'minimal',label:t('settings_theme_minimal')},{key:'retro',label:t('settings_theme_retro')}];
  const langs: Array<{key:Locale;label:string}> = [{key:'en',label:'EN'},{key:'ru',label:'RU'}];
  const statuses: Array<{key:UserStatus;label:string}> = [{key:'online',label:t('status_online')},{key:'busy',label:t('status_busy')},{key:'offline',label:t('status_offline')}];

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInner}>
      <NeonText size="h1" color={colors.neonCyan} style={{ textAlign: 'center' }}>{t('settings_title')}</NeonText>
      {identity && <NeonText size="h2" color={colors.neonGreen} glow style={{ textAlign: 'center', marginTop: spacing.xs }}>{identity.nickname}</NeonText>}

      <GlassCard style={{ marginTop: spacing.md }}>
        <NeonText size="h2" color={colors.neonGreen} glow={false}>{t('settings_profile')}</NeonText>
        {identity ? <>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, alignItems: 'center' }}>
            <View style={{ flex: 1 }}><GlassInput value={editNick || identity.nickname} onChangeText={setEditNick} placeholder={t('mesh_nick_placeholder')} /></View>
            <GlassButton title={nickSaved ? '\u2713' : t('settings_save')} onPress={async () => { if (editNick.trim() && editNick.trim() !== identity.nickname) { await identityManager.register(editNick.trim(), identity.peerId); setNickSaved(true); setTimeout(() => setNickSaved(false), 2000); } }} variant="primary" style={{ minHeight: 52, paddingHorizontal: spacing.md }} />
          </View>
          <NeonText size="caption" color={colors.textMuted} glow={false} style={{ marginTop: spacing.sm }}>ID: {identity.peerId.slice(0, 24)}...</NeonText>
        </> : <NeonText size="caption" color={colors.textMuted} glow={false}>{t('settings_no_profile')}</NeonText>}
      </GlassCard>

      <GlassCard style={{ marginTop: spacing.md }}>
        <NeonText size="h2" color={colors.neonCyan} glow={false}>{t('settings_status')}</NeonText>
        <View style={styles.buttonGroupWrap}>
          {statuses.map((s) => <TouchableOpacity key={s.key} style={[styles.opt, settings.userStatus === s.key && styles.optA]} onPress={() => update('userStatus', s.key)}><Text style={[styles.optT, settings.userStatus === s.key && styles.optTA]}>{s.label}</Text></TouchableOpacity>)}
        </View>
      </GlassCard>

      <GlassCard style={{ marginTop: spacing.md }}>
        <NeonText size="h2" color={colors.neonBlue} glow={false}>{t('settings_language')}</NeonText>
        <View style={styles.buttonGroupWrap}>{langs.map((l) => <TouchableOpacity key={l.key} style={[styles.opt, locale === l.key && styles.optA]} onPress={() => setLocale(l.key)}><Text style={[styles.optT, locale === l.key && styles.optTA]}>{l.label}</Text></TouchableOpacity>)}</View>
      </GlassCard>

      <GlassCard style={{ marginTop: spacing.md }}>
        <NeonText size="h2" color={colors.neonBlue} glow={false}>{t('settings_appearance')}</NeonText>
        <View style={styles.buttonGroupWrap}>{themes.map((th) => <TouchableOpacity key={th.key} style={[styles.opt, activeTheme === th.key && styles.optA]} onPress={() => { applyTheme(th.key); update('theme', th.key); }}><Text style={[styles.optT, activeTheme === th.key && styles.optTA]}>{th.label}</Text></TouchableOpacity>)}</View>
      </GlassCard>

      <GlassCard style={{ marginTop: spacing.md }}>
        <NeonText size="h2" color={colors.neonGreen} glow={false}>{t('settings_general')}</NeonText>
        <View style={styles.row}><NeonText size="caption" color={colors.text} glow={false}>{t('settings_sound')}</NeonText><Switch value={settings.soundEnabled} onValueChange={(v) => update('soundEnabled', v)} trackColor={{ false: colors.border, true: colors.neonCyanDim }} thumbColor={settings.soundEnabled ? colors.neonCyan : colors.textMuted} /></View>
        <View style={styles.row}><NeonText size="caption" color={colors.text} glow={false}>{t('settings_vibration')}</NeonText><Switch value={settings.vibrationEnabled} onValueChange={(v) => update('vibrationEnabled', v)} trackColor={{ false: colors.border, true: colors.neonCyanDim }} thumbColor={settings.vibrationEnabled ? colors.neonCyan : colors.textMuted} /></View>
        <View style={styles.row}><NeonText size="caption" color={colors.text} glow={false}>{t('settings_autoconnect')}</NeonText><Switch value={settings.autoConnect} onValueChange={(v) => update('autoConnect', v)} trackColor={{ false: colors.border, true: colors.neonCyanDim }} thumbColor={settings.autoConnect ? colors.neonCyan : colors.textMuted} /></View>
        <View style={styles.row}><NeonText size="caption" color={colors.text} glow={false}>{t('settings_connection')}</NeonText><Switch value={connected} onValueChange={toggleConnection} trackColor={{ false: colors.border, true: colors.neonCyanDim }} thumbColor={connected ? colors.neonCyan : colors.textMuted} /></View>
        <View style={{ marginTop: spacing.sm }}>
          <NeonText size="caption" color={colors.textMuted} glow={false}>Server</NeonText>
          <GlassInput value={serverUrl} onChangeText={(v) => { setServerUrl(v); saveServerUrl(v); defaultSignalingClient.reconnect(v); }} placeholder="wss://xxx.loca.lt" style={{ marginTop: spacing.xs }} />
        </View>
      </GlassCard>

      <GlassCard style={{ marginTop: spacing.md }}>
        <NeonText size="h2" color={colors.neonPink} glow={false}>{t('settings_security')}</NeonText>
        <View style={styles.buttonGroupWrap}>{encLabels.map((l) => <TouchableOpacity key={l} style={[styles.opt, settings.encryptionLevel === l && styles.optA]} onPress={() => update('encryptionLevel', l)}><Text style={[styles.optT, settings.encryptionLevel === l && styles.optTA]}>{l.toUpperCase()}</Text></TouchableOpacity>)}</View>
        <NeonText size="caption" color={colors.textMuted} glow={false} style={{ marginTop: spacing.sm }}>{encDesc[settings.encryptionLevel]}</NeonText>
      </GlassCard>

      <GlassCard style={{ marginTop: spacing.md }}>
        <GlassButton title={t('settings_share')} onPress={() => setShowBtShare(true)} variant="secondary" style={{ marginBottom: spacing.sm }} />
        <GlassButton title={t('settings_bluetooth')} onPress={() => { btManager.init(); btManager.startDiscovery(); }} variant="secondary" style={{ marginBottom: spacing.sm }} />
        <GlassButton title={t('settings_show_history')} onPress={() => setShowHistory(!showHistory)} variant="secondary" style={{ marginBottom: showHistory ? spacing.sm : 0 }} />
        {showHistory && <>
          {history.length === 0 ? <NeonText size="caption" color={colors.textMuted} glow={false}>{t('history_no_history')}</NeonText> : history.slice(0, 10).map((item: any) => <View key={item.id} style={styles.row}><NeonText size="caption" color={colors.textMuted} glow={false}>{item.callType} \u2022 {item.peerName || item.peerId?.slice(0, 10)}... \u2022 {fm(item.duration)}</NeonText><NeonText size="caption" color={colors.textMuted} glow={false}>{new Date(item.timestamp).toLocaleDateString()}</NeonText></View>)}
          {history.length > 0 && <GlassButton title={t('history_clear')} onPress={async () => { await AsyncStorage.removeItem(CALL_HISTORY_KEY); setHistory([]); }} variant="danger" style={{ marginTop: spacing.sm, paddingVertical: spacing.xs, minHeight: 30 }} />}
        </>}
      </GlassCard>

      <GlassCard style={{ marginTop: spacing.md }}>
        <TouchableOpacity onPress={() => { const v = !manualOpen; setManualOpen(v); AsyncStorage.setItem(MANUAL_OPEN_KEY, v ? '1' : '0'); }} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <NeonText size="h2" color={colors.neonGreen} glow={false}>{t('settings_manual')}</NeonText><Text style={{ color: colors.neonCyan, fontSize: 20 }}>{manualOpen ? '\u25bc' : '\u25b6'}</Text>
        </TouchableOpacity>
        {manualOpen && <View style={{ marginTop: spacing.sm }}>
          {(['users','messages','calls','forum','settings'] as const).map((k) => <View key={k}><NeonText size="caption" color={colors.neonCyan} glow={false}>{t('manual_'+k+'_title')}</NeonText><NeonText size="caption" color={colors.textMuted} glow={false} style={{ marginBottom: spacing.sm }}>{t('manual_'+k)}</NeonText></View>)}
        </View>}
      </GlassCard>

      <View style={{ marginTop: spacing.md, marginBottom: 100 }}>
        <GlassCard borderColor={colors.errorDim} glowColor={colors.error}>
          <NeonText size="h2" color={colors.error} glow={false}>{t('settings_reset')}</NeonText>
          <NeonText size="caption" color={colors.textMuted} glow={false} style={{ marginTop: spacing.sm }}>{t('settings_reset_desc')}</NeonText>
          <GlassButton title={t('settings_reset_btn')} onPress={() => saveSettings(DEFAULT_SETTINGS)} variant="danger" style={{ marginTop: spacing.sm }} />
        </GlassCard>
      </View>
    </ScrollView>
    {showBtShare && <BluetoothShareScreen onClose={() => setShowBtShare(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0a0a0f' },
  scrollInner: { paddingHorizontal: spacing.md, paddingTop: spacing.xxl, paddingBottom: spacing.xl },
  cont: { flex: 1, backgroundColor: '#0a0a0f', paddingHorizontal: spacing.md, paddingTop: spacing.xxl, paddingBottom: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  buttonGroupWrap: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs, flexWrap: 'wrap' },
  opt: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8, borderWidth: 1, borderColor: '#333', backgroundColor: 'rgba(255,255,255,0.05)' },
  optA: { borderColor: '#00ffff', backgroundColor: 'rgba(0,255,255,0.15)' },
  optT: { color: 'rgba(240,240,245,0.35)', fontSize: 12, fontWeight: 'bold' },
  optTA: { color: '#00ffff' },
});
