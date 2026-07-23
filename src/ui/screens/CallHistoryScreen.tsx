import { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { NeonText } from '../components/NeonText';
import { GlassButton } from '../components/GlassButton';
import { colors, spacing } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocale } from '../../i18n/LocaleContext';

const CALL_HISTORY_KEY = 'call_history';

export interface CallRecord {
  id: string;
  peerId: string;
  peerName: string;
  callType: 'outgoing' | 'incoming' | 'missed';
  duration: number;
  timestamp: number;
  connectionType: 'wifi' | 'bluetooth' | 'internet';
}

export default function CallHistoryScreen() {
  const { t } = useLocale();
  const [history, setHistory] = useState<CallRecord[]>([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const saved = await AsyncStorage.getItem(CALL_HISTORY_KEY);
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load call history', e);
    }
  };

  const clearHistory = async () => {
    try {
      await AsyncStorage.removeItem(CALL_HISTORY_KEY);
      setHistory([]);
    } catch (e) {
      console.error('Failed to clear history', e);
    }
  };

  const formatDuration = (sec: number): string => {
    if (sec < 60) return `${sec}${t('history_sec')}`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}${t('history_min')} ${s}${t('history_sec')}`;
  };

  const typeLabel = (callType: string) => {
    switch (callType) {
      case 'outgoing': return t('history_outgoing');
      case 'incoming': return t('history_incoming');
      case 'missed': return t('history_missed');
      default: return callType;
    }
  };

  const connLabel = (ct: string) => {
    switch (ct) {
      case 'wifi': return t('history_wifi');
      case 'bluetooth': return t('history_bluetooth');
      case 'internet': return t('history_internet');
      default: return ct;
    }
  };

  const typeColor = (callType: string) => {
    switch (callType) {
      case 'outgoing': return colors.neonGreen;
      case 'incoming': return colors.neonCyan;
      case 'missed': return colors.error;
      default: return colors.text;
    }
  };

  const renderItem = ({ item }: { item: CallRecord }) => (
    <GlassCard style={styles.historyCard}>
      <View style={styles.historyHeader}>
        <View>
          <NeonText size="body" color={typeColor(item.callType)} glow={false}>
            {typeLabel(item.callType)}
          </NeonText>
          <NeonText size="caption" color={colors.textMuted} glow={false}>
            {item.peerName || item.peerId.slice(0, 12)}... • {connLabel(item.connectionType)}
          </NeonText>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <NeonText size="body" color={colors.text} glow={false}>
            {formatDuration(item.duration)}
          </NeonText>
          <NeonText size="caption" color={colors.textMuted} glow={false}>
            {new Date(item.timestamp).toLocaleString()}
          </NeonText>
        </View>
      </View>
    </GlassCard>
  );

  return (
    <View style={styles.container}>
      <NeonText size="h1" color={colors.neonCyan} style={{ textAlign: 'center' }}>
        {t('history_title')}
      </NeonText>
      <NeonText size="caption" color={colors.textSecondary} glow={false}>
        {t('history_subtitle')}
      </NeonText>

      {history.length > 0 && (
        <GlassButton
          title={t('history_clear')}
          onPress={clearHistory}
          variant="danger"
          style={{ marginTop: spacing.md }}
        />
      )}

      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        style={{ marginTop: spacing.md }}
        ListEmptyComponent={
          <GlassCard style={{ marginTop: spacing.md }}>
            <NeonText size="h2" color={colors.textMuted} glow={false} style={{ textAlign: 'center' }}>
              {t('history_no_history')}
            </NeonText>
            <NeonText size="caption" color={colors.textMuted} glow={false} style={{ textAlign: 'center', marginTop: spacing.sm }}>
              {t('history_hint')}
            </NeonText>
          </GlassCard>
        }
      />
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
  historyCard: {
    marginBottom: spacing.sm,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
