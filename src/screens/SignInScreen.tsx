import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { COLORS } from '../constants';
import { AuthService } from '../services/AuthService';

interface Props { onComplete: () => void; }

export function SignInScreen({ onComplete }: Props) {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    const trimmed = nickname.trim();
    if (trimmed.length < 2) { setError('Минимум 2 символа'); return; }
    if (trimmed.length > 20) { setError('Максимум 20 символов'); return; }
    setError('');
    const success = AuthService.saveProfile(trimmed);
    if (success) onComplete();
    else setError('Ошибка сохранения');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.title}>SofiLink</Text>
        <Text style={styles.subtitle}>Введите ваш никнейм</Text>
        <Text style={styles.hint}>Будет виден другим пользователям в сети.</Text>
        <TextInput
          style={styles.input}
          placeholder="Ваш никнейм"
          placeholderTextColor={COLORS.textTertiary}
          value={nickname}
          onChangeText={(t) => { setNickname(t); setError(''); }}
          maxLength={20}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          style={[styles.button, (!nickname.trim()) && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!nickname.trim()}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>Войти</Text>
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
