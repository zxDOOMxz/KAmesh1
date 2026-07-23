import { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { NeonText } from '../components/NeonText';
import { GlassButton } from '../components/GlassButton';
import { colors, spacing } from '../theme';
import { P2PMessenger, type P2PState } from '../../core/p2p/P2PMessenger';
import { AsyncStorageAdapter } from '../../storage/AsyncStorageAdapter';
import { identityManager, type UserIdentity } from '../../core/identity/IdentityManager';
import { useLocale } from '../../i18n/LocaleContext';
import { userStore, type OnlineUser, type UserStatus } from '../../core/identity/UserStore';

const store = new AsyncStorageAdapter();
const messenger = new P2PMessenger(store);

const statusColors: Record<UserStatus, string> = {
  online: colors.neonGreen,
  busy: colors.neonBlue,
  offline: colors.textMuted,
};

export default function UsersScreen() {
  const { t } = useLocale();
  const [p2p, setP2P] = useState<P2PState>(messenger.getState());
  const [identity, setIdentity] = useState<UserIdentity | null>(null);
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [myStatus, setMyStatus] = useState<UserStatus>('online');

  useEffect(() => {
    const init = async () => {
      await messenger.init().catch(() => {});
      const s = messenger.getState();
      if (s.peerId && s.status === 'running') {
        await messenger.startServer(0).catch(() => {});
      }
      const id = await identityManager.load();
      setIdentity(id);
      await userStore.load();
      setUsers(userStore.getAll());
      const st = await userStore.getMyStatus();
      setMyStatus(st);
      setLoading(false);
    };
    init();
    const unsubP2P = messenger.subscribe(setP2P);
    const unsubId = identityManager.subscribe(setIdentity);
    const unsubUsers = userStore.subscribe(() => { setUsers(userStore.getAll()); });
    return () => { unsubP2P(); unsubId(); unsubUsers(); };
  }, []);

  const toggleFavorite = useCallback(async (nickname: string) => {
    await userStore.toggleFavorite(nickname);
    setUsers(userStore.getAll());
  }, []);

  const sortedUsers = [...users].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) { return a.isFavorite ? -1 : 1; }
    const so = statusOrder(a.status);
    const sb = statusOrder(b.status);
    if (so !== sb) { return so - sb; }
    return a.nickname.localeCompare(b.nickname);
  });

  if (loading) {
    return <View style={styles.container} />;
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
          {p2p.serverInfo ? t('mesh_visible') : `${t('status_' + myStatus)}`}
        </NeonText>
      </View>

      {users.length === 0 ? (
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
          keyExtractor={(item) => item.nickname}
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
                  <GlassButton title={t('users_msg')} onPress={() => {}} variant="secondary" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, minHeight: 30 }} />
                  <GlassButton title={t('users_call')} onPress={() => {}} variant="primary" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, minHeight: 30 }} />
                </View>
              </View>
            </GlassCard>
          )}
        />
      )}

      {identity && !p2p.serverInfo && (
        <GlassButton
          title={t('mesh_become_visible')}
          onPress={() => messenger.startServer(0).catch(() => {})}
          variant="primary"
          style={{ marginTop: spacing.md }}
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
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
  userDot: { width: 10, height: 10, borderRadius: 5 },
  userCard: { marginBottom: spacing.sm },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  userInfo: {
    flex: 1,
  },
  starBtn: {
    padding: spacing.xs,
  },
});
