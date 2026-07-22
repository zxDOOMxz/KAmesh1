import { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, TextInput } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { NeonText } from '../components/NeonText';
import { GlassButton } from '../components/GlassButton';
import { GlassInput } from '../components/GlassInput';
import { colors, spacing } from '../theme';
import { AsyncStorageAdapter } from '../../storage/AsyncStorageAdapter';
import type { ForumThread, ForumPost } from '../../storage/Store';

const store = new AsyncStorageAdapter();

export default function ForumScreen() {
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [newPostText, setNewPostText] = useState('');

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
    };
    await store.createThread(thread);
    setNewThreadTitle('');
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

  const renderThread = ({ item }: { item: ForumThread }) => (
    <GlassCard
      style={styles.threadCard}
      borderColor={selectedThread === item.id ? colors.neonCyan : undefined}
      glowColor={selectedThread === item.id ? colors.neonCyan : undefined}
    >
      <View style={styles.threadHeader}>
        <NeonText size="body" color={colors.neonCyan} glow={selectedThread === item.id}>
          {item.title}
        </NeonText>
        <NeonText size="caption" color={colors.textMuted} glow={false}>
          {item.postCount} posts
        </NeonText>
      </View>
      <NeonText size="caption" color={colors.textMuted} glow={false}>
        by {item.creatorPeerId.slice(0, 12)}... • {new Date(item.lastActivityAt).toLocaleDateString()}
      </NeonText>
      <GlassButton
        title={selectedThread === item.id ? 'Close' : 'View'}
        onPress={() => setSelectedThread(selectedThread === item.id ? null : item.id)}
        variant={selectedThread === item.id ? 'danger' : 'secondary'}
        style={{ marginTop: spacing.sm }}
      />
    </GlassCard>
  );

  const renderPost = ({ item }: { item: ForumPost }) => {
    const text = new TextDecoder().decode(item.ciphertext);
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
      </GlassCard>
    );
  };

  return (
    <View style={styles.container}>
      <NeonText size="h1" color={colors.neonBlue} style={{ textAlign: 'center' }}>
        FORUM
      </NeonText>
      <NeonText size="caption" color={colors.textSecondary} glow={false}>
        encrypted discussions
      </NeonText>

      {/* Create Thread */}
      {!selectedThread && (
        <GlassCard style={{ marginTop: spacing.md }}>
          <NeonText size="h2" color={colors.neonGreen} glow={false}>
            New Thread
          </NeonText>
          <GlassInput
            placeholder="Thread title..."
            value={newThreadTitle}
            onChangeText={setNewThreadTitle}
            style={{ marginTop: spacing.sm }}
          />
          <GlassButton
            title="Create Thread"
            onPress={createThread}
            variant="primary"
            style={{ marginTop: spacing.sm }}
          />
        </GlassCard>
      )}

      {/* Threads List */}
      {!selectedThread && (
        <FlatList
          data={threads}
          keyExtractor={(item) => item.id}
          renderItem={renderThread}
          style={{ marginTop: spacing.md }}
          ListEmptyComponent={
            <GlassCard>
              <NeonText size="body" color={colors.textMuted} glow={false} style={{ textAlign: 'center' }}>
                No threads yet. Create the first one!
              </NeonText>
            </GlassCard>
          }
        />
      )}

      {/* Thread View */}
      {selectedThread && (
        <>
          <GlassCard style={{ marginTop: spacing.md }}>
            <NeonText size="h2" color={colors.neonCyan} glow={false}>
              {threads.find((t) => t.id === selectedThread)?.title}
            </NeonText>
          </GlassCard>

          {/* Posts */}
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            renderItem={renderPost}
            style={{ marginTop: spacing.md, maxHeight: 300 }}
            ListEmptyComponent={
              <GlassCard>
                <NeonText size="body" color={colors.textMuted} glow={false} style={{ textAlign: 'center' }}>
                  No posts yet. Start the discussion!
                </NeonText>
              </GlassCard>
            }
          />

          {/* New Post */}
          <GlassCard style={{ marginTop: spacing.md }}>
            <TextInput
              placeholder="Write a post..."
              placeholderTextColor={colors.textMuted}
              value={newPostText}
              onChangeText={setNewPostText}
              multiline
              style={[
                styles.textInput,
                { minHeight: 80 },
              ]}
            />
            <GlassButton
              title="Post"
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
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
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
  textInput: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 16,
    fontFamily: 'monospace',
  },
});
