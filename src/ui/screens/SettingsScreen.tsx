import { useState, useEffect } from 'react';
import { View, StyleSheet, Switch } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { NeonText } from '../components/NeonText';
import { GlassButton } from '../components/GlassButton';
import { colors, spacing } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = 'app_settings';

export interface AppSettings {
  darkMode: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  autoConnect: boolean;
  encryptionLevel: 'standard' | 'high' | 'maximum';
  theme: 'cyber' | 'minimal' | 'retro';
}

const DEFAULT_SETTINGS: AppSettings = {
  darkMode: true,
  soundEnabled: true,
  vibrationEnabled: true,
  autoConnect: false,
  encryptionLevel: 'high',
  theme: 'cyber',
};

export default function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
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
    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);
  };

  const resetSettings = async () => {
    await saveSettings(DEFAULT_SETTINGS);
  };
  if (loading) {
    return (
      <View style={styles.container}>
        <NeonText size="h1" color={colors.neonCyan} style={{ textAlign: 'center' }}>
          SETTINGS
        </NeonText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NeonText size="h1" color={colors.neonCyan} style={{ textAlign: 'center' }}>
        SETTINGS
      </NeonText>
      <NeonText size="caption" color={colors.textSecondary} glow={false}>
        app configuration
      </NeonText>

      {/* General Settings */}
      <GlassCard style={{ marginTop: spacing.md }}>
        <NeonText size="h2" color={colors.neonGreen} glow={false}>
          General
        </NeonText>

        <View style={styles.settingRow}>
          <NeonText size="body" color={colors.text} glow={false}>
            Sound Effects
          </NeonText>
          <Switch
            value={settings.soundEnabled}
            onValueChange={(value) => updateSetting('soundEnabled', value)}
            trackColor={{ false: colors.border, true: colors.neonCyanDim }}
            thumbColor={settings.soundEnabled ? colors.neonCyan : colors.textMuted}
          />
        </View>

        <View style={styles.settingRow}>
          <NeonText size="body" color={colors.text} glow={false}>
            Vibration
          </NeonText>
          <Switch
            value={settings.vibrationEnabled}
            onValueChange={(value) => updateSetting('vibrationEnabled', value)}
            trackColor={{ false: colors.border, true: colors.neonCyanDim }}
            thumbColor={settings.vibrationEnabled ? colors.neonCyan : colors.textMuted}
          />
        </View>

        <View style={styles.settingRow}>
          <NeonText size="body" color={colors.text} glow={false}>
            Auto-connect on start
          </NeonText>
          <Switch
            value={settings.autoConnect}
            onValueChange={(value) => updateSetting('autoConnect', value)}
            trackColor={{ false: colors.border, true: colors.neonCyanDim }}
            thumbColor={settings.autoConnect ? colors.neonCyan : colors.textMuted}
          />
        </View>
      </GlassCard>

      {/* Security Settings */}
      <GlassCard style={{ marginTop: spacing.md }}>
        <NeonText size="h2" color={colors.neonPink} glow={false}>
          Security
        </NeonText>

        <View style={styles.settingRow}>
          <NeonText size="body" color={colors.text} glow={false}>
            Encryption Level
          </NeonText>
          <View style={styles.buttonGroup}>
            {(['standard', 'high', 'maximum'] as const).map((level) => (
              <View
                key={level}
                style={[
                  styles.optionButton,
                  settings.encryptionLevel === level && styles.optionButtonActive,
                ]}
              >
                <NeonText
                  size="caption"
                  color={settings.encryptionLevel === level ? colors.neonPink : colors.textMuted}
                  glow={settings.encryptionLevel === level}
                >
                  {level.toUpperCase()}
                </NeonText>
              </View>
            ))}
          </View>
        </View>

        <NeonText size="caption" color={colors.textMuted} glow={false} style={{ marginTop: spacing.sm }}>
          Current: {settings.encryptionLevel === 'standard'
            ? 'ChaCha20-Poly1305 (fast)'
            : settings.encryptionLevel === 'high'
              ? 'ChaCha20 + Ed25519 (balanced)'
              : 'X25519 + HKDF + ChaCha20 (maximum)'}
        </NeonText>
      </GlassCard>

      {/* Theme Settings */}
      <GlassCard style={{ marginTop: spacing.md }}>
        <NeonText size="h2" color={colors.neonBlue} glow={false}>
          Appearance
        </NeonText>

        <View style={styles.settingRow}>
          <NeonText size="body" color={colors.text} glow={false}>
            Theme
          </NeonText>
          <View style={styles.buttonGroup}>
            {(['cyber', 'minimal', 'retro'] as const).map((theme) => (
              <View
                key={theme}
                style={[
                  styles.optionButton,
                  settings.theme === theme && styles.optionButtonActive,
                ]}
              >
                <NeonText
                  size="caption"
                  color={settings.theme === theme ? colors.neonBlue : colors.textMuted}
                  glow={settings.theme === theme}
                >
                  {theme.toUpperCase()}
                </NeonText>
              </View>
            ))}
          </View>
        </View>
      </GlassCard>

      {/* Reset Button */}
      <View style={{ marginTop: spacing.md }}>
        <GlassCard borderColor={colors.errorDim} glowColor={colors.error}>
          <NeonText size="h2" color={colors.error} glow={false}>
            Reset Settings
          </NeonText>
          <NeonText size="caption" color={colors.textMuted} glow={false} style={{ marginTop: spacing.sm }}>
            Restore all settings to default values
          </NeonText>
          <GlassButton
            title="Reset All"
            onPress={resetSettings}
            variant="danger"
            style={{ marginTop: spacing.sm }}
          />
        </GlassCard>
      </View>
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
  optionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  optionButtonActive: {
    borderColor: colors.neonCyan,
    backgroundColor: colors.neonCyanDim,
  },
});
