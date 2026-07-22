import { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { NeonText } from '../components/NeonText';
import { GlassButton } from '../components/GlassButton';
import { colors, spacing } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCallTypeIcon = (type: CallRecord['callType']): string => {
    switch (type) {
      case 'outgoing': return '→';
      case 'incoming': return '←';
      case 'missed': return '✗';
    }
  };

  const getCallTypeColor = (type: CallRecord['callType']): string => {
    switch (type) {
      case 'outgoing': return colors.neonGreen;
      case 'incoming': return colors.neonCyan;
      case 'missed': return colors.error;
    }
  };

  const renderCall = ({ item }: { item: CallRecord }) => (
    <GlassCard style={styles.callCard}>
      <View style={styles.callHeader}>
        <View style={styles.callInfo}>
          <View style={[styles.callIcon, { backgroundColor: getCallTypeColor(item.callType) }]}>
            <NeonText size="body" color={colors.bg} glow={false}>
              {getCallTypeIcon(item.callType)}
            </NeonText>
          </View>
          <View style={{ flex: 1 }}>
            <NeonText size="body" color={colors.text} glow={false}>
              {item.peerName}
            </NeonText>
            <NeonText size="caption" color={colors.textMuted} glow={false}>
              {item.peerId.slice(0, 16)}...
            </NeonText>
          </View>
        </View>
        <View style={styles.callMeta}>
          <NeonText size="caption" color={colors.textMuted} glow={false}>
            {new Date(item.timestamp).toLocaleString()}
          </NeonText>
          {item.duration > 0 && (
            <NeonText size="caption" color={colors.neonGreen} glow={false}>
              {formatDuration(item.duration)}
            </NeonText>
          )}
        </View>
      </View>
      <View style={styles.callFooter}>
        <View style={[styles.connectionBadge, { backgroundColor: colors.neonCyanDim }]}>
          <NeonText size="caption" color={colors.neonCyan} glow={false}>
            {item.connectionType.toUpperCase()}
          </NeonText>
        </View>
      </View>
    </GlassCard>
  );

  return (
    <View style={styles.container}>
      <NeonText size="h1" color={colors.neonGreen} style={{ textAlign: 'center' }}>
        CALL HISTORY
      </NeonText>
      <NeonText size="caption" color={colors.textSecondary} glow={false}>
        {history.length} call{history.length !== 1 ? 's' : ''} recorded
      </NeonText>

      {/* Statistics */}
      {history.length > 0 && (
        <GlassCard style={{ marginTop: spacing.md }}>
          <NeonText size="h2" color={colors.neonCyan} glow={false}>
            Statistics
          </NeonText>
          <View style={styles.statRow}>
            <NeonText size="caption" color={colors.textMuted} glow={false}>
              Total Calls:
            </NeonText>
            <NeonText size="caption" color={colors.neonCyan} glow>
              {history.length}
            </NeonText>
          </View>
          <View style={styles.statRow}>
            <NeonText size="caption" color={colors.textMuted} glow={false}>
              Outgoing:
            </NeonText>
            <NeonText size="caption" color={colors.neonGreen} glow={false}>
              {history.filter((c) => c.callType === 'outgoing').length}
            </NeonText>
          </View>
          <View style={styles.statRow}>
            <NeonText size="caption" color={colors.textMuted} glow={false}>
              Incoming:
            </NeonText>
            <NeonText size="caption" color={colors.neonCyan} glow={false}>
              {history.filter((c) => c.callType === 'incoming').length}
            </NeonText>
          </View>
          <View style={styles.statRow}>
            <NeonText size="caption" color={colors.textMuted} glow={false}>
              Missed:
            </NeonText>
            <NeonText size="caption" color={colors.error} glow={false}>
              {history.filter((c) => c.callType === 'missed').length}
            </NeonText>
          </View>
          <View style={styles.statRow}>
            <NeonText size="caption" color={colors.textMuted} glow={false}>
              Total Duration:
            </NeonText>
            <NeonText size="caption" color={colors.neonGreen} glow={false}>
              {formatDuration(history.reduce((sum, c) => sum + c.duration, 0))}
            </NeonText>
          </View>
        </GlassCard>
      )}

      {/* Call List */}
      {history.length > 0 ? (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          renderItem={renderCall}
          style={{ marginTop: spacing.md }}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <GlassCard style={{ marginTop: spacing.md }}>
          <NeonText size="h2" color={colors.textMuted} glow={false} style={{ textAlign: 'center' }}>
            No call history
          </NeonText>
          <NeonText size="caption" color={colors.textMuted} glow={false} style={{ textAlign: 'center', marginTop: spacing.sm }}>
            Your call logs will appear here
          </NeonText>
        </GlassCard>
      )}

      {/* Clear Button */}
      {history.length > 0 && (
        <GlassCard style={{ marginTop: spacing.md }} borderColor={colors.errorDim} glowColor={colors.error}>
          <NeonText size="h2" color={colors.error} glow={false}>
            Clear History
          </NeonText>
          <NeonText size="caption" color={colors.textMuted} glow={false} style={{ marginTop: spacing.sm }}>
            This will permanently delete all call records
          </NeonText>
          <GlassButton
            title="Clear All"
            onPress={clearHistory}
            variant="danger"
            style={{ marginTop: spacing.sm }}
          />
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
  callCard: {
    marginBottom: spacing.sm,
  },
  callHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  callInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  callIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  callMeta: {
    alignItems: 'flex-end',
  },
  callFooter: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  connectionBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
});
