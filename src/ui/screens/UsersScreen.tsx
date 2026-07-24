import { useState, useEffect, useCallback, useRef } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { NeonText } from '../components/NeonText';
import { GlassButton } from '../components/GlassButton';
import { GlassInput } from '../components/GlassInput';
import { spacing } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { P2PMessenger, type P2PState } from '../../core/p2p/P2PMessenger';
import { AsyncStorageAdapter } from '../../storage/AsyncStorageAdapter';
import { identityManager, type UserIdentity } from '../../core/identity/IdentityManager';
import { useLocale } from '../../i18n/LocaleContext';
import { userStore, type OnlineUser, type UserStatus } from '../../core/identity/UserStore';
import { validateNickname } from '../../core/identity/nickname';
import type { DiscoveredPeerEvent } from '../../native/P2PBridge';

const store = new AsyncStorageAdapter();
const messenger = P2PMessenger.getInstance(store);

const statusColors: Record<UserStatus, string> = {
  online: '#00ff88',
  busy: '#4488ff',
  offline: '#ff3355',
};

export default function UsersScreen() {
  const { t } = useLocale();
  const { colors } = useTheme();
  const [_p2p, setP2P] = useState<P2PState>(messenger.getState());
  const [identity, setIdentity] = useState<UserIdentity | null>(null);
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [discovered, setDiscovered] = useState<DiscoveredPeerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [myStatus, setMyStatus] = useState<UserStatus>('online');
  const [nickInput, setNickInput] = useState('');
  const [nickError, setNickError] = useState<string | null>(null);
  const [friendReq, setFriendReq] = useState<{ from: string; connId: string } | null>(null);
  const nickRef = useRef(identity?.nickname);

  useEffect(() => {
    const init = async () => {
      await messenger.init().catch(() => {});
      const s = messenger.getState();
      const id = await identityManager.load();
      setIdentity(id);
      nickRef.current = id?.nickname;
      await userStore.load();
      setUsers(userStore.getAll());
      const st = await userStore.getMyStatus();
      setMyStatus(st);
      setLoading(false);
      if (s.peerId && id && st !== 'offline') {
        await messenger.startServer(0).catch(() => {});
        messenger.startDiscovery(id.nickname).catch(() => {});
      }
    };
    init();
    const unsubP2P = messenger.subscribe((s) => {
      setP2P(s);
      if (!s.serverInfo) { setDiscovered([]); }
      if (s.peerId && identity && s.status === 'running') {
        messenger.startDiscovery(identity.nickname).catch(() => {});
      }
    });
    const unsubId = identityManager.subscribe((id) => {
      setIdentity(id);
      if (id && nickRef.current !== id.nickname) {
        nickRef.current = id.nickname;
        const all = userStore.getAll();
        setUsers(all);
      }
      if (id && _p2p.peerId) {
        messenger.startDiscovery(id.nickname).catch(() => {});
      }
    });
    const unsubUsers = userStore.subscribe(() => {
      const all = userStore.getAll();
      setUsers(all);
      userStore.getMyStatus().then((st) => {
        setMyStatus(st);
        if (st === 'offline') { setDiscovered([]); }
      });
    });
    const unsubDisc = messenger.onPeerDiscovered((peer) => {
      setDiscovered((prev) => {
        const exists = prev.find((p) => p.peerId === peer.peerId);
        if (exists) { return prev; }
        return [...prev, peer];
      });
    });
    const unsubReq = messenger.onFriendRequest((ev) => {
      setFriendReq({ from: ev.from, connId: ev.connectionId });
    });
    return () => { unsubP2P(); unsubId(); unsubUsers(); unsubDisc(); unsubReq(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const currentNick = identity?.nickname;
    discovered.forEach((d) => {
      if (d.nickname && d.nickname !== currentNick) {
        userStore.addOrUpdate({ nickname: d.nickname, host: d.host, port: d.port, status: 'online', isFavorite: false, lastSeen: Date.now() });
        setUsers(userStore.getAll());
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discovered]);

  const toggleFavorite = useCallback(async (nickname: string) => {
    await userStore.toggleFavorite(nickname);
    setUsers(userStore.getAll());
  }, []);

  const handleConnect = useCallback(async (peer: DiscoveredPeerEvent | OnlineUser) => {
    try {
      await messenger.connect(peer.host, peer.port);
      await messenger.sendMessage(JSON.stringify({ type: 'friend_request', from: identity?.nickname || 'unknown' }), 'conn_' + peer.host + '_' + peer.port);
      const u: OnlineUser = { ...peer, status: 'online', isFavorite: false, lastSeen: Date.now() };
      userStore.addOrUpdate(u);
      setUsers(userStore.getAll());
    } catch {}
  }, [identity]);

  const allUsers = [...users];
  discovered.forEach((d) => {
    if (!allUsers.find((u) => u.nickname === d.nickname) && d.nickname !== identity?.nickname) {
      allUsers.push({ nickname: d.nickname, host: d.host, port: d.port, status: 'online', isFavorite: userStore.getAll().some((x) => x.nickname === d.nickname && x.isFavorite), lastSeen: Date.now() });
    }
  });

  const [searchQuery, setSearchQuery] = useState('');

  const filtered = allUsers.filter((u) =>
    !searchQuery ||
    u.nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.host.includes(searchQuery)
  );

  const sortedUsers = [...filtered].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) { return a.isFavorite ? -1 : 1; }
    const so = statusOrder(a.status);
    const sb = statusOrder(b.status);
    if (so !== sb) { return so - sb; }
    return a.nickname.localeCompare(b.nickname);
  });

  if (loading) { return <View style={styles.container} />; }

  if (!identity) {
    return (
      <View style={styles.container}>
        <NeonText size="h1" color={colors.neonPink} style={{ textAlign: 'center' }}>
          {t('users_title')}
        </NeonText>
        <GlassCard style={{ marginTop: spacing.xl }} borderColor={colors.neonCyanDim} glowColor={colors.neonCyan}>
          <NeonText size="h2" color={colors.neonCyan} glow={false}>{t('mesh_step1_title')}</NeonText>
          <NeonText size="caption" color={colors.textMuted} glow={false} style={{ marginTop: spacing.xs }}>{t('mesh_step1_desc')}</NeonText>
          <GlassInput placeholder={t('mesh_nick_placeholder')} value={nickInput} onChangeText={(v) => { setNickInput(v); setNickError(null); }} style={{ marginTop: spacing.md }} autoCapitalize="none" />
          {nickError && <NeonText size="caption" color={colors.error} glow={false} style={{ marginTop: spacing.sm }}>{nickError}</NeonText>}
          <GlassButton title={t('mesh_create_nick')} onPress={async () => {
            const err = validateNickname(nickInput.trim());
            if (err) { setNickError(err); return; }
            try {
              await messenger.init();
              const state = messenger.getState();
              if (!state.peerId) { setNickError(t('mesh_err_init') + ': no peer ID'); return; }
              const idErr = await identityManager.register(nickInput.trim(), state.peerId);
              if (idErr) { setNickError(idErr); }
            } catch (e: any) { setNickError(t('mesh_err_init') + ': ' + (e?.message || 'unknown')); }
          }} variant="primary" style={{ marginTop: spacing.md }} loading={_p2p.status === 'starting'} />
        </GlassCard>
        <GlassCard style={{ marginTop: spacing.lg }}>
          <NeonText size="caption" color={colors.textMuted} glow={false}>{t('mesh_rules')}</NeonText>
        </GlassCard>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NeonText size="h1" color={colors.neonPink} style={{ textAlign: 'center' }}>
        {t('users_title')}
      </NeonText>
      {identity && (
        <NeonText size="h2" color={colors.neonGreen} glow style={{ textAlign: 'center', marginTop: spacing.xs }}>
          {identity.nickname}
        </NeonText>
      )}

      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: statusColors[myStatus] }]} />
        <NeonText size="caption" color={colors.textMuted} glow={false}>
          {discovered.length > 0 ? `${t('users_found')}: ${discovered.length}` : t('users_scanning')}
        </NeonText>
      </View>

      {friendReq && (
        <GlassCard borderColor={colors.neonCyanDim} glowColor={colors.neonCyan} style={{ marginBottom: spacing.sm }}>
          <NeonText size="body" color={colors.neonCyan} glow={false}>
            {t('users_friend_req')}: {friendReq.from}
          </NeonText>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <GlassButton title={t('call_accept')} onPress={() => {
              userStore.addOrUpdate({ nickname: friendReq.from, host: '', port: 0, status: 'online' as const, isFavorite: false, lastSeen: Date.now() });
              setUsers(userStore.getAll());
              setFriendReq(null);
            }} variant="primary" style={{ flex: 1, minHeight: 36, paddingVertical: spacing.xs }} />
            <GlassButton title={t('call_decline')} onPress={() => setFriendReq(null)} variant="danger" style={{ flex: 1, minHeight: 36, paddingVertical: spacing.xs }} />
          </View>
        </GlassCard>
      )}

      {allUsers.length === 0 ? (
        <GlassCard style={{ marginTop: spacing.md }}>
          <NeonText size="body" color={colors.textMuted} glow={false} style={{ textAlign: 'center' }}>
            {t('users_empty')}
          </NeonText>
          <NeonText size="caption" color={colors.textMuted} glow={false} style={{ textAlign: 'center', marginTop: spacing.sm }}>
            {t('users_empty_hint')}
          </NeonText>
        </GlassCard>
      ) : (
        <FlatList
          data={sortedUsers}
          keyExtractor={(item) => item.nickname + item.host}
          style={{ marginTop: spacing.md }}
          renderItem={({ item }) => (
            <GlassCard style={styles.userCard}>
              <View style={styles.userRow}>
                <TouchableOpacity onPress={() => toggleFavorite(item.nickname)} style={styles.starBtn}>
                  <Text style={{ color: item.isFavorite ? '#FFD700' : colors.textMuted, fontSize: 20 }}>
                    {item.isFavorite ? '★' : '☆'}
                  </Text>
                </TouchableOpacity>
                <View style={styles.userInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <View style={[styles.userDot, { backgroundColor: statusColors[item.status] }]} />
                    <NeonText size="body" color={colors.text} glow={false}>
                      {item.nickname}
                    </NeonText>
                    <NeonText size="caption" color={statusColors[item.status]} glow={false}>
                      • {item.status}
                    </NeonText>
                  </View>
                  <NeonText size="caption" color={colors.textMuted} glow={false}>
                    {item.host}:{item.port}
                  </NeonText>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                  <TouchableOpacity onPress={() => handleConnect(item)} style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 8, borderWidth: 1, borderColor: colors.neonCyan }}>
                    <Text style={{ color: colors.neonCyan, fontSize: 12 }}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </GlassCard>
          )}
        />
      )}
    </View>
  );
}

function statusOrder(s: UserStatus): number {
  if (s === 'online') { return 0; }
  if (s === 'busy') { return 1; }
  return 2;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f', paddingHorizontal: spacing.md, paddingTop: spacing.xxl, paddingBottom: spacing.xl },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
  userDot: { width: 10, height: 10, borderRadius: 5 },
  userCard: { marginBottom: spacing.sm },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  userInfo: { flex: 1 },
  starBtn: { padding: spacing.xs },
});
