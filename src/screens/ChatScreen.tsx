import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, Modal, ActivityIndicator } from 'react-native';
import uuidv4 from 'react-native-uuid';
import { COLORS } from '../constants';
import { MeshService } from '../services/MeshService';
import { ContactService } from '../services/ContactService';
import { ConferenceService } from '../services/ConferenceService';
import { IntercomService } from '../services/IntercomService';
import * as VoiceMailService from '../services/VoiceMailService';
import { VoiceCallService } from '../services/VoiceCallService';
import { addChatMessage, getChatMessages } from '../services/StorageService';
import { MessageType, ChatMessage, DeliveryStatus, ContactEntry, ConferenceInfo, ConferenceParticipant, CallState } from '../types';
import { ShareService } from '../services/ShareService';
import { SoundService } from '../services/SoundService';
import { MessageBubble } from '../components/MessageBubble';
import { VoiceCallUI } from '../components/VoiceCallUI';
import { VoiceRecorder } from '../components/VoiceRecorder';

type Screen = 'menu' | 'contacts' | 'chat' | 'voice_call' | 'conf_list' | 'conf_create' | 'conf_room' | 'new_contact' | 'share_contacts' | 'share_progress' | 'share_incoming';

export function ChatScreen() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [contacts, setContacts] = useState<ContactEntry[]>([]);
  const [searchNick, setSearchNick] = useState('');
  const [chatPeerId, setChatPeerId] = useState('');
  const [chatPeerName, setChatPeerName] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isPttActive, setPttActive] = useState(false);
  const [voiceCallState, setVoiceCallState] = useState<CallState>(CallState.IDLE);
  const [voiceCallPeerName, setVoiceCallPeerName] = useState('');
  const [conferences, setConferences] = useState<ConferenceInfo[]>([]);
  const [confName, setConfName] = useState('');
  const [confPassword, setConfPassword] = useState('');
  const [confHasPwd, setConfHasPwd] = useState(false);
  const [confSearch, setConfSearch] = useState('');
  const [participants, setParticipants] = useState<ConferenceParticipant[]>([]);
  const [voxEnabled, setVoxEnabled] = useState(false);
  const [voxSpeaking, setVoxSpeaking] = useState(false);
  const [shareProgress, setShareProgress] = useState(0);
  const [shareStatus, setShareStatus] = useState('');
  const [incomingShareFrom, setIncomingShareFrom] = useState('');
  const [incomingShareNick, setIncomingShareNick] = useState('');
  const pttRef = useRef(false);

  useEffect(() => {
    const unsubContact = ContactService.onChange(() => setContacts(ContactService.getContacts()));
    setContacts(ContactService.getContacts());

    const unsubPacket = MeshService.onPacket((packet) => {
      if (packet.type === MessageType.TEXT && !packet.isBroadcast) {
        const msg: ChatMessage = { id: packet.packetId, chatId: packet.sourceId, senderId: packet.sourceId, text: packet.payload, type: MessageType.TEXT, status: DeliveryStatus.DELIVERED, timestamp: packet.timestamp, isIncoming: true };
        const name = ContactService.getByNodeId(packet.sourceId)?.nickname || packet.sourceId.slice(0, 8);
        setMessages(prev => [...prev, msg]); addChatMessage(packet.sourceId, msg);
        SoundService.playNotification();
      }
    });

    const unsubConf = ConferenceService.onEvent((event) => {
      if (event.type === 'discovered') setConferences(ConferenceService.getOpenConferences());
      if (event.type === 'participant_joined' || event.type === 'participant_left' || event.type === 'speaker_changed') setParticipants(ConferenceService.getParticipants());
      if (event.type === 'invite_received' && event.invite) {
        setScreen('menu');
        Alert.alert(
          `Conference invitation`,
          `${event.invite.hostNickname} invites you to "${event.invite.conferenceName}"`,
          [
            { text: 'Decline', style: 'cancel' },
            { text: 'Join', onPress: () => ConferenceService.join(event.invite!.conferenceId, undefined) },
          ]
        );
      }
    });

    const unsubVox = IntercomService.onVoxSpeakingChange((speaking) => { setVoxSpeaking(speaking); ConferenceService.setSpeaking(speaking); });
    const unsubCallState = VoiceCallService.onStateChange('chat-screen', (state) => { setVoiceCallState(state); if (state === CallState.IDLE) setScreen('menu'); });

    const unsubShare = ShareService.onEvent((event) => {
      switch (event.type) {
        case 'request_received': setIncomingShareFrom(event.fromPeer); setIncomingShareNick(event.fromNickname); setScreen('share_incoming'); break;
        case 'accepted': setShareStatus('Peer accepted. Sending...'); break;
        case 'progress': setShareProgress(event.progress); setShareStatus(`Sending... ${event.progress}%`); break;
        case 'complete': setShareStatus('Done!'); Alert.alert('Sent', 'APK sent successfully.'); setScreen('menu'); break;
        case 'rejected': setShareStatus('Peer rejected.'); Alert.alert('Rejected', 'User declined.'); setScreen('menu'); break;
        case 'error': setShareStatus(`Error: ${event.error}`); Alert.alert('Error', event.error); break;
        case 'chunk_received': setShareProgress(event.progress); setShareStatus(`Receiving... ${event.progress}%`); break;
        case 'transfer_complete': setShareStatus('APK received!'); break;
        case 'ready_for_install': Alert.alert('App received', 'KAmesh received. Install?', [{ text: 'Later', style: 'cancel' }, { text: 'Install', onPress: () => ShareService.installReceivedApk() }]); setScreen('menu'); break;
      }
    });

    const unsubIncomingCall = VoiceCallService.onIncomingCall((peerId) => { const found = ContactService.getContacts().find(c => c.nodeId === peerId); setVoiceCallPeerName(found?.nickname || peerId.slice(0, 8)); });

    return () => { unsubContact(); unsubPacket(); unsubConf(); unsubShare(); unsubCallState(); unsubVox(); unsubIncomingCall(); };
  }, []);

  const openChat = (contact: ContactEntry) => { setChatPeerId(contact.nodeId); setChatPeerName(contact.nickname); setMessages(getChatMessages(contact.nodeId)); setScreen('chat'); };
  const startVoiceCall = (contact: ContactEntry) => { setChatPeerId(contact.nodeId); setChatPeerName(contact.nickname); setVoiceCallPeerName(contact.nickname); VoiceCallService.startCall(contact.nodeId); };

  const sendText = async () => {
    if (!inputText.trim() || !chatPeerId) return;
    const msg: ChatMessage = { id: uuidv4.v4(), chatId: chatPeerId, senderId: 'me', text: inputText.trim(), type: MessageType.TEXT, status: DeliveryStatus.SENDING, timestamp: Date.now(), isIncoming: false };
    setMessages(prev => [...prev, msg]); setInputText(''); addChatMessage(chatPeerId, msg);
    try { await MeshService.sendMessage(MessageType.TEXT, msg.text!, chatPeerId); } catch { /* offline */ }
  };

  const pttDown = () => { pttRef.current = true; setPttActive(true); IntercomService.startTransmitting(); };
  const pttUp = () => { pttRef.current = false; setPttActive(false); IntercomService.stopTransmitting(); };

  const createConference = async () => { if (!confName.trim()) return; await ConferenceService.create(confName.trim(), confHasPwd ? confPassword : undefined); setScreen('conf_room'); setParticipants(ConferenceService.getParticipants()); };
  const joinConference = async (conf: ConferenceInfo) => { await ConferenceService.join(conf.conferenceId, undefined); setScreen('conf_room'); setParticipants(ConferenceService.getParticipants()); };
  const leaveConference = async () => { if (voxEnabled) { IntercomService.setVoxEnabled(false); setVoxEnabled(false); setVoxSpeaking(false); } const id = ConferenceService.getActiveConferenceId(); if (id) await ConferenceService.leave(id); setScreen('conf_list'); };
  const showConfInvite = () => setScreen('conf_invite');
  const sendConfInvite = async (contact: ContactEntry) => { await ConferenceService.inviteContact(contact.nodeId); setScreen('conf_room'); };
  const toggleVox = () => { const next = !voxEnabled; IntercomService.setVoxEnabled(next); setVoxEnabled(next); if (!next) { setVoxSpeaking(false); ConferenceService.setSpeaking(false); } };

  const handleAnswerCall = async () => { const pending = VoiceCallService.consumePendingCall(); if (pending) await VoiceCallService.acceptCall(pending.peerId, pending.sdp); };
  const handleRejectCall = () => VoiceCallService.rejectCall();
  const handleEndCall = () => VoiceCallService.endCall();

  const handleSendVoiceMail = async (filePath: string, duration: number) => {
    if (!chatPeerId) return;
    const msg: ChatMessage = { id: uuidv4.v4(), chatId: chatPeerId, senderId: 'me', voiceMailUri: filePath, voiceMailDuration: duration, type: MessageType.VOICE_MAIL, status: DeliveryStatus.SENDING, timestamp: Date.now(), isIncoming: false };
    setMessages(prev => [...prev, msg]); addChatMessage(chatPeerId, msg);
    try { await VoiceMailService.fragmentAndSendVoiceMail(filePath, chatPeerId, duration); } catch { /* offline */ }
  };

  const startShare = async (contact: ContactEntry) => { setShareProgress(0); setShareStatus('Sending request...'); setScreen('share_progress'); try { await ShareService.sendApk(contact.nodeId); } catch { setShareStatus('Error'); Alert.alert('Error', 'Failed to send request.'); setScreen('menu'); } };
  const acceptIncomingShare = async () => { setShareStatus('Accepted, receiving...'); setShareProgress(0); setScreen('share_progress'); await ShareService.acceptIncoming(true); };
  const rejectIncomingShare = async () => { await ShareService.acceptIncoming(false); setScreen('menu'); };

  const filteredContacts = searchNick ? contacts.filter(c => c.nickname.toLowerCase().includes(searchNick.toLowerCase())) : contacts;

  const renderMenu = () => (
    <View style={s.menu}>
      <Text style={s.menuTitle}>KAmesh</Text>
      <Text style={s.menuSub}>{ContactService.getMyNickname() || '...'}</Text>
      <View style={s.menuGroup}>
        {([{ label: 'Send message', icon: '💬', target: 'contacts' as Screen }, { label: 'Voice call', icon: '📞', target: 'contacts' as Screen }, { label: 'Create conference', icon: '👥', target: 'conf_create' as Screen }, { label: 'Join conference', icon: '🚪', target: 'conf_list' as Screen }, { label: 'Share app', icon: '📤', target: 'share_contacts' as Screen }]).map((item) => (
          <TouchableOpacity key={item.label} style={s.menuBtn} onPress={() => setScreen(item.target)} activeOpacity={0.7}>
            <Text style={s.menuBtnIcon}>{item.icon}</Text><Text style={s.menuBtnLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderContacts = () => (
    <View style={s.contactsWrap}>
      <View style={s.header}><TouchableOpacity onPress={() => setScreen('menu')}><Text style={s.back}>{'< Back'}</Text></TouchableOpacity><Text style={s.headerTitle}>Select contact</Text></View>
      <TextInput style={s.searchInput} placeholder="Search nickname..." placeholderTextColor={COLORS.textTertiary} value={searchNick} onChangeText={setSearchNick} />
      <FlatList data={filteredContacts} keyExtractor={c => c.nodeId} renderItem={({ item }) => (
        <TouchableOpacity style={s.contactRow} onPress={() => openChat(item)}>
          <View style={[s.contactAvatar, { backgroundColor: item.isOnline ? COLORS.primaryDark : COLORS.surfaceVariant }]}><Text style={s.avatarText}>{item.nickname[0].toUpperCase()}</Text></View>
          <View style={s.contactInfo}><Text style={s.contactName}>{item.nickname}</Text><Text style={s.contactStatus}><Text style={{ color: item.isOnline ? COLORS.secondary : COLORS.textTertiary }}>●</Text> {item.isOnline ? 'Online' : 'Offline'}</Text></View>
        </TouchableOpacity>
      )} ListEmptyComponent={<Text style={s.emptyText}>No contacts. Searching...</Text>} />
    </View>
  );

  const renderConfList = () => {
    const filtered = confSearch ? conferences.filter(c => c.name.toLowerCase().includes(confSearch.toLowerCase())) : conferences;
    return (
      <View style={s.contactsWrap}>
        <View style={s.header}><TouchableOpacity onPress={() => setScreen('menu')}><Text style={s.back}>{'< Back'}</Text></TouchableOpacity><Text style={s.headerTitle}>Join conference</Text></View>
        <TextInput style={s.searchInput} placeholder="Search conference..." placeholderTextColor={COLORS.textTertiary} value={confSearch} onChangeText={setConfSearch} />
        <FlatList data={filtered} keyExtractor={c => c.conferenceId} renderItem={({ item }) => (
          <TouchableOpacity style={s.confCard} onPress={() => joinConference(item)}><Text style={s.confName}>{item.name}</Text><View style={s.confMeta}><Text style={s.confBadge}>{item.hasPassword ? '🔒' : '🔓'}</Text><Text style={s.confParticipants}>{item.participantCount} members</Text></View></TouchableOpacity>
        )} ListEmptyComponent={<Text style={s.emptyText}>{confSearch ? 'Not found' : 'No open conferences nearby'}</Text>} />
      </View>
    );
  };

  const renderConfCreate = () => (
    <View style={s.contactsWrap}>
      <View style={s.header}><TouchableOpacity onPress={() => setScreen('conf_list')}><Text style={s.back}>{'< Back'}</Text></TouchableOpacity><Text style={s.headerTitle}>New conference</Text></View>
      <View style={s.pad}>
        <TextInput style={s.searchInput} placeholder="Name..." placeholderTextColor={COLORS.textTertiary} value={confName} onChangeText={setConfName} autoFocus />
        <TouchableOpacity style={s.toggleBtn} onPress={() => setConfHasPwd(!confHasPwd)}><Text style={s.toggleText}>{confHasPwd ? '🔒 Closed (with password)' : '🔓 Open (no password)'}</Text></TouchableOpacity>
        {confHasPwd && <TextInput style={s.searchInput} placeholder="Password" placeholderTextColor={COLORS.textTertiary} value={confPassword} onChangeText={setConfPassword} secureTextEntry />}
        <TouchableOpacity style={s.goBtn} onPress={createConference}><Text style={s.goBtnText}>Create</Text></TouchableOpacity>
      </View>
    </View>
  );

  const renderConfRoom = () => {
    const conf = ConferenceService.getActiveConference();
    const isActive = voxEnabled ? voxSpeaking : isPttActive;
    return (
      <View style={s.confRoom}>
        <View style={s.header}><Text style={s.headerTitle}>{conf?.name || 'Conference'}</Text><View style={s.headerActions}><TouchableOpacity onPress={showConfInvite} style={s.inviteBtn}><Text style={{ color: COLORS.primary, fontSize: 14 }}>+ Invite</Text></TouchableOpacity><TouchableOpacity onPress={leaveConference}><Text style={{ color: COLORS.error, fontSize: 14 }}>Leave</Text></TouchableOpacity></View></View>
        <FlatList data={participants} keyExtractor={p => p.nodeId} renderItem={({ item }) => (
          <View style={[s.participantRow, item.isSpeaking && s.participantSpeaking]}><View style={[s.participantDot, { backgroundColor: item.isSpeaking ? COLORS.secondary : COLORS.textTertiary }]} /><Text style={s.participantName}>{item.nickname}</Text>{item.isSpeaking && <Text style={s.speakingBadge}>Speaking</Text>}</View>
        )} />
        <TouchableOpacity style={s.voxToggle} onPress={toggleVox}><Text style={s.voxToggleText}>{voxEnabled ? '🎙 VOX on' : '🔇 VOX off'}</Text></TouchableOpacity>
        {!voxEnabled ? (
          <TouchableOpacity style={[s.pttBtn, isPttActive && s.pttActive]} onPressIn={pttDown} onPressOut={pttUp}><Text style={s.pttText}>{isPttActive ? '🔴 Speaking...' : '🎤 Hold to talk'}</Text></TouchableOpacity>
        ) : (
          <View style={[s.pttBtn, voxSpeaking && s.pttActive]}><Text style={s.pttText}>{voxSpeaking ? '🔴 Speaking...' : '🎤 Waiting for voice...'}</Text></View>
        )}
      </View>
    );
  };

  const renderConfInvite = () => (
    <View style={s.contactsWrap}>
      <View style={s.header}><TouchableOpacity onPress={() => setScreen('conf_room')}><Text style={s.back}>{'< Back'}</Text></TouchableOpacity><Text style={s.headerTitle}>Invite to conference</Text></View>
      <TextInput style={s.searchInput} placeholder="Search nickname..." placeholderTextColor={COLORS.textTertiary} value={searchNick} onChangeText={setSearchNick} />
      <FlatList data={filteredContacts} keyExtractor={c => c.nodeId} renderItem={({ item }) => (
        <TouchableOpacity style={s.contactRow} onPress={() => sendConfInvite(item)}>
          <View style={[s.contactAvatar, { backgroundColor: item.isOnline ? COLORS.primaryDark : COLORS.surfaceVariant }]}><Text style={s.avatarText}>{item.nickname[0].toUpperCase()}</Text></View>
          <View style={s.contactInfo}><Text style={s.contactName}>{item.nickname}</Text><Text style={s.contactStatus}><Text style={{ color: item.isOnline ? COLORS.secondary : COLORS.textTertiary }}>●</Text> {item.isOnline ? 'Online' : 'Offline'}</Text></View>
        </TouchableOpacity>
      )} ListEmptyComponent={<Text style={s.emptyText}>No contacts</Text>} />
    </View>
  );

  const renderShareContacts = () => (
    <View style={s.contactsWrap}>
      <View style={s.header}><TouchableOpacity onPress={() => setScreen('menu')}><Text style={s.back}>{'< Back'}</Text></TouchableOpacity><Text style={s.headerTitle}>Send app to...</Text></View>
      <TextInput style={s.searchInput} placeholder="Search nickname..." placeholderTextColor={COLORS.textTertiary} value={searchNick} onChangeText={setSearchNick} />
      <FlatList data={filteredContacts} keyExtractor={c => c.nodeId} renderItem={({ item }) => (
        <TouchableOpacity style={s.contactRow} onPress={() => startShare(item)}>
          <View style={[s.contactAvatar, { backgroundColor: item.isOnline ? COLORS.primaryDark : COLORS.surfaceVariant }]}><Text style={s.avatarText}>{item.nickname[0].toUpperCase()}</Text></View>
          <View style={s.contactInfo}><Text style={s.contactName}>{item.nickname}</Text><Text style={s.contactStatus}><Text style={{ color: item.isOnline ? COLORS.secondary : COLORS.textTertiary }}>●</Text> {item.isOnline ? 'Online' : 'Offline'}</Text></View>
        </TouchableOpacity>
      )} ListEmptyComponent={<Text style={s.emptyText}>No contacts. Searching...</Text>} />
    </View>
  );

  const renderShareProgress = () => (
    <View style={s.shareProgressWrap}><Text style={s.shareIcon}>📤</Text><Text style={s.shareStatus}>{shareStatus}</Text>
      <View style={s.progressTrack}><View style={[s.progressFill, { width: `${Math.min(shareProgress, 100)}%` }]} /></View>
      <Text style={s.progressLabel}>{shareProgress}%</Text>
    </View>
  );

  const renderShareIncoming = () => (
    <View style={s.shareProgressWrap}>
      <Text style={s.shareIconBig}>📲</Text><Text style={s.shareTitle}>{incomingShareNick} wants to share app</Text><Text style={s.shareDesc}>You will receive KAmesh directly via mesh network</Text>
      <View style={s.shareActions}><TouchableOpacity style={s.rejectBtn} onPress={rejectIncomingShare}><Text style={s.goBtnText}>Reject</Text></TouchableOpacity><TouchableOpacity style={s.acceptBtn} onPress={acceptIncomingShare}><Text style={s.goBtnText}>Accept</Text></TouchableOpacity></View>
    </View>
  );

  const renderChat = () => (
    <View style={s.chatWrap}>
      <View style={s.header}><TouchableOpacity onPress={() => setScreen('menu')}><Text style={s.back}>{'< Back'}</Text></TouchableOpacity><Text style={s.headerTitle}>{chatPeerName}</Text></View>
      <FlatList data={messages} keyExtractor={m => m.id} style={s.chatList} initialNumToRender={15} maxToRenderPerBatch={10} windowSize={7} renderItem={({ item }) => <MessageBubble message={item} />} />
      <View style={s.inputBar}>
        <TextInput style={s.chatInput} value={inputText} onChangeText={setInputText} placeholder="Message..." placeholderTextColor={COLORS.textTertiary} />
        <VoiceRecorder onSendVoiceMail={handleSendVoiceMail} disabled={!chatPeerId} />
        <TouchableOpacity style={s.sendBtn} onPress={sendText}><Text style={s.sendBtnText}>→</Text></TouchableOpacity>
      </View>
      <View style={s.pttBar}><TouchableOpacity style={[s.pttMini, isPttActive && s.pttActive]} onPressIn={pttDown} onPressOut={pttUp}><Text style={s.pttMiniText}>{isPttActive ? '🔴' : '🎤 PTT'}</Text></TouchableOpacity></View>
    </View>
  );

  const renderCurrentScreen = () => {
    switch (screen) {
      case 'menu': return renderMenu();
      case 'contacts': return renderContacts();
      case 'share_contacts': return renderShareContacts();
      case 'share_progress': return renderShareProgress();
      case 'share_incoming': return renderShareIncoming();
      case 'conf_list': return renderConfList();
      case 'conf_create': return renderConfCreate();
      case 'conf_room': return renderConfRoom();
      case 'conf_invite': return renderConfInvite();
      case 'chat': return renderChat();
      default: return renderMenu();
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {renderCurrentScreen()}
      {voiceCallState !== CallState.IDLE && <VoiceCallUI state={voiceCallState} peerName={voiceCallPeerName} onAnswer={handleAnswerCall} onReject={handleRejectCall} onEnd={handleEndCall} />}
    </View>
  );
}

const s = StyleSheet.create({
  menu: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', padding: 24 },
  menuTitle: { fontSize: 28, fontWeight: '700', color: COLORS.primary, textAlign: 'center' },
  menuSub: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 32 },
  menuGroup: { gap: 12 },
  menuBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, padding: 18, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, gap: 14 },
  menuBtnIcon: { fontSize: 22 },
  menuBtnLabel: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, gap: 12 },
  headerTitle: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary, flex: 1 },
  back: { color: COLORS.primary, fontSize: 14 },
  contactsWrap: { flex: 1, backgroundColor: COLORS.background },
  searchInput: { backgroundColor: COLORS.surfaceVariant, borderRadius: 10, margin: 12, padding: 12, fontSize: 15, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
  contactRow: { flexDirection: 'row', alignItems: 'center', padding: 14, marginHorizontal: 12, marginVertical: 3, backgroundColor: COLORS.surface, borderRadius: 12, gap: 12 },
  contactAvatar: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: COLORS.onPrimary },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  contactStatus: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  emptyText: { color: COLORS.textTertiary, textAlign: 'center', padding: 32, fontSize: 13 },
  goBtn: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, alignItems: 'center', margin: 12 },
  goBtnText: { color: COLORS.onPrimary, fontSize: 15, fontWeight: '600' },
  pad: { padding: 12 },
  confCard: { backgroundColor: COLORS.surface, margin: 12, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  confName: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  confMeta: { flexDirection: 'row', gap: 12, marginTop: 8 },
  confBadge: { fontSize: 16 },
  confParticipants: { fontSize: 13, color: COLORS.textSecondary },
  headerActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  inviteBtn: { paddingHorizontal: 4 },
  confRoom: { flex: 1, backgroundColor: COLORS.background },
  participantRow: { flexDirection: 'row', alignItems: 'center', padding: 14, margin: 6, backgroundColor: COLORS.surface, borderRadius: 10, gap: 10 },
  participantSpeaking: { borderWidth: 1, borderColor: COLORS.secondary },
  participantDot: { width: 10, height: 10, borderRadius: 5 },
  participantName: { fontSize: 15, fontWeight: '500', color: COLORS.textPrimary, flex: 1 },
  speakingBadge: { fontSize: 11, color: COLORS.secondary, fontWeight: '600' },
  toggleBtn: { padding: 14, margin: 6 },
  toggleText: { color: COLORS.primary, fontSize: 15, textAlign: 'center' },
  chatWrap: { flex: 1, backgroundColor: COLORS.background },
  chatList: { flex: 1 },
  inputBar: { flexDirection: 'row', padding: 8, backgroundColor: COLORS.surface, borderTopWidth: 1, borderColor: COLORS.border },
  chatInput: { flex: 1, backgroundColor: COLORS.surfaceVariant, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: COLORS.textPrimary, marginRight: 8 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  sendBtnText: { color: COLORS.onPrimary, fontSize: 18, fontWeight: '700' },
  shareProgressWrap: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', padding: 32 },
  shareIcon: { color: COLORS.textPrimary, fontSize: 24, marginBottom: 16 },
  shareIconBig: { color: COLORS.textPrimary, fontSize: 40, marginBottom: 16 },
  shareStatus: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 24 },
  shareTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  shareDesc: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 32 },
  shareActions: { flexDirection: 'row', gap: 16 },
  progressTrack: { width: '80%', height: 8, backgroundColor: COLORS.surfaceVariant, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 4 },
  progressLabel: { color: COLORS.textSecondary, fontSize: 13, marginTop: 8 },
  rejectBtn: { backgroundColor: COLORS.error, borderRadius: 12, padding: 14, alignItems: 'center', flex: 1 },
  acceptBtn: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, alignItems: 'center', flex: 1 },
  pttBar: { flexDirection: 'row', justifyContent: 'center', padding: 8, backgroundColor: COLORS.surface, borderTopWidth: 1, borderColor: COLORS.border },
  pttMini: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 24, backgroundColor: COLORS.surfaceVariant },
  pttMiniText: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '600' },
  pttBtn: { margin: 16, padding: 20, borderRadius: 16, backgroundColor: COLORS.surfaceVariant, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  voxToggle: { marginHorizontal: 16, marginTop: 8, padding: 10, borderRadius: 12, backgroundColor: COLORS.surfaceVariant, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  voxToggleText: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  pttActive: { backgroundColor: COLORS.error, borderColor: COLORS.error },
  pttText: { fontSize: 16, fontWeight: '700', color: COLORS.onPrimary },
});
