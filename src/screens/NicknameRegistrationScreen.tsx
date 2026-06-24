import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { COLORS } from '../constants';
import { ContactService } from '../services/ContactService';

interface Props { onRegistered: (nickname: string) => void; }

export function NicknameRegistrationScreen({ onRegistered }: Props) {
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    const trimmed = nickname.trim();
    if (trimmed.length < 2 || trimmed.length > 20) { setError('Nickname must be 2-20 characters'); return; }
    if (!/^[a-zA-Z0-9а-яА-ЯёЁ_\-.]+$/.test(trimmed)) { setError('Only letters, digits, dash and underscore'); return; }
    setLoading(true);
    setError('');
    const success = await ContactService.registerNickname(trimmed);
    setLoading(false);
    if (success) onRegistered(trimmed);
    else setError('Nickname taken or network error. Try another.');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.subtitle}>Choose a nickname</Text>
        <Text style={styles.hint}>It will be visible to other users.{'\n'}Nickname cannot be changed later.</Text>
        <TextInput style={styles.input} placeholder="Your nickname" placeholderTextColor={COLORS.textTertiary}
          value={nickname} onChangeText={(t) => { setNickname(t); setError(''); }} maxLength={20} autoCapitalize="none" autoFocus />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity style={[styles.button, (!nickname.trim() || loading) && styles.buttonDisabled]}
          onPress={handleRegister} disabled={!nickname.trim() || loading} activeOpacity={0.7}>
          {loading ? <ActivityIndicator color={COLORS.onPrimary} size="small" /> : <Text style={styles.buttonText}>Done</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 400, backgroundColor: COLORS.surface, borderRadius: 16, padding: 32, borderWidth: 1, borderColor: COLORS.border },
  title: { fontSize: 26, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 16 },
  hint: { fontSize: 13, color: COLORS.textTertiary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  input: { backgroundColor: COLORS.surfaceVariant, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 },
  error: { fontSize: 13, color: COLORS.error, textAlign: 'center', marginBottom: 12 },
  button: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 16, fontWeight: '600', color: COLORS.onPrimary },
});
