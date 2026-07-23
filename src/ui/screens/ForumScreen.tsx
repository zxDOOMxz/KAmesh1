import { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { NeonText } from '../components/NeonText';
import { GlassButton } from '../components/GlassButton';
import { GlassInput } from '../components/GlassInput';
import { spacing } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { AsyncStorageAdapter } from '../../storage/AsyncStorageAdapter';
import { decodeUtf8 } from '../../utils/decodeUtf8';
import { useLocale } from '../../i18n/LocaleContext';
import type { ForumThread, ForumPost } from '../../storage/Store';

const store = new AsyncStorageAdapter();

export default function ForumScreen() {
  const { t } = useLocale();
  const { colors } = useTheme();
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [newPostText, setNewPostText] = useState('');
  const [newThreadVis, setNewThreadVis] = useState<'public' | 'private'>('public');
  const [inviteNick, setInviteNick] = useState('');
  const [invitedUsers, setInvitedUsers] = useState<string[]>([]);

  useEffect(() => {
    loadThreads();
  }, []);

  useEffect(() => {
    if (selectedThread) {
      loadPosts(selectedThread);
    }
  }, [selectedThread]);

  const loadThreads = async () => {
    const data = await store.getThreads();
    setThreads(data);
  };

  const loadPosts = async (threadId: string) => {
    const data = await store.getPosts(threadId, 50, 0);
    setPosts(data);
  };

  const createThread = async () => {
    if (!newThreadTitle.trim()) {return;}
    const thread: ForumThread = {
      id: `thread_${Date.now()}`,
      title: newThreadTitle.trim(),
      creatorPeerId: 'local',
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      postCount: 0,
      visibility: newThreadVis,
    };
    await store.createThread(thread);
    setNewThreadTitle('');
    setNewThreadVis('public');
    setInvitedUsers([]);
    await loadThreads();
  };

  const createPost = async () => {
    if (!selectedThread || !newPostText.trim()) {return;}
    const post: ForumPost = {
      id: `post_${Date.now()}`,
      threadId: selectedThread,
      senderPeerId: 'local',
      ciphertext: new TextEncoder().encode(newPostText),
      nonce: new Uint8Array(12),
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000 * 30,
    };
    await store.savePost(post);
    setNewPostText('');
    await loadPosts(selectedThread);
    await loadThreads();
  };

  const deleteThread = async (threadId: string) => {
    await store.deleteThread(threadId);
    if (selectedThread === threadId) { setSelectedThread(null); }
    await loadThreads();
  };

  const deletePost = async (postId: string) => {
    if (!selectedThread) {return;}
    await store.deletePost(postId, selectedThread);
    await loadPosts(selectedThread);
    await loadThreads();
  };

  const renderThread = ({ item }: { item: ForumThread }) => (
    <GlassCard
      style={styles.threadCard}
      borderColor={selectedThread === item.id ? colors.neonCyan : undefined}
      glowColor={selectedThread === item.id ? colors.neonCyan : undefined}
    >
      <View style={styles.threadHeader}>
        <View style={{ flex: 1 }}>
          <NeonText size="body" color={colors.neonCyan} glow={selectedThread === item.id}>
            {item.title}
          </NeonText>
          {item.visibility === 'private' && (
            <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, backgroundColor: colors.neonPinkDim, alignSelf: 'flex-start', marginTop: 2 }}>
              <Text style={{ color: colors.neonPink, fontSize: 10 }}>{t('forum_private')}</Text>
            </View>
          )}
        </View>
        <NeonText size="caption" color={colors.textMuted} glow={false}>
          {item.postCount} {t('forum_posts')}
        </NeonText>
      </View>
      <NeonText size="caption" color={colors.textMuted} glow={false}>
        {t('forum_by')} {item.creatorPeerId.slice(0, 12)}... • {new Date(item.lastActivityAt).toLocaleDateString()}
      </NeonText>
      <GlassButton
        title={selectedThread === item.id ? t('forum_close') : t('forum_view')}
        onPress={() => setSelectedThread(selectedThread === item.id ? null : item.id)}
        variant={selectedThread === item.id ? 'danger' : 'secondary'}
        style={{ marginTop: spacing.sm }}
      />
      {item.creatorPeerId === 'local' && (
        <GlassButton
          title="✕"
          onPress={() => deleteThread(item.id)}
          variant="danger"
          style={{ marginTop: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, minHeight: 30 }}
        />
      )}
    </GlassCard>
  );

  const renderPost = ({ item }: { item: ForumPost }) => {
    const text = decodeUtf8(item.ciphertext);
    return (
      <GlassCard style={styles.postCard}>
        <View style={styles.postHeader}>
          <NeonText size="caption" color={colors.neonBlue} glow={false}>
            {item.senderPeerId.slice(0, 12)}...
          </NeonText>
          <NeonText size="caption" color={colors.textMuted} glow={false}>
            {new Date(item.createdAt).toLocaleString()}
          </NeonText>
        </View>
        <NeonText size="body" color={colors.text} glow={false} style={{ marginTop: spacing.sm }}>
          {text}
        </NeonText>
        {item.senderPeerId === 'local' && (
          <GlassButton
            title="✕"
            onPress={() => deletePost(item.id)}
            variant="danger"
            style={{ marginTop: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, minHeight: 28, alignSelf: 'flex-end' }}
          />
        )}
      </GlassCard>
    );
  };

  return (
    <View style={styles.container}>
      <NeonText size="h1" color={colors.neonBlue} style={{ textAlign: 'center' }}>
        {t('forum_title')}
      </NeonText>
      <NeonText size="caption" color={colors.textSecondary} glow={false}>
        {t('forum_subtitle')}
      </NeonText>

      {!selectedThread && (
        <GlassCard style={{ marginTop: spacing.md }}>
          <NeonText size="h2" color={colors.neonGreen} glow={false}>
            {t('forum_new_thread')}
          </NeonText>
          <GlassInput
            placeholder={t('forum_thread_placeholder')}
            value={newThreadTitle}
            onChangeText={setNewThreadTitle}
            style={{ marginTop: spacing.sm }}
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <TouchableOpacity onPress={() => setNewThreadVis('public')} style={[styles.visBtn, newThreadVis === 'public' && { borderColor: colors.neonCyan, backgroundColor: colors.neonCyanDim }]}>
              <Text style={{ color: newThreadVis === 'public' ? colors.neonCyan : colors.textMuted, fontSize: 12 }}>{t('forum_public')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setNewThreadVis('private')} style={[styles.visBtn, newThreadVis === 'private' && { borderColor: colors.neonPink, backgroundColor: colors.neonPinkDim }]}>
              <Text style={{ color: newThreadVis === 'private' ? colors.neonPink : colors.textMuted, fontSize: 12 }}>{t('forum_private')}</Text>
            </TouchableOpacity>
          </View>
          {newThreadVis === 'private' && (
            <>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <GlassInput placeholder={t('forum_invite_nick')} value={inviteNick} onChangeText={setInviteNick} />
                </View>
                <GlassButton title={t('forum_invite_add')} onPress={() => { if (inviteNick.trim()) { setInvitedUsers([...invitedUsers, inviteNick.trim()]); setInviteNick(''); } }} variant="secondary" style={{ minHeight: 44 }} />
              </View>
              {invitedUsers.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs }}>
                  {invitedUsers.map((u) => (
                    <TouchableOpacity key={u} onPress={() => setInvitedUsers(invitedUsers.filter((x) => x !== u))} style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 8, backgroundColor: colors.neonPinkDim }}>
                      <Text style={{ color: colors.neonPink, fontSize: 11 }}>{u} ✕</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}
          <GlassButton
            title={t('forum_create_thread')}
            onPress={createThread}
            variant="primary"
            style={{ marginTop: spacing.sm }}
          />
        </GlassCard>
      )}

      {!selectedThread && (
        <FlatList
          data={threads}
          keyExtractor={(item) => item.id}
          renderItem={renderThread}
          style={{ marginTop: spacing.md }}
          ListEmptyComponent={
            <GlassCard>
              <NeonText size="body" color={colors.textMuted} glow={false} style={{ textAlign: 'center' }}>
                {t('forum_no_threads')}
              </NeonText>
            </GlassCard>
          }
        />
      )}

      {selectedThread && (
        <>
          <View style={styles.backRow}>
            <GlassButton title={`← ${t('forum_back')}`} onPress={() => setSelectedThread(null)} variant="secondary" style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs, minHeight: 30 }} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <NeonText size="body" color={colors.neonCyan} glow={false}>
                {(threads.find((th) => th.id === selectedThread)?.title ?? '').slice(0, 40)}
              </NeonText>
            </View>
            <TouchableOpacity onPress={() => { if (selectedThread) { deleteThread(selectedThread); } }}>
              <Text style={{ color: colors.error, fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            renderItem={renderPost}
            style={{ marginTop: spacing.sm, flex: 1 }}
            ListEmptyComponent={
              <GlassCard>
                <NeonText size="body" color={colors.textMuted} glow={false} style={{ textAlign: 'center' }}>
                  {t('forum_no_posts')}
                </NeonText>
              </GlassCard>
            }
          />

          <GlassCard style={{ marginTop: spacing.md }}>
            <GlassInput
              placeholder={t('forum_write_post')}
              value={newPostText}
              onChangeText={setNewPostText}
              multiline
              style={{ minHeight: 80 }}
            />
            <GlassButton
              title={t('forum_post')}
              onPress={createPost}
              variant="primary"
              style={{ marginTop: spacing.sm }}
            />
          </GlassCard>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  threadCard: {
    marginBottom: spacing.sm,
  },
  threadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postCard: {
    marginBottom: spacing.sm,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  visBtn: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: 8,
    borderWidth: 1, borderColor: '#333', alignItems: 'center',
  },
});
