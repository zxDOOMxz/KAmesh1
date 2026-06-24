import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { COLORS } from '../constants';
import { AuthService } from '../services/AuthService';

interface Props { onUnlock: () => void; }

export function PinUnlockScreen({ onUnlock }: Props) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);

  const handleUnlock = async () => {
    const trimmed = pin.trim();
    if (!trimmed) return;
    if (AuthService.verifyPin(trimmed)) {
      setError('');
      await AuthService.decryptKeyBundle(trimmed);
      onUnlock();
    } else {
      const next = attempts + 1;
      setAttempts(next);
      setError(next >= 5 ? 'Too many attempts. App data will be reset.' : 'Wrong PIN');
      setPin('');
      if (next >= 5) {
        AuthService.resetPin();
        onUnlock();
      }
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={styles.title}>KAmesh</Text>
        <Text style={styles.subtitle}>Enter PIN to unlock</Text>
        <TextInput
          style={styles.input}
          placeholder="PIN"
          placeholderTextColor={COLORS.textTertiary}
          value={pin}
          onChangeText={(t) => { setPin(t); setError(''); }}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={8}
          autoFocus
          onSubmitEditing={handleUnlock}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          style={[styles.button, (!pin.trim()) && styles.buttonDisabled]}
          onPress={handleUnlock}
          disabled={!pin.trim()}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>Unlock</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 400, backgroundColor: COLORS.surface, borderRadius: 16, padding: 32, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  lockIcon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '700', color: COLORS.primary, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 24 },
  input: { backgroundColor: COLORS.surfaceVariant, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 18, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12, textAlign: 'center', letterSpacing: 8, width: '100%' },
  error: { fontSize: 13, color: COLORS.error, textAlign: 'center', marginBottom: 12 },
  button: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', width: '100%' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 16, fontWeight: '600', color: COLORS.onPrimary },
});
