import { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
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

const store = new AsyncStorageAdapter();
const messenger = new P2PMessenger(store);

export default function MeshScreen() {
  const { t } = useLocale();
  const [p2p, setP2P] = useState<P2PState>(messenger.getState());
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [message, setMessage] = useState('');
  const [targetConn, setTargetConn] = useState('');

  useEffect(() => {
    const unsub = messenger.subscribe(setP2P);
    return unsub;
  }, []);

  const handleInit = useCallback(async () => {
    try {
      await messenger.init();
    } catch (e) {
      console.error('Init failed', e);
    }
  }, []);

  const handleStartServer = useCallback(async () => {
    try {
      await messenger.startServer(0);
    } catch (e) {
      console.error('Server start failed', e);
    }
  }, []);

  const handleConnect = useCallback(async () => {
    const p = Number(port);
    if (!host || !p) {return;}
    try {
      await messenger.connect(host, p);
    } catch (e) {
      console.error('Connect failed', e);
    }
  }, [host, port]);

  const handleSend = useCallback(async () => {
    if (!message || !targetConn) {return;}
    try {
      await messenger.sendMessage(message, targetConn);
      setMessage('');
    } catch (e) {
      console.error('Send failed', e);
    }
  }, [message, targetConn]);

  const handleDisconnect = useCallback(async (connId: string) => {
    await messenger.disconnect(connId);
  }, []);

  const peerList = Array.from(p2p.connectedPeers.entries());

  return (
    <View style={styles.container}>
      <NeonText size="h1" color={colors.neonCyan} style={{ textAlign: 'center' }}>
        {t('mesh_title')}
      </NeonText>
      <NeonText size="caption" color={colors.textSecondary} glow={false}>
        {t('mesh_subtitle')}
      </NeonText>

      <View style={styles.statusRow}>
        <View
          style={[
            styles.dot,
            {
              backgroundColor:
                p2p.status === 'running'
                  ? colors.neonGreen
                  : p2p.status === 'error'
                    ? colors.error
                    : colors.textMuted,
            },
          ]}
        />
        <NeonText size="caption" color={colors.textMuted} glow={false}>
          {p2p.status === 'idle'
            ? t('mesh_status_not_init')
            : p2p.status === 'starting'
              ? t('mesh_status_init')
              : p2p.status === 'error'
                ? t('mesh_status_error')
                : p2p.peerId
                  ? `${t('mesh_id_label')}: ${p2p.peerId.slice(0, 16)}...`
                  : t('mesh_status_running')}
        </NeonText>
      </View>

      {p2p.status === 'idle' && (
        <GlassButton title={t('mesh_create_identity')} onPress={handleInit} variant="primary" />
      )}

      {p2p.status === 'running' && (
        <>
          {!p2p.serverInfo && (
            <GlassButton
              title={t('mesh_start_server')}
              onPress={handleStartServer}
              variant="secondary"
              style={{ marginTop: spacing.sm }}
            />
          )}
          {p2p.serverInfo && (
            <GlassCard
              borderColor={colors.neonCyanDim}
              glowColor={colors.neonCyan}
              style={{ marginTop: spacing.md }}
            >
              <NeonText size="caption" color={colors.neonCyan} glow={false}>
                {t('mesh_server')}: {p2p.serverInfo.localIp}:{p2p.serverInfo.port}
              </NeonText>
            </GlassCard>
          )}

          <GlassCard style={{ marginTop: spacing.md }}>
            <NeonText size="h2" color={colors.neonGreen} glow={false}>
              {t('mesh_connect_peer')}
            </NeonText>
            <GlassInput
              placeholder={t('mesh_host_placeholder')}
              value={host}
              onChangeText={setHost}
              style={{ marginTop: spacing.sm }}
            />
            <GlassInput
              placeholder={t('mesh_port_placeholder')}
              value={port}
              onChangeText={setPort}
              keyboardType="numeric"
              style={{ marginTop: spacing.sm }}
            />
            <GlassButton
              title={t('mesh_connect')}
              onPress={handleConnect}
              variant="primary"
              style={{ marginTop: spacing.sm }}
            />
          </GlassCard>

          {peerList.length > 0 && (
            <GlassCard
              borderColor={colors.neonPinkDim}
              glowColor={colors.neonPink}
              style={{ marginTop: spacing.md }}
            >
              <NeonText size="h2" color={colors.neonPink} glow={false}>
                {t('mesh_peers')} ({peerList.length})
              </NeonText>
              {peerList.map(([connId, info]) => (
                <View key={connId} style={styles.peerRow}>
                  <NeonText size="caption" color={colors.text} glow={false}>
                    {info.host}:{info.port}
                  </NeonText>
                  <GlassButton
                    title="X"
                    onPress={() => handleDisconnect(connId)}
                    variant="danger"
                    style={styles.smallBtn}
                  />
                </View>
              ))}
            </GlassCard>
          )}

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
              <GlassButton
                title={t('mesh_send_encrypted')}
                onPress={handleSend}
                variant="primary"
                style={{ marginTop: spacing.sm }}
              />
            </GlassCard>
          )}

          {p2p.messages.length > 0 && (
            <GlassCard style={{ marginTop: spacing.md, maxHeight: 200 }}>
              <NeonText size="h2" color={colors.neonGreen} glow={false}>
                {t('mesh_messages')} ({p2p.messages.length})
              </NeonText>
              <FlatList
                data={p2p.messages}
                keyExtractor={(item) => item.id}
                style={{ marginTop: spacing.sm }}
                renderItem={({ item }) => (
                  <View style={styles.msgRow}>
                    <NeonText size="caption" color={colors.textMuted} glow={false}>
                      [{new Date(item.createdAt).toLocaleTimeString()}]
                    </NeonText>
                    <NeonText size="caption" color={colors.text} glow={false}>
                      {decodeUtf8(item.ciphertext).slice(0, 120)}
                    </NeonText>
                  </View>
                )}
              />
            </GlassCard>
          )}
        </>
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
