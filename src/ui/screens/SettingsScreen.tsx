import { useState, useEffect } from 'react';
import { View, StyleSheet, Switch, ScrollView, TouchableOpacity, Text, Share, NativeModules, Platform } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { NeonText } from '../components/NeonText';
import { GlassButton } from '../components/GlassButton';
import { colors, spacing } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocale, type Locale } from '../../i18n/LocaleContext';
import { useTheme, type ThemeName } from '../theme/ThemeContext';
import { identityManager, type UserIdentity } from '../../core/identity/IdentityManager';
import { userStore, type UserStatus } from '../../core/identity/UserStore';

const SETTINGS_KEY = 'app_settings';
const MANUAL_OPEN_KEY = 'manual_open';
const CALL_HISTORY_KEY = 'call_history';

interface AppSettings {
  darkMode: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  autoConnect: boolean;
  encryptionLevel: 'standard' | 'high' | 'maximum';
  theme: ThemeName;
  userStatus: UserStatus;
}

const DEFAULT_SETTINGS: AppSettings = {
  darkMode: true,
  soundEnabled: true,
  vibrationEnabled: true,
  autoConnect: false,
  encryptionLevel: 'high',
  theme: 'cyber',
  userStatus: 'online',
};

interface CallRecord {
  id: string; peerId: string; peerName: string;
  callType: 'outgoing' | 'incoming' | 'missed';
  duration: number; timestamp: number; connectionType: string;
}

export default function SettingsScreen() {
  const { t, locale, setLocale } = useLocale();
  const { theme: activeTheme, setTheme: applyTheme } = useTheme();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);
  const [identity, setIdentity] = useState<UserIdentity | null>(null);
  const [history, setHistory] = useState<CallRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    loadSettings();
    identityManager.load().then(setIdentity);
    loadHistory();
    AsyncStorage.getItem(MANUAL_OPEN_KEY).then((v) => setManualOpen(v === '1'));
  }, []);

  const loadHistory = async () => {
    const raw = await AsyncStorage.getItem(CALL_HISTORY_KEY);
    if (raw) { setHistory(JSON.parse(raw)); }
  };

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem(SETTINGS_KEY);
      if (saved) { setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) }); }
    } catch {} finally { setLoading(false); }
  };

  const saveSettings = async (s: AppSettings) => {
    setSettings(s);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  };

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    saveSettings({ ...settings, [key]: value });
    if (key === 'userStatus') { userStore.setMyStatus(value as UserStatus); }
  };

  const shareApp = async () => {
    try {
      await Share.share({
        message: 'SofiLink — encrypted P2P messenger.\nhttps://github.com/zxDOOMxz/KAmesh1/releases',
        title: 'Share SofiLink via Bluetooth',
      }, {
        dialogTitle: 'Share SofiLink',
        subject: 'SofiLink - encrypted P2P messenger',
      });
    } catch {}
  };

  const toggleConnection = () => {
    setConnected(!connected);
    if (connected) {
      // Disconnect all
    } else {
      // Reconnect
    }
  };

  if (loading) { return <View style={styles.container}><NeonText size="h1" color={colors.neonCyan} style={{ textAlign: 'center' }}>{t('settings_title')}</NeonText></View>; }

  const statuses: Array<{ key: UserStatus; label: string }> = [
    { key: 'online', label: t('status_online') },
    { key: 'busy', label: t('status_busy') },
    { key: 'offline', label: t('status_offline') },
  ];

  const encLevels: Array<{ key: AppSettings['encryptionLevel']; label: string }> = [
    { key: 'standard', label: 'STANDARD' },
    { key: 'high', label: 'HIGH' },
    { key: 'maximum', label: 'MAX' },
  ];

  const themes: Array<{ key: ThemeName; label: string }> = [
    { key: 'cyber', label: t('settings_theme_cyber') },
    { key: 'minimal', label: t('settings_theme_minimal') },
    { key: 'retro', label: t('settings_theme_retro') },
  ];

  const languages: Array<{ key: Locale; label: string }> = [
    { key: 'en', label: 'EN' },
    { key: 'ru', label: 'RU' },
  ];

  const encDesc: Record<string, string> = {
    standard: t('settings_enc_standard'),
    high: t('settings_enc_high'),
    maximum: t('settings_enc_max'),
  };

  const fmtDuration = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <NeonText size="h1" color={colors.neonCyan} style={{ textAlign: 'center' }}>
        {t('settings_title')}
      </NeonText>
      {identity && (
        <NeonText size="h2" color={colors.neonGreen} glow style={{ textAlign: 'center', marginTop: spacing.xs }}>
          {identity.nickname}
        </NeonText>
      )}

      {/* Profile */}
      <GlassCard style={{ marginTop: spacing.md }}>
        <NeonText size="h2" color={colors.neonGreen} glow={false}>{t('settings_profile')}</NeonText>
        <View style={styles.settingRow}>
          <NeonText size="caption" color={colors.text} glow={false}>{t('settings_status')}</NeonText>
          <View style={styles.buttonGroup}>
            {statuses.map((s) => (
              <TouchableOpacity key={s.key}
                style={[styles.optionBtn, settings.userStatus === s.key && styles.optionBtnActive]}
                onPress={() => { update('userStatus', s.key); }}>
                <Text style={[styles.optionText, settings.userStatus === s.key && styles.optionTextActive]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={styles.settingRow}>
          <NeonText size="caption" color={colors.text} glow={false}>{t('settings_connection')}</NeonText>
          <Switch value={connected} onValueChange={toggleConnection} trackColor={{ false: colors.border, true: colors.neonCyanDim }} thumbColor={connected ? colors.neonCyan : colors.textMuted} />
        </View>
      </GlassCard>

      {/* Language */}
      <GlassCard style={{ marginTop: spacing.md }}>
        <NeonText size="h2" color={colors.neonBlue} glow={false}>{t('settings_language')}</NeonText>
        <View style={styles.settingRow}>
          <View style={styles.buttonGroup}>
            {languages.map((l) => (
              <TouchableOpacity key={l.key}
                style={[styles.optionBtn, locale === l.key && styles.optionBtnActive]}
                onPress={() => setLocale(l.key)}>
                <Text style={[styles.optionText, locale === l.key && styles.optionTextActive]}>{l.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </GlassCard>

      {/* Appearance */}
      <GlassCard style={{ marginTop: spacing.md }}>
        <NeonText size="h2" color={colors.neonBlue} glow={false}>{t('settings_appearance')}</NeonText>
        <View style={styles.settingRow}>
          <NeonText size="caption" color={colors.text} glow={false}>{t('settings_theme')}</NeonText>
          <View style={styles.buttonGroup}>
            {themes.map((th) => (
              <TouchableOpacity key={th.key}
                style={[styles.optionBtn, activeTheme === th.key && styles.optionBtnActive]}
                onPress={() => { applyTheme(th.key); update('theme', th.key); }}>
                <Text style={[styles.optionText, activeTheme === th.key && styles.optionTextActive]}>{th.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </GlassCard>

      {/* General */}
      <GlassCard style={{ marginTop: spacing.md }}>
        <NeonText size="h2" color={colors.neonGreen} glow={false}>{t('settings_general')}</NeonText>
        <View style={styles.settingRow}>
          <NeonText size="caption" color={colors.text} glow={false}>{t('settings_sound')}</NeonText>
          <Switch value={settings.soundEnabled} onValueChange={(v) => update('soundEnabled', v)} trackColor={{ false: colors.border, true: colors.neonCyanDim }} thumbColor={settings.soundEnabled ? colors.neonCyan : colors.textMuted} />
        </View>
        <View style={styles.settingRow}>
          <NeonText size="caption" color={colors.text} glow={false}>{t('settings_vibration')}</NeonText>
          <Switch value={settings.vibrationEnabled} onValueChange={(v) => update('vibrationEnabled', v)} trackColor={{ false: colors.border, true: colors.neonCyanDim }} thumbColor={settings.vibrationEnabled ? colors.neonCyan : colors.textMuted} />
        </View>
        <View style={styles.settingRow}>
          <NeonText size="caption" color={colors.text} glow={false}>{t('settings_autoconnect')}</NeonText>
          <Switch value={settings.autoConnect} onValueChange={(v) => update('autoConnect', v)} trackColor={{ false: colors.border, true: colors.neonCyanDim }} thumbColor={settings.autoConnect ? colors.neonCyan : colors.textMuted} />
        </View>
      </GlassCard>

      {/* Security */}
      <GlassCard style={{ marginTop: spacing.md }}>
        <NeonText size="h2" color={colors.neonPink} glow={false}>{t('settings_security')}</NeonText>
        <NeonText size="caption" color={colors.textMuted} glow={false} style={{ marginTop: spacing.sm }}>{t('settings_encryption')}</NeonText>
        <View style={styles.buttonGroupWrap}>
          {encLevels.map((l) => (
            <TouchableOpacity key={l.key}
              style={[styles.optionBtn, settings.encryptionLevel === l.key && styles.optionBtnActive]}
              onPress={() => update('encryptionLevel', l.key)}>
              <Text style={[styles.optionText, settings.encryptionLevel === l.key && styles.optionTextActive]}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <NeonText size="caption" color={colors.textMuted} glow={false} style={{ marginTop: spacing.sm }}>{encDesc[settings.encryptionLevel]}</NeonText>
      </GlassCard>

      {/* Share & History */}
      <GlassCard style={{ marginTop: spacing.md }}>
        <GlassButton title={t('settings_share')} onPress={shareApp} variant="secondary" style={{ marginBottom: spacing.sm }} />
        <GlassButton title={t('settings_show_history')} onPress={() => setShowHistory(!showHistory)} variant="secondary" style={{ marginBottom: showHistory ? spacing.sm : 0 }} />
        {showHistory && (
          <>
            {history.length === 0 ? (
              <NeonText size="caption" color={colors.textMuted} glow={false}>{t('history_no_history')}</NeonText>
            ) : (
              history.slice(0, 10).map((item) => (
                <View key={item.id} style={styles.histRow}>
                  <NeonText size="caption" color={colors.textMuted} glow={false}>
                    {item.callType} • {item.peerName || item.peerId.slice(0, 10)}... • {fmtDuration(item.duration)}
                  </NeonText>
                  <NeonText size="caption" color={colors.textMuted} glow={false}>
                    {new Date(item.timestamp).toLocaleDateString()}
                  </NeonText>
                </View>
              ))
            )}
            {history.length > 0 && (
              <GlassButton title={t('history_clear')} onPress={async () => { await AsyncStorage.removeItem(CALL_HISTORY_KEY); setHistory([]); }} variant="danger" style={{ marginTop: spacing.sm, paddingVertical: spacing.xs, minHeight: 30 }} />
            )}
          </>
        )}
      </GlassCard>

      {/* Manual */}
      <GlassCard style={{ marginTop: spacing.md }}>
        <TouchableOpacity onPress={() => { const v = !manualOpen; setManualOpen(v); AsyncStorage.setItem(MANUAL_OPEN_KEY, v ? '1' : '0'); }} style={styles.manualHeader}>
          <NeonText size="h2" color={colors.neonGreen} glow={false}>{t('settings_manual')}</NeonText>
          <Text style={{ color: colors.neonCyan, fontSize: 20 }}>{manualOpen ? '▼' : '▶'}</Text>
        </TouchableOpacity>
        {manualOpen && (
          <View style={{ marginTop: spacing.sm }}>
            {(['manual_users','manual_messages','manual_calls','manual_forum','manual_settings'] as const).map((k) => (
              <View key={k}>
                <NeonText size="caption" color={colors.neonCyan} glow={false}>{t(k + '_title')}</NeonText>
                <NeonText size="caption" color={colors.textMuted} glow={false} style={{ marginBottom: spacing.sm }}>{t(k)}</NeonText>
              </View>
            ))}
          </View>
        )}
      </GlassCard>

      {/* Reset */}
      <View style={{ marginTop: spacing.md, marginBottom: 100 }}>
        <GlassCard borderColor={colors.errorDim} glowColor={colors.error}>
          <NeonText size="h2" color={colors.error} glow={false}>{t('settings_reset')}</NeonText>
          <NeonText size="caption" color={colors.textMuted} glow={false} style={{ marginTop: spacing.sm }}>{t('settings_reset_desc')}</NeonText>
          <GlassButton title={t('settings_reset_btn')} onPress={() => saveSettings(DEFAULT_SETTINGS)} variant="danger" style={{ marginTop: spacing.sm }} />
        </GlassCard>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingHorizontal: spacing.md, paddingTop: spacing.xxl, paddingBottom: spacing.xl },
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.md, paddingTop: spacing.xxl, paddingBottom: spacing.xl },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  buttonGroup: { flexDirection: 'row', gap: spacing.xs },
  buttonGroupWrap: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs, flexWrap: 'wrap' },
  optionBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard },
  optionBtnActive: { borderColor: colors.neonCyan, backgroundColor: colors.neonCyanDim },
  optionText: { color: colors.textMuted, fontSize: 12, fontWeight: 'bold' },
  optionTextActive: { color: colors.neonCyan },
  manualHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  histRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
});
