import { useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, ScrollView } from 'react-native';
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

const store = new AsyncStorageAdapter();
const messenger = new P2PMessenger(store);

export default function MessagesScreen() {
  const { t } = useLocale();
  const [p2p, setP2P] = useState<P2PState>(messenger.getState());
  const [identity, setIdentity] = useState<UserIdentity | null>(null);
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [message, setMessage] = useState('');
  const [targetConn, setTargetConn] = useState('');
  const [loaded, setLoaded] = useState(false);

  useState(() => {
    identityManager.load().then((id) => { setIdentity(id); setLoaded(true); });
    messenger.subscribe(setP2P);
    identityManager.subscribe(setIdentity);
  });

  const handleConnect = useCallback(async () => {
    const p = Number(port);
    if (!host || !p) {return;}
    try { await messenger.connect(host, p); } catch {}
  }, [host, port]);

  const handleSend = useCallback(async () => {
    if (!message || !targetConn) {return;}
    try { await messenger.sendMessage(message, targetConn); setMessage(''); } catch {}
  }, [message, targetConn]);

  const peerList = Array.from(p2p.connectedPeers.entries());

  if (!loaded) { return <View style={styles.container} />; }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInner}>
      <NeonText size="h1" color={colors.neonCyan} style={{ textAlign: 'center' }}>
        {t('msg_title')}
      </NeonText>
      {identity && (
        <NeonText size="h2" color={colors.neonGreen} glow style={{ textAlign: 'center', marginTop: spacing.xs }}>
          {identity.nickname}
        </NeonText>
      )}

      {!p2p.serverInfo && (
        <GlassButton
          title={t('mesh_become_visible')}
          onPress={() => messenger.startServer(0).catch(() => {})}
          variant="secondary"
          style={{ marginTop: spacing.md }}
        />
      )}

      <GlassCard style={{ marginTop: spacing.md }}>
        <NeonText size="h2" color={colors.neonGreen} glow={false}>
          {t('mesh_connect_peer')}
        </NeonText>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
          <View style={{ flex: 2 }}>
            <GlassInput placeholder={t('mesh_host_placeholder')} value={host} onChangeText={setHost} />
          </View>
          <View style={{ flex: 1 }}>
            <GlassInput placeholder={t('mesh_port_placeholder')} value={port} onChangeText={setPort} keyboardType="numeric" />
          </View>
        </View>
        <GlassButton title={t('mesh_connect')} onPress={handleConnect} variant="primary" style={{ marginTop: spacing.sm }} />
      </GlassCard>

      {peerList.length > 0 && (
        <>
          <GlassCard borderColor={colors.neonPinkDim} glowColor={colors.neonPink} style={{ marginTop: spacing.md }}>
            <NeonText size="h2" color={colors.neonPink} glow={false}>
              {t('mesh_connected_peers')} ({peerList.length})
            </NeonText>
            {peerList.map(([connId, info]) => (
              <View key={connId} style={styles.peerRow}>
                <NeonText size="caption" color={colors.text} glow={false}>{info.host}:{info.port}</NeonText>
                <GlassButton title="✕" onPress={() => messenger.disconnect(connId)} variant="danger" style={styles.smallBtn} />
              </View>
            ))}
          </GlassCard>

          <GlassCard style={{ marginTop: spacing.md }}>
            <NeonText size="h2" color={colors.neonCyan} glow={false}>{t('mesh_send_msg')}</NeonText>
            <GlassInput placeholder={t('mesh_target_conn')} value={targetConn} onChangeText={setTargetConn} style={{ marginTop: spacing.sm }} />
            <GlassInput placeholder={t('mesh_message_placeholder')} value={message} onChangeText={setMessage} style={{ marginTop: spacing.sm }} multiline />
            <GlassButton title={t('mesh_send_encrypted')} onPress={handleSend} variant="primary" style={{ marginTop: spacing.sm }} />
          </GlassCard>
        </>
      )}

      {p2p.messages.length > 0 && (
        <GlassCard style={{ marginTop: spacing.md }}>
          <NeonText size="h2" color={colors.neonGreen} glow={false}>
            {t('mesh_messages')} ({p2p.messages.length})
          </NeonText>
          <FlatList
            data={p2p.messages}
            keyExtractor={(item) => item.id}
            style={{ marginTop: spacing.sm, maxHeight: 300 }}
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
  scroll: { flex: 1, backgroundColor: colors.bg },
  scrollInner: { paddingHorizontal: spacing.md, paddingTop: spacing.xxl, paddingBottom: spacing.xl },
  container: { flex: 1, backgroundColor: colors.bg },
  peerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  smallBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, minHeight: 32 },
  msgRow: { marginBottom: spacing.xs },
});
