import { useState, useEffect, useCallback, useRef } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Text, TextInput } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { NeonText } from '../components/NeonText';
import { GlassButton } from '../components/GlassButton';
import { GlassInput } from '../components/GlassInput';
import { spacing } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { P2PMessenger, type P2PState } from '../../core/p2p/P2PMessenger';
import { AsyncStorageAdapter } from '../../storage/AsyncStorageAdapter';
import { decodeUtf8 } from '../../utils/decodeUtf8';
import { useLocale } from '../../i18n/LocaleContext';
import { identityManager, type UserIdentity } from '../../core/identity/IdentityManager';
import { chatStore, type ChatInfo } from '../../core/chat/ChatStore';
import { userStore } from '../../core/identity/UserStore';

const store = new AsyncStorageAdapter();
const messenger = new P2PMessenger(store);

export default function MessagesScreen() {
  const { t } = useLocale();
  const { colors } = useTheme();
  const [p2p, setP2P] = useState<P2PState>(messenger.getState());
  const [identity, setIdentity] = useState<UserIdentity | null>(null);
  const [chats, setChats] = useState<ChatInfo[]>([]);
  const [search, setSearch] = useState('');
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    const init = async () => {
      await messenger.init().catch(() => {});
      identityManager.load().then(setIdentity);
      await chatStore.load();
      setChats(chatStore.getAll());
    };
    init();
    messenger.subscribe((s) => {
      setP2P(s);
      if (s.messages.length > 0) {
        const last = s.messages[s.messages.length - 1];
        const text = decodeUtf8(last.ciphertext).slice(0, 50);
        chatStore.addOrUpdate(last.channelId || 'peer', last.channelId || 'peer', text);
      }
    });
    chatStore.subscribe(() => setChats(chatStore.getAll()));
    identityManager.subscribe(setIdentity);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const filtered = chats.filter((c) =>
    !search || c.peerNick.toLowerCase().includes(search.toLowerCase())
  );

  const openChat = (peerNick: string) => {
    setActiveChat(peerNick);
    chatStore.markRead(peerNick);
    setChatMessages(p2p.messages.map((m) => ({
      id: m.id,
      text: decodeUtf8(m.ciphertext),
      time: new Date(m.createdAt).toLocaleTimeString(),
      mine: true,
    })));
  };

  const sendMessage = async () => {
    if (!message || !activeChat) { return; }
    const peer = p2p.connectedPeers.entries().next().value;
    const connId = peer ? peer[0] : activeChat;
    try {
      await messenger.sendMessage(message, connId);
      setChatMessages((prev) => [...prev, { id: Date.now().toString(), text: message, time: new Date().toLocaleTimeString(), mine: true }]);
      chatStore.addOrUpdate(activeChat, activeChat, message);
      setMessage('');
    } catch {}
  };

  if (activeChat) {
    return (
      <View style={styles.container}>
        <View style={[styles.chatHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => setActiveChat(null)}>
            <Text style={{ color: colors.neonCyan, fontSize: 18 }}>{'←'}</Text>
          </TouchableOpacity>
          <NeonText size="body" color={colors.neonGreen} glow={false}>{activeChat}</NeonText>
          <View style={{ width: 24 }} />
        </View>
        <FlatList
          data={chatMessages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.md }}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.mine ? styles.bubbleMine : styles.bubbleThem, { backgroundColor: item.mine ? colors.neonCyanDim : colors.bgCard }]}>
              <Text style={{ color: colors.text, fontSize: 14 }}>{item.text}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 10, textAlign: 'right', marginTop: 4 }}>{item.time}</Text>
            </View>
          )}
          ListEmptyComponent={<NeonText size="body" color={colors.textMuted} glow={false} style={{ textAlign: 'center', marginTop: 40 }}>{t('msg_no_messages')}</NeonText>}
        />
        <View style={[styles.inputRow, { borderTopColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.bgCard, borderColor: colors.border }]}
            value={message}
            onChangeText={setMessage}
            placeholder={t('mesh_message_placeholder')}
            placeholderTextColor={colors.textMuted}
            multiline
          />
          <TouchableOpacity onPress={sendMessage} style={[styles.sendBtn, { backgroundColor: colors.neonCyanDim }]}>
            <Text style={{ color: colors.neonCyan, fontWeight: 'bold' }}>↑</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NeonText size="h1" color={colors.neonCyan} style={{ textAlign: 'center', paddingTop: spacing.xxl }}>
        {t('msg_title')}
      </NeonText>
      {identity && (
        <NeonText size="h2" color={colors.neonGreen} glow style={{ textAlign: 'center', marginTop: spacing.xs }}>
          {identity.nickname}
        </NeonText>
      )}

      <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, marginTop: spacing.md }}>
        <View style={{ flex: 1 }}>
          <GlassInput placeholder={t('msg_search')} value={search} onChangeText={setSearch} />
        </View>
        {!p2p.serverInfo ? (
          <GlassButton title={t('mesh_become_visible')} onPress={() => messenger.startServer(0).catch(() => {})} variant="secondary" style={{ minHeight: 44, paddingHorizontal: spacing.sm }} />
        ) : (
          <GlassButton title={t('mesh_become_invisible')} onPress={() => messenger.destroy()} variant="danger" style={{ minHeight: 44, paddingHorizontal: spacing.sm }} />
        )}
      </View>

      {filtered.length === 0 ? (
        <View style={{ padding: spacing.md, flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <NeonText size="body" color={colors.textMuted} glow={false} style={{ textAlign: 'center' }}>
            {t('msg_empty')}
          </NeonText>
          <NeonText size="caption" color={colors.textMuted} glow={false} style={{ textAlign: 'center', marginTop: spacing.sm }}>
            {t('msg_empty_hint')}
          </NeonText>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.peerNick}
          contentContainerStyle={{ padding: spacing.md }}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => openChat(item.peerNick)}>
              <GlassCard style={{ marginBottom: spacing.sm, borderColor: item.unread > 0 ? colors.neonCyan : undefined }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <TouchableOpacity onPress={() => { chatStore.toggleFavorite(item.peerNick); }}>
                        <Text style={{ color: item.isFavorite ? '#FFD700' : colors.textMuted, fontSize: 16 }}>
                          {item.isFavorite ? '★' : '☆'}
                        </Text>
                      </TouchableOpacity>
                      <NeonText size="body" color={colors.text} glow={false}>{item.peerNick}</NeonText>
                      {item.unread > 0 && <View style={{ backgroundColor: colors.neonCyan, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 }}><Text style={{ color: '#000', fontSize: 10, fontWeight: 'bold' }}>{item.unread}</Text></View>}
                    </View>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{item.lastMessage}</Text>
                  </View>
                  <Text style={{ color: colors.textMuted, fontSize: 10 }}>{new Date(item.lastTime).toLocaleTimeString()}</Text>
                </View>
              </GlassCard>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  chatHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.xxl, paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  bubble: { maxWidth: '75%', padding: spacing.sm, borderRadius: 12, marginBottom: spacing.sm },
  bubbleMine: { alignSelf: 'flex-end' },
  bubbleThem: { alignSelf: 'flex-start' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: spacing.sm, borderTopWidth: 1, gap: spacing.sm },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, maxHeight: 100, fontSize: 14 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
});
