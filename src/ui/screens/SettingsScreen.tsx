import { useState, useEffect } from 'react';
import { View, StyleSheet, Switch, ScrollView, TouchableOpacity, Text } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { NeonText } from '../components/NeonText';
import { GlassButton } from '../components/GlassButton';
import { colors, spacing } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocale, type Locale } from '../../i18n/LocaleContext';
import { useTheme, type ThemeName } from '../theme/ThemeContext';

const SETTINGS_KEY = 'app_settings';

export interface AppSettings {
  darkMode: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  autoConnect: boolean;
  encryptionLevel: 'standard' | 'high' | 'maximum';
  theme: ThemeName;
}

const DEFAULT_SETTINGS: AppSettings = {
  darkMode: true,
  soundEnabled: true,
  vibrationEnabled: true,
  autoConnect: false,
  encryptionLevel: 'high',
  theme: 'cyber',
};

const MANUAL_OPEN_KEY = 'manual_open';

export default function SettingsScreen() {
  const { t, locale, setLocale } = useLocale();
  const { theme: activeTheme, setTheme: applyTheme } = useTheme();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    loadSettings();
    AsyncStorage.getItem(MANUAL_OPEN_KEY).then((v) => setManualOpen(v === '1'));
  }, []);

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem(SETTINGS_KEY);
      if (saved) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      }
    } catch (e) {
      console.error('Failed to load settings', e);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings: AppSettings) => {
    try {
      setSettings(newSettings);
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  };

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    saveSettings({ ...settings, [key]: value });
  };

  const toggleManual = () => {
    const next = !manualOpen;
    setManualOpen(next);
    AsyncStorage.setItem(MANUAL_OPEN_KEY, next ? '1' : '0');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <NeonText size="h1" color={colors.neonCyan} style={{ textAlign: 'center' }}>
          {t('settings_title')}
        </NeonText>
      </View>
    );
  }

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

  const encDescriptions: Record<string, string> = {
    standard: t('settings_enc_standard'),
    high: t('settings_enc_high'),
    maximum: t('settings_enc_max'),
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <NeonText size="h1" color={colors.neonCyan} style={{ textAlign: 'center' }}>
        {t('settings_title')}
      </NeonText>
      <NeonText size="caption" color={colors.textSecondary} glow={false}>
        {t('settings_subtitle')}
      </NeonText>

      {/* General */}
      <GlassCard style={{ marginTop: spacing.md }}>
        <NeonText size="h2" color={colors.neonGreen} glow={false}>
          {t('settings_general')}
        </NeonText>

        <View style={styles.settingRow}>
          <NeonText size="caption" color={colors.text} glow={false}>
            {t('settings_language')}
          </NeonText>
          <View style={styles.buttonGroup}>
            {languages.map((lang) => (
              <TouchableOpacity
                key={lang.key}
                style={[styles.optionBtn, locale === lang.key && styles.optionBtnActive]}
                onPress={() => setLocale(lang.key)}
              >
                <Text style={[styles.optionText, locale === lang.key && styles.optionTextActive]}>
                  {lang.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.settingRow}>
          <NeonText size="caption" color={colors.text} glow={false}>
            {t('settings_sound')}
          </NeonText>
          <Switch
            value={settings.soundEnabled}
            onValueChange={(value) => updateSetting('soundEnabled', value)}
            trackColor={{ false: colors.border, true: colors.neonCyanDim }}
            thumbColor={settings.soundEnabled ? colors.neonCyan : colors.textMuted}
          />
        </View>

        <View style={styles.settingRow}>
          <NeonText size="caption" color={colors.text} glow={false}>
            {t('settings_vibration')}
          </NeonText>
          <Switch
            value={settings.vibrationEnabled}
            onValueChange={(value) => updateSetting('vibrationEnabled', value)}
            trackColor={{ false: colors.border, true: colors.neonCyanDim }}
            thumbColor={settings.vibrationEnabled ? colors.neonCyan : colors.textMuted}
          />
        </View>

        <View style={styles.settingRow}>
          <NeonText size="caption" color={colors.text} glow={false}>
            {t('settings_autoconnect')}
          </NeonText>
          <Switch
            value={settings.autoConnect}
            onValueChange={(value) => updateSetting('autoConnect', value)}
            trackColor={{ false: colors.border, true: colors.neonCyanDim }}
            thumbColor={settings.autoConnect ? colors.neonCyan : colors.textMuted}
          />
        </View>
      </GlassCard>

      {/* Security */}
      <GlassCard style={{ marginTop: spacing.md }}>
        <NeonText size="h2" color={colors.neonPink} glow={false}>
          {t('settings_security')}
        </NeonText>

        <NeonText size="caption" color={colors.textMuted} glow={false} style={{ marginTop: spacing.sm }}>
          {t('settings_encryption')}
        </NeonText>
        <View style={styles.buttonGroupWrap}>
          {encLevels.map((level) => (
            <TouchableOpacity
              key={level.key}
              style={[styles.optionBtn, settings.encryptionLevel === level.key && styles.optionBtnActive]}
              onPress={() => updateSetting('encryptionLevel', level.key)}
            >
              <Text style={[styles.optionText, settings.encryptionLevel === level.key && styles.optionTextActive]}>
                {level.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <NeonText size="caption" color={colors.textMuted} glow={false} style={{ marginTop: spacing.sm }}>
          {encDescriptions[settings.encryptionLevel]}
        </NeonText>
      </GlassCard>

      {/* Appearance */}
      <GlassCard style={{ marginTop: spacing.md }}>
        <NeonText size="h2" color={colors.neonBlue} glow={false}>
          {t('settings_appearance')}
        </NeonText>

        <View style={styles.settingRow}>
          <NeonText size="caption" color={colors.text} glow={false}>
            {t('settings_theme')}
          </NeonText>
          <View style={styles.buttonGroup}>
            {themes.map((theme) => (
              <TouchableOpacity
                key={theme.key}
                style={[styles.optionBtn, activeTheme === theme.key && styles.optionBtnActive]}
                onPress={() => { applyTheme(theme.key); updateSetting('theme', theme.key); }}
              >
                <Text style={[styles.optionText, activeTheme === theme.key && styles.optionTextActive]}>
                  {theme.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </GlassCard>

      {/* Manual / Guide */}
      <GlassCard style={{ marginTop: spacing.md }}>
        <TouchableOpacity onPress={toggleManual} style={styles.manualHeader}>
          <NeonText size="h2" color={colors.neonGreen} glow={false}>
            {t('settings_manual')}
          </NeonText>
          <Text style={{ color: colors.neonCyan, fontSize: 20 }}>{manualOpen ? '▼' : '▶'}</Text>
        </TouchableOpacity>
        {manualOpen && (
          <View style={{ marginTop: spacing.sm }}>
            <NeonText size="caption" color={colors.neonCyan} glow={false}>
              MESH
            </NeonText>
            <NeonText size="caption" color={colors.textMuted} glow={false} style={{ marginBottom: spacing.sm }}>
              {t('settings_manual_mesh')}
            </NeonText>
            <NeonText size="caption" color={colors.neonBlue} glow={false}>
              BLUETOOTH
            </NeonText>
            <NeonText size="caption" color={colors.textMuted} glow={false} style={{ marginBottom: spacing.sm }}>
              {t('settings_manual_bluetooth')}
            </NeonText>
            <NeonText size="caption" color={colors.neonPink} glow={false}>
              {t('tab_peers').toUpperCase()}
            </NeonText>
            <NeonText size="caption" color={colors.textMuted} glow={false} style={{ marginBottom: spacing.sm }}>
              {t('settings_manual_peers')}
            </NeonText>
            <NeonText size="caption" color={colors.neonBlue} glow={false}>
              {t('tab_forum').toUpperCase()}
            </NeonText>
            <NeonText size="caption" color={colors.textMuted} glow={false} style={{ marginBottom: spacing.sm }}>
              {t('settings_manual_forum')}
            </NeonText>
            <NeonText size="caption" color={colors.neonCyan} glow={false}>
              {t('tab_history').toUpperCase()}
            </NeonText>
            <NeonText size="caption" color={colors.textMuted} glow={false} style={{ marginBottom: spacing.sm }}>
              {t('settings_manual_history')}
            </NeonText>
            <NeonText size="caption" color={colors.neonPink} glow={false}>
              {t('tab_settings').toUpperCase()}
            </NeonText>
            <NeonText size="caption" color={colors.textMuted} glow={false}>
              {t('settings_manual_settings')}
            </NeonText>
          </View>
        )}
      </GlassCard>

      {/* Reset */}
      <View style={{ marginTop: spacing.md, marginBottom: 100 }}>
        <GlassCard borderColor={colors.errorDim} glowColor={colors.error}>
          <NeonText size="h2" color={colors.error} glow={false}>
            {t('settings_reset')}
          </NeonText>
          <NeonText size="caption" color={colors.textMuted} glow={false} style={{ marginTop: spacing.sm }}>
            {t('settings_reset_desc')}
          </NeonText>
          <GlassButton
            title={t('settings_reset_btn')}
            onPress={() => saveSettings(DEFAULT_SETTINGS)}
            variant="danger"
            style={{ marginTop: spacing.sm }}
          />
        </GlassCard>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  buttonGroupWrap: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  optionBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  optionBtnActive: {
    borderColor: colors.neonCyan,
    backgroundColor: colors.neonCyanDim,
  },
  optionText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: 'bold',
  },
  optionTextActive: {
    color: colors.neonCyan,
  },
  manualHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
