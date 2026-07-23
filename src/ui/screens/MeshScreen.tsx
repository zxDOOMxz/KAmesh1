import { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { NeonText } from '../components/NeonText';
import { GlassButton } from '../components/GlassButton';
import { GlassInput } from '../components/GlassInput';
import { colors, spacing } from '../theme';
import { P2PMessenger, type P2PState } from '../../core/p2p/P2PMessenger';
import { AsyncStorageAdapter } from '../../storage/AsyncStorageAdapter';
import { decodeUtf8 } from '../../utils/decodeUtf8';
import { useLocale } from '../../i18n/LocaleContext';
import { identityManager, type UserIdentity } from '../../core/identity/IdentityManager';
import { validateNickname } from '../../core/identity/nickname';

const store = new AsyncStorageAdapter();
const messenger = P2PMessenger.getInstance(store);

export default function MeshScreen() {
  const { t } = useLocale();
  const [p2p, setP2P] = useState<P2PState>(messenger.getState());
  const [identity, setIdentity] = useState<UserIdentity | null>(null);
  const [nickInput, setNickInput] = useState('');
  const [nickError, setNickError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [message, setMessage] = useState('');
  const [targetConn, setTargetConn] = useState('');

  useEffect(() => {
    const init = async () => {
      const id = await identityManager.load();
      setIdentity(id);
      setLoading(false);
    };
    init();
    const unsubP2P = messenger.subscribe(setP2P);
    const unsubId = identityManager.subscribe(setIdentity);
    return () => { unsubP2P(); unsubId(); };
  }, []);

  const handleRegister = useCallback(async () => {
    const error = validateNickname(nickInput.trim());
    if (error) { setNickError(error); return; }

    setNickError(null);
    try {
      await messenger.init();
      const state = messenger.getState();
      const err = await identityManager.register(nickInput.trim(), state.peerId);
      if (err) { setNickError(err); return; }
    } catch (e) {
      setNickError('Failed to create identity');
    }
  }, [nickInput]);

  const handleStartServer = useCallback(async () => {
    try { await messenger.startServer(0); } catch {}
  }, []);

  const handleConnect = useCallback(async () => {
    const p = Number(port);
    if (!host || !p) {return;}
    try { await messenger.connect(host, p); } catch {}
  }, [host, port]);

  const handleSend = useCallback(async () => {
    if (!message || !targetConn) {return;}
    try {
      await messenger.sendMessage(message, targetConn);
      setMessage('');
    } catch {}
  }, [message, targetConn]);

  const handleDisconnect = useCallback(async (connId: string) => {
    await messenger.disconnect(connId);
  }, []);

  if (loading) {
    return <View style={styles.container} />;
  }

  const peerList = Array.from(p2p.connectedPeers.entries());

  if (!identity) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInner}>
        <NeonText size="h1" color={colors.neonCyan} style={{ textAlign: 'center' }}>
          {t('mesh_welcome')}
        </NeonText>
        <NeonText size="body" color={colors.textSecondary} glow={false} style={{ textAlign: 'center', marginTop: spacing.md }}>
          {t('mesh_welcome_desc')}
        </NeonText>

        <GlassCard style={{ marginTop: spacing.xl }} borderColor={colors.neonCyanDim} glowColor={colors.neonCyan}>
          <NeonText size="h2" color={colors.neonCyan} glow={false}>
            {t('mesh_step1_title')}
          </NeonText>
          <NeonText size="caption" color={colors.textMuted} glow={false} style={{ marginTop: spacing.xs }}>
            {t('mesh_step1_desc')}
          </NeonText>
          <GlassInput
            placeholder={t('mesh_nick_placeholder')}
            value={nickInput}
            onChangeText={(v) => { setNickInput(v); setNickError(null); }}
            style={{ marginTop: spacing.md }}
            autoCapitalize="none"
          />
          {nickError && (
            <NeonText size="caption" color={colors.error} glow={false} style={{ marginTop: spacing.sm }}>
              {nickError}
            </NeonText>
          )}
          <GlassButton
            title={t('mesh_create_nick')}
            onPress={handleRegister}
            variant="primary"
            style={{ marginTop: spacing.md }}
            loading={p2p.status === 'starting'}
          />
        </GlassCard>

        <GlassCard style={{ marginTop: spacing.lg }}>
          <NeonText size="caption" color={colors.textMuted} glow={false}>
            {t('mesh_rules')}
          </NeonText>
        </GlassCard>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInner}>
      <NeonText size="h1" color={colors.neonCyan} style={{ textAlign: 'center' }}>
        {t('mesh_title')}
      </NeonText>
      <NeonText size="h2" color={colors.neonGreen} glow style={{ textAlign: 'center', marginTop: spacing.xs }}>
        {identity.nickname}
      </NeonText>
      <NeonText size="caption" color={colors.textMuted} glow={false} style={{ textAlign: 'center' }}>
        {t('mesh_subtitle')}
      </NeonText>

      <View style={styles.statusRow}>
        <View
          style={[styles.dot, {
            backgroundColor: p2p.status === 'running' ? colors.neonGreen
              : p2p.status === 'error' ? colors.error : colors.textMuted,
          }]}
        />
        <NeonText size="caption" color={colors.textMuted} glow={false}>
          {p2p.status === 'idle' ? t('mesh_status_ready')
            : p2p.status === 'starting' ? t('mesh_status_init')
              : p2p.status === 'error' ? t('mesh_status_error')
                : p2p.serverInfo ? `${t('mesh_visible')} — ${p2p.serverInfo.localIp}:${p2p.serverInfo.port}`
                  : t('mesh_status_online')}
        </NeonText>
      </View>

      {/* Step 2: Start server */}
      {!p2p.serverInfo && p2p.status === 'running' && (
        <GlassCard style={{ marginTop: spacing.md }} borderColor={colors.neonGreenDim} glowColor={colors.neonGreen}>
          <NeonText size="h2" color={colors.neonGreen} glow={false}>
            {t('mesh_step2_title')}
          </NeonText>
          <NeonText size="caption" color={colors.textMuted} glow={false} style={{ marginTop: spacing.xs }}>
            {t('mesh_step2_desc')}
          </NeonText>
          <GlassButton
            title={t('mesh_become_visible')}
            onPress={handleStartServer}
            variant="primary"
            style={{ marginTop: spacing.md }}
          />
        </GlassCard>
      )}

      {/* Step 3: Connect form */}
      {p2p.serverInfo && (
        <GlassCard style={{ marginTop: spacing.md }}>
          <NeonText size="h2" color={colors.neonGreen} glow={false}>
            {t('mesh_step3_title')}
          </NeonText>
          <NeonText size="caption" color={colors.textMuted} glow={false} style={{ marginTop: spacing.xs }}>
            {t('mesh_step3_desc')}
          </NeonText>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            <View style={{ flex: 2 }}>
              <GlassInput placeholder={t('mesh_host_placeholder')} value={host} onChangeText={setHost} />
            </View>
            <View style={{ flex: 1 }}>
              <GlassInput placeholder={t('mesh_port_placeholder')} value={port} onChangeText={setPort} keyboardType="numeric" />
            </View>
          </View>
          <GlassButton title={t('mesh_connect')} onPress={handleConnect} variant="primary" style={{ marginTop: spacing.sm }} />
        </GlassCard>
      )}

      {/* Connected peers */}
      {peerList.length > 0 && (
        <GlassCard borderColor={colors.neonPinkDim} glowColor={colors.neonPink} style={{ marginTop: spacing.md }}>
          <NeonText size="h2" color={colors.neonPink} glow={false}>
            {t('mesh_connected_peers')} ({peerList.length})
          </NeonText>
          {peerList.map(([connId, info]) => (
            <View key={connId} style={styles.peerRow}>
              <NeonText size="caption" color={colors.text} glow={false}>
                {info.host}:{info.port}
              </NeonText>
              <GlassButton title="✕" onPress={() => handleDisconnect(connId)} variant="danger" style={styles.smallBtn} />
            </View>
          ))}
        </GlassCard>
      )}

      {/* Send message */}
      {peerList.length > 0 && (
        <GlassCard style={{ marginTop: spacing.md }}>
          <NeonText size="h2" color={colors.neonCyan} glow={false}>
            {t('mesh_send_msg')}
          </NeonText>
          <GlassInput
            placeholder={t('mesh_target_conn')}
            value={targetConn}
            onChangeText={setTargetConn}
            style={{ marginTop: spacing.sm }}
          />
          <GlassInput
            placeholder={t('mesh_message_placeholder')}
            value={message}
            onChangeText={setMessage}
            style={{ marginTop: spacing.sm }}
            multiline
          />
          <GlassButton title={t('mesh_send_encrypted')} onPress={handleSend} variant="primary" style={{ marginTop: spacing.sm }} />
        </GlassCard>
      )}

      {/* Messages */}
      {p2p.messages.length > 0 && (
        <GlassCard style={{ marginTop: spacing.md }}>
          <NeonText size="h2" color={colors.neonGreen} glow={false}>
            {t('mesh_messages')} ({p2p.messages.length})
          </NeonText>
          <FlatList
            data={p2p.messages}
            keyExtractor={(item) => item.id}
            style={{ marginTop: spacing.sm, maxHeight: 250 }}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.msgRow}>
                <NeonText size="caption" color={colors.textMuted} glow={false}>
                  [{new Date(item.createdAt).toLocaleTimeString()}]
                </NeonText>
                <NeonText size="caption" color={colors.text} glow={false}>
                  {decodeUtf8(item.ciphertext).slice(0, 200)}
                </NeonText>
              </View>
            )}
          />
        </GlassCard>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollInner: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  peerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  smallBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 32,
  },
  msgRow: {
    marginBottom: spacing.xs,
  },
});
