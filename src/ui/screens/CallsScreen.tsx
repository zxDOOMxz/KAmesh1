import { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, ScrollView } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { NeonText } from '../components/NeonText';
import { GlassButton } from '../components/GlassButton';
import { GlassInput } from '../components/GlassInput';
import { colors, spacing } from '../theme';
import { CallManager } from '../../core/call/CallManager';
import { CallScreen } from './CallScreen';
import type { CallState } from '../../core/call/types';
import { useLocale } from '../../i18n/LocaleContext';
import { identityManager, type UserIdentity } from '../../core/identity/IdentityManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

const callManager = new CallManager();
const CALL_HISTORY_KEY = 'call_history';

interface CallRecord {
  id: string;
  peerId: string;
  peerName: string;
  callType: 'outgoing' | 'incoming' | 'missed';
  duration: number;
  timestamp: number;
  connectionType: 'wifi' | 'bluetooth' | 'internet';
}

export default function CallsScreen() {
  const { t } = useLocale();
  const [call, setCall] = useState<CallState>(callManager.getState());
  const [identity, setIdentity] = useState<UserIdentity | null>(null);
  const [targetPeer, setTargetPeer] = useState('');
  const [roomName, setRoomName] = useState('');
  const [history, setHistory] = useState<CallRecord[]>([]);
  const [mode, setMode] = useState<'direct' | 'room' | 'history'>('direct');

  useEffect(() => {
    identityManager.load().then(setIdentity);
    callManager.init();
    const unsub = callManager.subscribe(setCall);
    loadHistory();
    return unsub;
  }, []);

  const loadHistory = async () => {
    const raw = await AsyncStorage.getItem(CALL_HISTORY_KEY);
    if (raw) setHistory(JSON.parse(raw));
  };

  const handleCall = useCallback(async () => {
    if (!targetPeer) {return;}
    await callManager.startCall(targetPeer, targetPeer);
  }, [targetPeer]);

  const handleRoomCall = useCallback(async () => {
    if (!roomName) {return;}
    await callManager.startCall(roomName, roomName);
  }, [roomName]);

  const isInCall = call.status !== 'idle';

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInner}>
        <NeonText size="h1" color={colors.neonBlue} style={{ textAlign: 'center' }}>
          {t('calls_title')}
        </NeonText>
        {identity && (
          <NeonText size="h2" color={colors.neonGreen} glow style={{ textAlign: 'center', marginTop: spacing.xs }}>
            {identity.nickname}
          </NeonText>
        )}

        <View style={styles.modeRow}>
          <GlassButton title={t('calls_direct')} onPress={() => setMode('direct')} variant={mode === 'direct' ? 'primary' : 'secondary'} style={styles.modeBtn} />
          <GlassButton title={t('calls_room')} onPress={() => setMode('room')} variant={mode === 'room' ? 'primary' : 'secondary'} style={styles.modeBtn} />
          <GlassButton title={t('calls_history')} onPress={() => setMode('history')} variant={mode === 'history' ? 'primary' : 'secondary'} style={styles.modeBtn} />
        </View>

        {mode === 'direct' && (
          <GlassCard style={{ marginTop: spacing.md }}>
            <NeonText size="h2" color={colors.neonBlue} glow={false}>{t('calls_direct')}</NeonText>
            <GlassInput placeholder={t('calls_peer_id')} value={targetPeer} onChangeText={setTargetPeer} style={{ marginTop: spacing.sm }} />
            <GlassButton title={t('call_accept')} onPress={handleCall} variant="primary" style={{ marginTop: spacing.sm }} />
          </GlassCard>
        )}

        {mode === 'room' && (
          <GlassCard style={{ marginTop: spacing.md }}>
            <NeonText size="h2" color={colors.neonPink} glow={false}>{t('calls_room_title')}</NeonText>
            <NeonText size="caption" color={colors.textMuted} glow={false} style={{ marginTop: spacing.xs }}>{t('calls_room_desc')}</NeonText>
            <GlassInput placeholder={t('calls_room_name')} value={roomName} onChangeText={setRoomName} style={{ marginTop: spacing.sm }} />
            <GlassButton title={t('calls_create_room')} onPress={handleRoomCall} variant="primary" style={{ marginTop: spacing.sm }} />
          </GlassCard>
        )}

        {mode === 'history' && (
          <FlatList
            data={history}
            keyExtractor={(item) => item.id}
            style={{ marginTop: spacing.md }}
            ListEmptyComponent={
              <NeonText size="body" color={colors.textMuted} glow={false} style={{ textAlign: 'center', marginTop: spacing.xl }}>
                {t('history_no_history')}
              </NeonText>
            }
            renderItem={({ item }) => (
              <GlassCard style={{ marginBottom: spacing.sm }}>
                <View style={styles.histRow}>
                  <View>
                    <NeonText size="caption" color={item.callType === 'missed' ? colors.error : colors.neonGreen} glow={false}>
                      {t(`history_${item.callType}`)}
                    </NeonText>
                    <NeonText size="caption" color={colors.textMuted} glow={false}>
                      {item.peerName || item.peerId.slice(0, 12)}... • {item.duration}s
                    </NeonText>
                  </View>
                  <NeonText size="caption" color={colors.textMuted} glow={false}>
                    {new Date(item.timestamp).toLocaleString()}
                  </NeonText>
                </View>
              </GlassCard>
            )}
          />
        )}
      </ScrollView>

      {isInCall && (
        <CallScreen
          call={call}
          onAccept={() => callManager.acceptCall()}
          onReject={() => callManager.rejectCall()}
          onEnd={() => callManager.endCall()}
          onToggleMute={() => callManager.toggleMute()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  scrollInner: { paddingHorizontal: spacing.md, paddingTop: spacing.xxl, paddingBottom: spacing.xl },
  modeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  modeBtn: { flex: 1, minHeight: 36 },
  histRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
