import { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { NeonText } from '../components/NeonText';
import { GlassButton } from '../components/GlassButton';
import { GlassInput } from '../components/GlassInput';
import { spacing } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { CallManager } from '../../core/call/CallManager';
import { P2PMessenger } from '../../core/p2p/P2PMessenger';
import { AsyncStorageAdapter } from '../../storage/AsyncStorageAdapter';
import { CallScreen } from './CallScreen';
import type { CallState } from '../../core/call/types';
import { useLocale } from '../../i18n/LocaleContext';
import { identityManager, type UserIdentity } from '../../core/identity/IdentityManager';
import { userStore, type OnlineUser } from '../../core/identity/UserStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const callManager = new CallManager();
const aStore = new AsyncStorageAdapter();
const messenger = P2PMessenger.getInstance(aStore);
const CALL_HISTORY_KEY = 'call_history';

interface CallRecord {
  id: string; peerId: string; peerName: string;
  callType: 'outgoing' | 'incoming' | 'missed';
  duration: number; timestamp: number; connectionType: string;
}

export default function CallsScreen() {
  const { t } = useLocale();
  const { colors } = useTheme();
  const [call, setCall] = useState<CallState>(callManager.getState());
  const [identity, setIdentity] = useState<UserIdentity | null>(null);
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [history, setHistory] = useState<CallRecord[]>([]);
  const [mode, setMode] = useState<'direct' | 'room' | 'history'>('direct');
  const [roomName, setRoomName] = useState('');
  const [roomType, setRoomType] = useState<'public' | 'private'>('public');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [voiceActivation, setVoiceActivation] = useState(true);
  const [loading, setLoading] = useState(true);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [roomUsers, setRoomUsers] = useState<string[]>([]);

  useEffect(() => {
    const init = async () => {
      identityManager.load().then(setIdentity);
      await userStore.load();
      setUsers(userStore.getAll().filter((u) => u.status !== 'offline'));
      setLoading(false);
    };
    init();
    callManager.init();
    const unsubCall = callManager.subscribe(setCall);
    const unsubId = identityManager.subscribe(setIdentity);
    const unsubUsers = userStore.subscribe(() => setUsers(userStore.getAll().filter((u) => u.status !== 'offline')));
    loadHistory();
    return () => { unsubCall(); unsubId(); unsubUsers(); };
  }, []);

  const loadHistory = async () => {
    const raw = await AsyncStorage.getItem(CALL_HISTORY_KEY);
    if (raw) { setHistory(JSON.parse(raw)); }
  };

  const handleDirectCall = useCallback(async (nickname: string, _peerId: string) => {
    const entries = Array.from(messenger.getState().connectedPeers.entries());
    const connId = entries.length > 0 ? entries[0][0] : nickname;
    await callManager.startCall(connId, nickname);
  }, []);

  const handleRoomCall = useCallback(async () => {
    if (!roomName) { return; }
    const target = selectedUsers.length > 0 ? selectedUsers.join(',') : roomName;
    await callManager.startCall(target, roomName);
    setActiveRoom(roomName);
    setRoomUsers([...selectedUsers]);
  }, [roomName, selectedUsers]);

  const addToRoom = (nick: string) => {
    if (!roomUsers.includes(nick)) { setRoomUsers([...roomUsers, nick]); }
  };

  const removeFromRoom = (nick: string) => {
    setRoomUsers(roomUsers.filter((n) => n !== nick));
  };

  const toggleUser = (nick: string) => {
    setSelectedUsers((prev) => prev.includes(nick) ? prev.filter((n) => n !== nick) : [...prev, nick]);
  };

  const isInCall = call.status !== 'idle';

  if (loading) { return <View style={styles.container} />; }

  const onlineUsers = users.filter((u) => u.status === 'online');

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
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
          <>
            {onlineUsers.length === 0 ? (
              <NeonText size="body" color={colors.textMuted} glow={false} style={{ textAlign: 'center', marginTop: spacing.xl }}>
                {t('calls_no_users')}
              </NeonText>
            ) : (
              <FlatList
                data={onlineUsers}
                keyExtractor={(u) => u.nickname}
                style={{ marginTop: spacing.md }}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <GlassCard style={{ marginBottom: spacing.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.neonGreen }} />
                        <NeonText size="body" color={colors.text} glow={false}>{item.nickname}</NeonText>
                      </View>
                      <GlassButton title={t('call_accept')} onPress={() => handleDirectCall(item.nickname, '')} variant="primary" style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs, minHeight: 30 }} />
                    </View>
                  </GlassCard>
                )}
              />
            )}
          </>
        )}

        {mode === 'room' && (
          <GlassCard style={{ marginTop: spacing.md }}>
            <NeonText size="h2" color={colors.neonPink} glow={false}>{t('calls_room_title')}</NeonText>
            <GlassInput placeholder={t('calls_room_name')} value={roomName} onChangeText={setRoomName} style={{ marginTop: spacing.sm }} />
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <TouchableOpacity onPress={() => setRoomType('public')} style={[styles.typeBtn, roomType === 'public' && { borderColor: colors.neonCyan, backgroundColor: colors.neonCyanDim }]}>
                <Text style={{ color: roomType === 'public' ? colors.neonCyan : colors.textMuted, fontSize: 12 }}>{t('calls_public')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setRoomType('private')} style={[styles.typeBtn, roomType === 'private' && { borderColor: colors.neonPink, backgroundColor: colors.neonPinkDim }]}>
                <Text style={{ color: roomType === 'private' ? colors.neonPink : colors.textMuted, fontSize: 12 }}>{t('calls_private')}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setVoiceActivation(!voiceActivation)} style={[styles.typeBtn, { marginTop: spacing.xs }, voiceActivation && { borderColor: colors.neonGreen, backgroundColor: colors.neonGreenDim }]}>
              <Text style={{ color: voiceActivation ? colors.neonGreen : colors.textMuted, fontSize: 12 }}>
                {voiceActivation ? '\u{1F399} Voice ON' : '\u{1F399} Voice OFF'}
              </Text>
            </TouchableOpacity>
            {roomType === 'private' && (
              <>
                <NeonText size="caption" color={colors.textMuted} glow={false} style={{ marginTop: spacing.sm }}>{t('calls_invite')}</NeonText>
                {users.map((u) => (
                  <TouchableOpacity key={u.nickname} onPress={() => toggleUser(u.nickname)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
                    <Text style={{ color: selectedUsers.includes(u.nickname) ? colors.neonCyan : colors.textMuted, fontSize: 16 }}>
                      {selectedUsers.includes(u.nickname) ? '☑' : '☐'}
                    </Text>
                    <NeonText size="caption" color={colors.text} glow={false}>{u.nickname}</NeonText>
                  </TouchableOpacity>
                ))}
              </>
            )}
            <GlassButton title={t('calls_create_room')} onPress={handleRoomCall} variant="primary" style={{ marginTop: spacing.md }} />
            {activeRoom && (
              <View style={{ marginTop: spacing.md }}>
                <NeonText size="h2" color={colors.neonGreen} glow={false}>{t('calls_room_active')}: {activeRoom}</NeonText>
                <NeonText size="caption" color={colors.textMuted} glow={false} style={{ marginTop: spacing.xs }}>{t('calls_room_invite')}</NeonText>
                {users.filter((u) => !roomUsers.includes(u.nickname)).map((u) => (
                  <TouchableOpacity key={u.nickname} onPress={() => addToRoom(u.nickname)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
                    <Text style={{ color: colors.neonCyan, fontSize: 14 }}>+</Text>
                    <NeonText size="caption" color={colors.text} glow={false}>{u.nickname}</NeonText>
                  </TouchableOpacity>
                ))}
                {roomUsers.length > 0 && <NeonText size="caption" color={colors.neonPink} glow={false} style={{ marginTop: spacing.sm }}>{t('calls_room_members')}:</NeonText>}
                {roomUsers.map((u) => (
                  <TouchableOpacity key={u} onPress={() => removeFromRoom(u)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
                    <Text style={{ color: colors.error, fontSize: 14 }}>✕</Text>
                    <NeonText size="caption" color={colors.text} glow={false}>{u}</NeonText>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </GlassCard>
        )}

        {mode === 'history' && (
          <FlatList
            data={history}
            keyExtractor={(item) => item.id}
            style={{ marginTop: spacing.md }}
            ListEmptyComponent={<NeonText size="body" color={colors.textMuted} glow={false} style={{ textAlign: 'center', marginTop: spacing.xl }}>{t('history_no_history')}</NeonText>}
            renderItem={({ item }) => (
              <GlassCard style={{ marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View>
                    <NeonText size="caption" color={item.callType === 'missed' ? colors.error : colors.neonGreen} glow={false}>{t('history_' + item.callType)}</NeonText>
                    <NeonText size="caption" color={colors.textMuted} glow={false}>{item.peerName || item.peerId.slice(0, 12)}... • {item.duration}s</NeonText>
                  </View>
                  <NeonText size="caption" color={colors.textMuted} glow={false}>{new Date(item.timestamp).toLocaleString()}</NeonText>
                </View>
              </GlassCard>
            )}
          />
        )}
      </ScrollView>

      {isInCall && (
        <CallScreen call={call} onAccept={() => callManager.acceptCall()} onReject={() => callManager.rejectCall()} onEnd={() => callManager.endCall()} onToggleMute={() => callManager.toggleMute()} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.md, paddingTop: spacing.xxl, paddingBottom: spacing.xl },
  modeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  modeBtn: { flex: 1, minHeight: 36, paddingHorizontal: 4 },
  typeBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: 8, borderWidth: 1, borderColor: '#333', alignItems: 'center' },
});
